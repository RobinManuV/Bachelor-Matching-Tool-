const { loadData, buildAirlinesUser, validateFeedback } = require('../../server.cjs');
const { generateSuggestions } = require('../../lib/career-suggestions');
const { saveMatchSession } = require('../../lib/match-storage');

let dataPromise;
function ensureData() {
  if (!dataPromise) dataPromise = loadData();
  return dataPromise;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  if (!event.body || event.body.length > 1_000_000) return json(400, { error: 'Solicitud inválida' });

  try {
    await ensureData();
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    const payload = JSON.parse(raw);
    if (payload.experience !== 'robin-airlines') throw new Error('Experiencia no válida');

    const user = buildAirlinesUser(payload);
    const suggestions = await generateSuggestions(user, validateFeedback(payload.feedback));
    const storage = await saveMatchSession({ lead: payload.lead, user, suggestions, schoolCode: payload.school_code });
    return json(200, { suggestions, storage });
  } catch (error) {
    console.error('match function:', error.message);
    return json(400, { error: error.message });
  }
};
