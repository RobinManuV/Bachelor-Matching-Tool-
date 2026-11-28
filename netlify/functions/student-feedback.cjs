const store = require('../../lib/student-store.cjs');
const { normalizeStudentFeedback, opinionSignals } = require('../../lib/student-feedback.cjs');
const { participantKey } = require('../../lib/community-feedback.cjs');
const { requireStudent, readBody, json, respondError } = require('../../lib/student-api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'PUT') return json(405, { error: 'Método no permitido' });
  try {
    const student = await requireStudent(event);
    const feedback = normalizeStudentFeedback(readBody(event));
    const session = await store.ownedSession(student.userId, feedback.sessionId);
    if (!session) throw new Error('No encontramos esta sesión en tu perfil');
    const saved = await store.saveFeedback({ userId: student.userId, ...feedback });
    const terms = opinionSignals(feedback.comment, feedback.decision);
    await Promise.all((Array.isArray(session.selected_areas) ? session.selected_areas : []).map((area) =>
      store.saveCommunityContribution({
        userId: student.userId,
        participantHash: participantKey('email', student.email),
        area,
        programCode: feedback.programCode,
        decision: feedback.decision,
        ...terms,
      })));
    return json(200, { feedback: saved });
  } catch (error) {
    return respondError(error, 'student feedback');
  }
};
