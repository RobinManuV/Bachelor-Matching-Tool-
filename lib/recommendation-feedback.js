const { findCareer } = require('./careers-recommender');

const DECISIONS = new Set(['approved', 'rejected']);

function databaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const secret = String(process.env.SUPABASE_SECRET_KEY || '');
  return url && secret ? { url, secret } : null;
}

function normalizeFeedback(value) {
  const sessionId = String(value?.session_id || '').trim();
  const programCode = String(value?.program_code || '').trim();
  const decision = String(value?.decision || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    throw new Error('La sesión de recomendaciones no es válida');
  }
  if (!findCareer(programCode)) throw new Error('La recomendación no es válida');
  if (!DECISIONS.has(decision)) throw new Error('La valoración no es válida');
  return { matching_session_id: sessionId, program_code: programCode, decision };
}

async function saveRecommendationFeedback(value) {
  const feedback = normalizeFeedback(value);
  const config = databaseConfig();
  if (!config) throw new Error('La base de datos no está configurada correctamente');
  const sessionResponse = await fetch(`${config.url}/rest/v1/matching_sessions?select=id,recommendations&id=eq.${feedback.matching_session_id}&limit=1`, {
    headers: { apikey: config.secret },
  });
  const sessions = await sessionResponse.json().catch(() => []);
  const session = Array.isArray(sessions) ? sessions[0] : null;
  if (!sessionResponse.ok || !session) throw new Error('No encontramos esta sesión de recomendaciones');
  const shown = Array.isArray(session.recommendations) ? session.recommendations.slice(0, 3) : [];
  if (!shown.some((item) => item?.program_code === feedback.program_code)) {
    throw new Error('Esta carrera no pertenece a las recomendaciones mostradas');
  }
  const response = await fetch(`${config.url}/rest/v1/recommendation_feedback?on_conflict=matching_session_id,program_code`, {
    method: 'POST',
    headers: {
      apikey: config.secret,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(feedback),
  });
  if (!response.ok) throw new Error('No se ha podido guardar la valoración');
  return { saved: true, program_code: feedback.program_code, decision: feedback.decision };
}

async function loadFeedbackHistory(selectedArea, limit = 80) {
  const config = databaseConfig();
  if (!config) return [];
  try {
    const params = new URLSearchParams({
      select: 'program_code,decision,matching_sessions!inner(selected_area,questionnaire)',
      'matching_sessions.selected_area': `eq.${selectedArea}`,
      order: 'created_at.desc',
      limit: String(Math.max(1, Math.min(200, limit))),
    });
    const response = await fetch(`${config.url}/rest/v1/recommendation_feedback?${params}`, {
      headers: { apikey: config.secret },
    });
    const data = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(data)) throw new Error(`HTTP ${response.status}`);
    return data.map((entry) => ({
      program_code: entry.program_code,
      decision: entry.decision,
      signals: entry.matching_sessions?.questionnaire?.signals || {},
    }));
  } catch (error) {
    console.error('recommendation feedback history:', error.message);
    return [];
  }
}

module.exports = { normalizeFeedback, saveRecommendationFeedback, loadFeedbackHistory };
