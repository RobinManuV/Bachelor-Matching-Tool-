const { getAdminClient, getPublicClient } = require('../../lib/supabase-clients');
const { normalizeSchoolName, schoolPassword, schoolAccessCode, sessionForRole, escapeHtml } = require('../../lib/admin-access');
const { sendEmail } = require('../../lib/email');

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}

function fail(status, message) {
  const error = new Error(message); error.status = status; throw error;
}

async function profileFor(userId) {
  const { data, error } = await getAdminClient().from('admin_profiles')
    .select('user_id,email,full_name,role,school_id,schools(name,access_code)').eq('user_id', userId).single();
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
  let query = getAdminClient().from('matching_sessions').select('*').order('created_at', { ascending: false }).limit(500);
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

async function decideApplication(profile, body, event) {
  if (profile.role !== 'robin') fail(403, 'Solo Robin puede gestionar solicitudes');
  if (!['approve', 'deny'].includes(body.action)) fail(400, 'Decisión no válida');
  const supabase = getAdminClient();
  const { data: application, error } = await supabase.from('school_applications').select('*').eq('id', body.id).eq('status', 'pending').single();
  if (error || !application) fail(404, 'La solicitud ya no está pendiente');

  if (body.action === 'deny') {
    const { error: updateError } = await supabase.from('school_applications').update({ status: 'denied', reviewed_at: new Date().toISOString(), reviewed_by: profile.user_id }).eq('id', application.id);
    if (updateError) throw updateError;
    return { status: 'denied' };
  }

  const normalized = normalizeSchoolName(application.school_name);
  let { data: school } = await supabase.from('schools').select('*').eq('normalized_name', normalized).maybeSingle();
  if (!school) {
    const inserted = await supabase.from('schools').insert({ name: application.school_name, normalized_name: normalized, access_code: schoolAccessCode(application.school_name) }).select('*').single();
    if (inserted.error) throw inserted.error;
    school = inserted.data;
  }

  const password = schoolPassword(application.school_name);
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
  const email = await sendEmail({
    to: application.corporate_email,
    subject: 'Tu acceso al panel de colegios de Project Robin',
    html: `<h1>Solicitud aprobada</h1><p>Hola ${escapeHtml(application.contact_name)},</p><p>Ya puedes acceder al panel de ${escapeHtml(application.school_name)}.</p><p><strong>Usuario:</strong> ${escapeHtml(application.corporate_email)}<br><strong>Contraseña:</strong> ${escapeHtml(password)}</p><p><a href="${escapeHtml(panelUrl)}">Abrir el panel</a></p><p>Comparte este enlace con tus alumnos para asociarlos al colegio:<br><a href="${escapeHtml(matchingUrl)}">${escapeHtml(matchingUrl)}</a></p>`,
    text: `Solicitud aprobada\nUsuario: ${application.corporate_email}\nContraseña: ${password}\nPanel: ${panelUrl}\nEnlace para alumnos: ${matchingUrl}`,
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
    if (event.httpMethod === 'GET' && route === 'applications') return json(200, { applications: await listApplications(context.profile) });
    if (event.httpMethod === 'POST' && route === 'applications/decision') return json(200, await decideApplication(context.profile, body, event));
    return json(404, { error: 'Ruta no encontrada' });
  } catch (error) {
    console.error('admin:', error.message);
    return json(error.status || 500, { error: error.status ? error.message : 'No se ha podido completar la operación' });
  }
};
