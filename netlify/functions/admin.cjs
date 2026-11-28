const { getAdminClient, getPublicClient } = require('../../lib/supabase-clients');
const { normalizeSchoolName, schoolPassword, schoolAccessCode, sessionForRole, escapeHtml } = require('../../lib/admin-access');
const { sendEmail } = require('../../lib/email');
const { schoolApprovalEmail } = require('../../lib/school-approval-email');

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}

function fail(status, message) {
  const error = new Error(message); error.status = status; throw error;
}

async function profileFor(userId) {
  const { data, error } = await getAdminClient().from('admin_profiles')
    .select('user_id,email,full_name,role,school_id,onboarding_completed_at,schools(name,access_code)').eq('user_id', userId).single();
  if (error || !data) fail(403, 'Esta cuenta no tiene acceso al panel');
  return data;
}

async function authenticate(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) fail(401, 'Inicia sesión');
  const { data, error } = await getAdminClient().auth.getUser(token);
  if (error || !data.user) fail(401, 'La sesión ha caducado');
  return { user: data.user, profile: await profileFor(data.user.id) };
}

async function login(body) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const { data, error } = await getPublicClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) fail(401, 'Correo o contraseña incorrectos');
  const profile = await profileFor(data.user.id);
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token, profile };
}

async function refresh(body) {
  const { data, error } = await getPublicClient().auth.refreshSession({ refresh_token: body.refresh_token });
  if (error || !data.session) fail(401, 'La sesión ha caducado');
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

async function listSessions(profile) {
  let query = getAdminClient().from('matching_sessions').select('*,recommendation_feedback(program_code,decision,created_at)').order('created_at', { ascending: false }).limit(500);
  if (profile.role === 'school') {
    if (!profile.school_id) return [];
    query = query.eq('school_id', profile.school_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((session) => sessionForRole(session, profile));
}

async function listApplications(profile) {
  if (profile.role !== 'robin') fail(403, 'Solo Robin puede gestionar solicitudes');
  const { data, error } = await getAdminClient().from('school_applications').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function listStudentActivity(profile) {
  if (profile.role !== 'robin') fail(403, 'Solo Robin puede consultar la actividad de la app');
  const supabase = getAdminClient();
  async function allRows(table, columns = '*') {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) return rows;
    }
  }
  const [profileRows, sessionRows, feedbackRows, consentRows, contributionRows] = await Promise.all([
    allRows('student_profiles'), allRows('student_recommendation_sessions'),
    allRows('student_recommendation_feedback'),
    allRows('student_guardian_consents', 'user_id,guardian_email,expires_at,confirmed_at,created_at'),
    allRows('career_feedback_contributions', 'user_id,area,program_code,decision,positive_terms,negative_terms,updated_at'),
  ]);
  const userIds = new Set(profileRows.map((item) => item.user_id));
  sessionRows.forEach((item) => userIds.add(item.user_id));
  feedbackRows.forEach((item) => userIds.add(item.user_id));
  contributionRows.forEach((item) => userIds.add(item.user_id));
  const usersById = new Map();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users || []) {
      if (user.user_metadata?.role === 'student') userIds.add(user.id);
      if (userIds.has(user.id)) usersById.set(user.id, {
        email: user.email || '',
        name: user.user_metadata?.name || user.user_metadata?.full_name || '',
        created_at: user.created_at,
      });
    }
    if (!data.users || data.users.length < 1000) break;
  }

  const profilesById = new Map(profileRows.map((item) => [item.user_id, item]));
  const sessionsByUser = new Map();
  const feedbackBySession = new Map();
  for (const item of feedbackRows) {
    if (!feedbackBySession.has(item.session_id)) feedbackBySession.set(item.session_id, []);
    feedbackBySession.get(item.session_id).push(item);
  }
  for (const session of sessionRows) {
    if (!sessionsByUser.has(session.user_id)) sessionsByUser.set(session.user_id, []);
    session.feedback = feedbackBySession.get(session.id) || [];
    sessionsByUser.get(session.user_id).push(session);
  }
  for (const sessions of sessionsByUser.values()) sessions.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const consentByUser = new Map(consentRows.map((item) => [item.user_id, item]));
  const contributionsByUser = new Map();
  for (const item of contributionRows) {
    if (!contributionsByUser.has(item.user_id)) contributionsByUser.set(item.user_id, []);
    contributionsByUser.get(item.user_id).push(item);
  }
  return [...userIds].map((user_id) => {
    const account = usersById.get(user_id) || {};
    const studentProfile = profilesById.get(user_id) || {};
    const sessions = sessionsByUser.get(user_id) || [];
    const feedbackCount = sessions.reduce((count, session) => count + session.feedback.length, 0);
    const contributions = contributionsByUser.get(user_id) || [];
    const consent = consentByUser.get(user_id);
    const lastActivity = [...sessions.flatMap((session) => [session.created_at, ...session.feedback.map((item) => item.updated_at || item.created_at)]), studentProfile.updated_at, consent?.confirmed_at]
      .filter(Boolean).sort().at(-1) || account.created_at || studentProfile.created_at;
    return {
      user_id,
      email: account.email || '',
      name: account.name || '',
      account_created_at: account.created_at || studentProfile.created_at,
      country_code: studentProfile.country_code || '',
      consent_status: studentProfile.consent_status || 'unknown',
      guardian: consent ? { email: consent.guardian_email, confirmed_at: consent.confirmed_at, expires_at: consent.expires_at } : null,
      session_count: sessions.length,
      feedback_count: feedbackCount,
      community_contribution_count: contributions.length,
      community_contributions: contributions,
      last_activity_at: lastActivity,
      sessions,
    };
  }).sort((a, b) => String(b.last_activity_at || '').localeCompare(String(a.last_activity_at || '')));
}

async function completeOnboarding(profile) {
  if (profile.role !== 'school') fail(403, 'Solo los colegios tienen este recorrido');
  if (profile.onboarding_completed_at) return { onboarding_completed_at: profile.onboarding_completed_at };
  const completedAt = new Date().toISOString();
  const { error } = await getAdminClient().from('admin_profiles')
    .update({ onboarding_completed_at: completedAt }).eq('user_id', profile.user_id);
  if (error) throw error;
  return { onboarding_completed_at: completedAt };
}

async function decideApplication(profile, body, event) {
  if (profile.role !== 'robin') fail(403, 'Solo Robin puede gestionar solicitudes');
  if (!['approve', 'deny'].includes(body.action)) fail(400, 'Decisión no válida');
  if (body.action === 'approve' && !['es', 'en', 'pt-PT'].includes(body.language || 'es')) fail(400, 'Idioma de correo no válido');
  const supabase = getAdminClient();
  const { data: application, error } = await supabase.from('school_applications').select('*').eq('id', body.id).eq('status', 'pending').single();
  if (error || !application) fail(404, 'La solicitud ya no está pendiente');

  if (body.action === 'deny') {
    const { error: updateError } = await supabase.from('school_applications').update({ status: 'denied', reviewed_at: new Date().toISOString(), reviewed_by: profile.user_id }).eq('id', application.id);
    if (updateError) throw updateError;
    return { status: 'denied' };
  }

  const password = schoolPassword();
  const normalized = normalizeSchoolName(application.school_name);
  let { data: school } = await supabase.from('schools').select('*').eq('normalized_name', normalized).maybeSingle();
  if (!school) {
    const inserted = await supabase.from('schools').insert({ name: application.school_name, normalized_name: normalized, access_code: schoolAccessCode(application.school_name) }).select('*').single();
    if (inserted.error) throw inserted.error;
    school = inserted.data;
  }

  const created = await supabase.auth.admin.createUser({
    email: application.corporate_email,
    password,
    email_confirm: true,
    user_metadata: { name: application.contact_name, role: 'school', school_id: school.id },
  });
  if (created.error || !created.data.user) fail(409, created.error?.message || 'No se pudo crear la cuenta');

  const profileInsert = await supabase.from('admin_profiles').insert({
    user_id: created.data.user.id,
    email: application.corporate_email,
    full_name: application.contact_name,
    role: 'school',
    school_id: school.id,
  });
  if (profileInsert.error) {
    await supabase.auth.admin.deleteUser(created.data.user.id);
    throw profileInsert.error;
  }

  const reviewedAt = new Date().toISOString();
  const updated = await supabase.from('school_applications').update({ status: 'approved', reviewed_at: reviewedAt, reviewed_by: profile.user_id, school_id: school.id }).eq('id', application.id);
  if (updated.error) throw updated.error;

  const siteUrl = String(process.env.SITE_URL || event.headers?.origin || '').replace(/\/$/, '');
  const matchingUrl = `${siteUrl}/?school=${encodeURIComponent(school.access_code)}`;
  const panelUrl = `${siteUrl}/admin/`;
  const welcome = schoolApprovalEmail({
    contactName: application.contact_name,
    schoolName: application.school_name,
    email: application.corporate_email,
    password,
    matchingUrl,
    panelUrl,
    language: body.language || 'es',
  });
  const email = await sendEmail({
    to: application.corporate_email,
    ...welcome,
  });
  if (!email.sent) {
    await supabase.from('school_applications').update({ status: 'pending', reviewed_at: null, reviewed_by: null, school_id: null }).eq('id', application.id);
    await supabase.auth.admin.deleteUser(created.data.user.id);
    fail(502, 'No se pudieron enviar las credenciales. La solicitud sigue pendiente.');
  }
  return { status: 'approved', email_sent: email.sent, school: { id: school.id, name: school.name, access_code: school.access_code } };
}

exports.handler = async (event) => {
  const route = String(event.queryStringParameters?.route || '').replace(/^\/+|\/+$/g, '');
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    if (event.httpMethod === 'POST' && route === 'login') return json(200, await login(body));
    if (event.httpMethod === 'POST' && route === 'refresh') return json(200, await refresh(body));

    const context = await authenticate(event);
    if (event.httpMethod === 'GET' && route === 'me') return json(200, { profile: context.profile });
    if (event.httpMethod === 'GET' && route === 'sessions') return json(200, { sessions: await listSessions(context.profile) });
    if (event.httpMethod === 'GET' && route === 'student-activity') return json(200, { students: await listStudentActivity(context.profile) });
    if (event.httpMethod === 'GET' && route === 'applications') return json(200, { applications: await listApplications(context.profile) });
    if (event.httpMethod === 'POST' && route === 'onboarding/complete') return json(200, await completeOnboarding(context.profile));
    if (event.httpMethod === 'POST' && route === 'applications/decision') return json(200, await decideApplication(context.profile, body, event));
    return json(404, { error: 'Ruta no encontrada' });
  } catch (error) {
    console.error('admin:', error.message);
    return json(error.status || 500, { error: error.status ? error.message : 'No se ha podido completar la operación' });
  }
};
