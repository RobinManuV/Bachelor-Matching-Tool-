const store = require('../../lib/student-store.cjs');
const { requireVerifiedUser, json, respondError } = require('../../lib/student-api.cjs');

exports.handler = async (event) => {
  if (!['GET', 'DELETE'].includes(event.httpMethod)) return json(405, { error: 'Método no permitido' });
  try {
    const student = await requireVerifiedUser(event);
    if (event.httpMethod === 'GET') return json(200, { profile: await store.getStudentProfile(student.userId) });
    return json(200, await store.deleteStudentAccount(student.userId));
  } catch (error) {
    return respondError(error, 'student account');
  }
};
