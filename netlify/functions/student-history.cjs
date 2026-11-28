const store = require('../../lib/student-store.cjs');
const { requireStudent, json, respondError } = require('../../lib/student-api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido' });
  try {
    const student = await requireStudent(event);
    return json(200, { sessions: await store.listSessions(student.userId) });
  } catch (error) {
    return respondError(error, 'student history');
  }
};
