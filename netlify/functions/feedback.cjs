const { saveRecommendationFeedback } = require('../../lib/recommendation-feedback');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  try {
    return json(200, await saveRecommendationFeedback(JSON.parse(event.body || '{}')));
  } catch (error) {
    console.error('feedback function:', error.message);
    return json(400, { error: error.message });
  }
};
