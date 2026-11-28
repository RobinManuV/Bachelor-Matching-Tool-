const { loadData, buildUser } = require('../../server.cjs');
const { generateSuggestions } = require('../../lib/career-suggestions');
const store = require('../../lib/student-store.cjs');
const { buildPersonalHistory } = require('../../lib/student-feedback.cjs');
const { loadCommunityFeedback } = require('../../lib/community-feedback.cjs');
const { requireStudent, readBody, json, respondError } = require('../../lib/student-api.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  try {
    const student = await requireStudent(event);
    const payload = readBody(event);
    await loadData();
    const user = buildUser({ ...payload, email: student.email });
    const sessions = await store.listSessions(student.userId);
    const personalHistory = buildPersonalHistory(sessions);
    const communityByProgram = new Map();
    const communityPages = await Promise.all(user.intereses.map((area) => loadCommunityFeedback(area)));
    communityPages.flat().forEach((entry) => {
      const current = communityByProgram.get(entry.program_code);
      if (!current || entry.participant_count > current.participant_count) communityByProgram.set(entry.program_code, entry);
    });
    const suggestions = await generateSuggestions(user, [], personalHistory, {
      personalHistory: true,
      communityFeedback: [...communityByProgram.values()],
    });
    const session = await store.saveSession({ userId: student.userId, user, suggestions });
    return json(200, { session, suggestions });
  } catch (error) {
    return respondError(error, 'student match');
  }
};
