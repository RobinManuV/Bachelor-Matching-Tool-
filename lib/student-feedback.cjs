const { fallbackAnalysis } = require('./open-text-signals');
const { findCareer } = require('./careers-recommender');

function normalizeStudentFeedback(value) {
  const sessionId = String(value?.session_id || '').trim();
  const programCode = String(value?.program_code || '').trim();
  const decision = String(value?.decision || '').trim();
  const comment = String(value?.comment || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    throw new Error('La sesión no es válida');
  }
  if (!findCareer(programCode)) throw new Error('La carrera no es válida');
  if (!['approved', 'rejected'].includes(decision)) throw new Error('La valoración no es válida');
  if (comment.length > 500) throw new Error('La opinión debe tener 500 caracteres o menos');
  return { sessionId, programCode, decision, comment };
}

function buildPersonalHistory(sessions) {
  return (Array.isArray(sessions) ? sessions : []).flatMap((session) =>
    (Array.isArray(session.feedback) ? session.feedback : []).map((feedback) => ({
      program_code: feedback.program_code,
      decision: feedback.decision,
      comment: String(feedback.comment || '').slice(0, 500),
      signals: session.questionnaire?.signals || {},
      created_at: feedback.updated_at || feedback.created_at || session.created_at,
    })));
}

function opinionSignals(comment, decision) {
  if (!String(comment || '').trim()) return { positiveTerms: [], negativeTerms: [] };
  const analyzed = fallbackAnalysis({ opinion: { question: 'Opinión de carrera', answer: comment } });
  const terms = [...new Set([...(analyzed.positive_terms || []), ...(analyzed.negative_terms || [])])].slice(0, 12);
  return decision === 'approved'
    ? { positiveTerms: terms, negativeTerms: [] }
    : { positiveTerms: [], negativeTerms: terms };
}

module.exports = { normalizeStudentFeedback, buildPersonalHistory, opinionSignals };
