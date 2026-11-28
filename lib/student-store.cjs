const crypto = require('node:crypto');
const { findCareer } = require('./careers-recommender');

function databaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SECRET_KEY || '');
  if (!url || !key) throw new Error('La base de datos no está configurada correctamente');
  return { url, key };
}

async function request(path, options = {}) {
  const { url, key } = databaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error('No se pudieron guardar o consultar los datos del perfil');
    error.statusCode = response.status >= 500 ? 503 : 400;
    throw error;
  }
  return body;
}

function filter(values) {
  return Object.entries(values).map(([key, value]) => `${key}=${value}`).join('&');
}

function inList(values) {
  return `(${values.join(',')})`;
}

async function getStudentProfile(userId) {
  const rows = await request(`student_profiles?select=user_id,country_code,consent_status,consented_at,consent_version&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function createStudentProfile({ userId, countryCode, consentStatus, consentedAt, consentVersion }) {
  const payload = {
    user_id: userId,
    country_code: countryCode,
    consent_status: consentStatus,
    consented_at: consentedAt || null,
    consent_version: consentVersion || null,
    updated_at: new Date().toISOString(),
  };
  const rows = await request('student_profiles', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function saveSession({ userId, user, suggestions }) {
  if (!userId || !Array.isArray(user?.intereses) || !user.intereses.length) throw new Error('Faltan los datos del perfil');
  if (!Array.isArray(suggestions?.items) || !suggestions.items.length) throw new Error('No hay recomendaciones que guardar');
  const rows = await request('student_recommendation_sessions?select=id,created_at', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      selected_areas: user.intereses,
      academic_system: user.academic_system,
      academic_subjects: user.academic_subjects || [],
      questionnaire: user.questionnaire || {},
      recommendation_source: suggestions.source,
      recommendation_model: suggestions.model || null,
      recommendations: suggestions.items,
    }),
  });
  if (!Array.isArray(rows) || !rows[0]?.id) throw new Error('No se pudo confirmar el historial guardado');
  return rows[0];
}

async function listPersonalFeedback(userId) {
  return request(`student_recommendation_feedback?select=id,session_id,program_code,decision,comment,created_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`);
}

async function listSessions(userId) {
  const [sessions, feedback] = await Promise.all([
    request(`student_recommendation_sessions?select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`),
    listPersonalFeedback(userId),
  ]);
  const bySession = new Map();
  for (const item of Array.isArray(feedback) ? feedback : []) {
    if (!bySession.has(item.session_id)) bySession.set(item.session_id, []);
    bySession.get(item.session_id).push(item);
  }
  return (Array.isArray(sessions) ? sessions : []).map((session) => ({
    ...session,
    feedback: bySession.get(session.id) || [],
  }));
}

async function previewLegacySessions({ email }) {
  const query = new URLSearchParams({
    select: 'id,created_at,selected_area,questionnaire,recommendations,recommendation_source,recommendation_model',
    email: `eq.${email}`,
    student_user_id: 'is.null',
    order: 'created_at.desc',
    limit: '200',
  });
  return request(`matching_sessions?${query}`);
}

async function claimLegacySessions({ userId, email, sessionIds }) {
  const ids = [...new Set((Array.isArray(sessionIds) ? sessionIds : []).filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id))))].slice(0, 200);
  if (!ids.length) return [];
  const query = new URLSearchParams({
    select: 'id,created_at,selected_area,questionnaire,recommendations,recommendation_source,recommendation_model',
    id: `in.${inList(ids)}`,
    email: `eq.${email}`,
    student_user_id: 'is.null',
  });
  return request(`matching_sessions?${query}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ student_user_id: userId }),
  });
}

async function ownedSession(userId, sessionId) {
  const query = new URLSearchParams({
    select: 'id,selected_areas,questionnaire,recommendations',
    id: `eq.${sessionId}`,
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const rows = await request(`student_recommendation_sessions?${query}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function saveFeedback({ userId, sessionId, programCode, decision, comment }) {
  const session = await ownedSession(userId, sessionId);
  if (!session) throw new Error('No encontramos esta sesión en tu perfil');
  const shown = Array.isArray(session.recommendations) ? session.recommendations : [];
  if (!shown.some((item) => item?.program_code === programCode) || !findCareer(programCode)) {
    throw new Error('Esta carrera no pertenece a esta recomendación');
  }
  const rows = await request('student_recommendation_feedback?on_conflict=session_id,program_code', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      program_code: programCode,
      decision,
      comment: String(comment || '').trim().slice(0, 500),
      updated_at: new Date().toISOString(),
    }),
  });
  return Array.isArray(rows) ? rows[0] || { saved: true } : { saved: true };
}

async function saveCommunityContribution({ userId, participantHash, area, programCode, decision, positiveTerms = [], negativeTerms = [] }) {
  const cleanTerms = (terms) => [...new Set((Array.isArray(terms) ? terms : [])
    .map((term) => String(term).trim().toLowerCase()).filter((term) => term && term.length <= 60))].slice(0, 12);
  return request('career_feedback_contributions?on_conflict=user_id,area,program_code', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      participant_hash: participantHash,
      area,
      program_code: programCode,
      decision,
      positive_terms: cleanTerms(positiveTerms),
      negative_terms: cleanTerms(negativeTerms),
      updated_at: new Date().toISOString(),
    }),
  });
}

async function listCommunityContributions(area) {
  const query = new URLSearchParams({
    select: 'user_id,participant_hash,program_code,decision,positive_terms,negative_terms,updated_at',
    area: `eq.${area}`,
  });
  return request(`career_feedback_contributions?${query}`);
}

async function createGuardianConsent({ userId, guardianEmail, tokenHash, expiresAt }) {
  const query = new URLSearchParams({ on_conflict: 'user_id' });
  return request(`student_guardian_consents?${query}`, {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: userId, guardian_email: guardianEmail, token_hash: tokenHash, expires_at: expiresAt, confirmed_at: null }),
  });
}

async function confirmGuardianConsent(tokenHash) {
  const query = new URLSearchParams({
    select: 'id,user_id',
    token_hash: `eq.${tokenHash}`,
    confirmed_at: 'is.null',
    expires_at: `gt.${new Date().toISOString()}`,
    limit: '1',
  });
  const rows = await request(`student_guardian_consents?${query}`);
  if (!Array.isArray(rows) || !rows[0]?.user_id) throw new Error('El enlace de autorización ha caducado o ya se ha utilizado');
  const profileRows = await request(`student_profiles?user_id=eq.${encodeURIComponent(rows[0].user_id)}&consent_status=eq.pending_guardian`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ consent_status: 'active', consented_at: new Date().toISOString(), consent_version: String(process.env.STUDENT_CONSENT_VERSION || '1') }),
  });
  const profile = Array.isArray(profileRows) ? profileRows[0] : null;
  if (!profile) {
    const existing = await getStudentProfile(rows[0].user_id);
    if (existing?.consent_status !== 'active') throw new Error('No se pudo activar el perfil autorizado');
  }
  const confirmed = await request(`student_guardian_consents?id=eq.${encodeURIComponent(rows[0].id)}&confirmed_at=is.null`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({ confirmed_at: new Date().toISOString() }),
  });
  if (!Array.isArray(confirmed) || !confirmed.length) throw new Error('El enlace de autorización ya se ha utilizado');
  return profile || getStudentProfile(rows[0].user_id);
}

async function deleteStudentAccount(userId) {
  const { url, key } = databaseConfig();
  const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error('No se ha podido eliminar la cuenta');
  return { deleted: true };
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = {
  getStudentProfile,
  createStudentProfile,
  saveSession,
  listSessions,
  previewLegacySessions,
  claimLegacySessions,
  ownedSession,
  saveFeedback,
  saveCommunityContribution,
  listCommunityContributions,
  createGuardianConsent,
  confirmGuardianConsent,
  deleteStudentAccount,
  tokenHash,
};
