const { loadData, getStudentConfig } = require('../../server.cjs');
const { json, respondError } = require('../../lib/student-api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido' });
  try {
    await loadData();
    return json(200, getStudentConfig());
  } catch (error) {
    return respondError(error, 'student config');
  }
};
