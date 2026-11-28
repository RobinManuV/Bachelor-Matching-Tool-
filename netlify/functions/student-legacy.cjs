const store = require('../../lib/student-store.cjs');
const { requireStudent, readBody, json, respondError } = require('../../lib/student-api.cjs');

exports.handler = async (event) => {
  try {
    const student = await requireStudent(event);
    if (event.httpMethod === 'GET') {
      return json(200, { sessions: await store.previewLegacySessions({ email: student.email }) });
    }
    if (event.httpMethod === 'POST') {
      const payload = readBody(event);
      const sessions = await store.claimLegacySessions({ userId: student.userId, email: student.email, sessionIds: payload.session_ids });
      return json(200, { sessions, claimed_count: sessions.length });
    }
    return json(405, { error: 'Método no permitido' });
  } catch (error) {
    return respondError(error, 'student legacy history');
  }
};
