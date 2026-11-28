const crypto = require('node:crypto');
const store = require('./student-store.cjs');

const AREAS = new Set([
  'ciencias', 'tecnologia_y_programacion', 'business', 'ciencias_de_la_salud',
  'ingenierias', 'ciencias_sociales', 'artes',
]);
const MIN_PARTICIPANTS = 5;

function participantKey(source, value) {
  const secret = String(process.env.SUPABASE_SECRET_KEY || 'community-feedback');
  return crypto.createHmac('sha256', secret).update(`${source}:${String(value).trim().toLowerCase()}`).digest('hex');
}

function loadWebVotes(area) {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const secret = String(process.env.SUPABASE_SECRET_KEY || '');
  if (!url || !secret) return Promise.resolve([]);
  const params = new URLSearchParams({
    select: 'program_code,decision,created_at,matching_session_id,matching_sessions!inner(email,selected_area,student_user_id)',
    'matching_sessions.selected_area': `eq.${area}`,
    order: 'created_at.desc',
    limit: '5000',
  });
  return fetch(`${url}/rest/v1/recommendation_feedback?${params}`, { headers: { apikey: secret } })
    .then(async (response) => {
      const rows = await response.json().catch(() => []);
      if (!response.ok || !Array.isArray(rows)) throw new Error(`HTTP ${response.status}`);
      return rows.map((row) => ({
        program_code: row.program_code,
        decision: row.decision,
        email_key: row.matching_sessions?.email ? participantKey('email', row.matching_sessions.email) : '',
        student_user_id: row.matching_sessions?.student_user_id || null,
        created_at: row.created_at,
        positive_terms: [],
        negative_terms: [],
      }));
    });
}

function buildCommunityStats(webFeedback, appContributions, area) {
  const programs = new Map();
  const appRows = Array.isArray(appContributions) ? appContributions : [];
  const accountByEmail = new Map(appRows.filter((entry) => entry.participant_hash && entry.user_id)
    .map((entry) => [entry.participant_hash, participantKey('account', entry.user_id)]));
  const add = (entry, source) => {
    const programCode = String(entry?.program_code || '');
    const decision = String(entry?.decision || '');
    const participant = String(entry?.participant_key || (entry?.user_id ? participantKey('account', entry.user_id) : ''));
    if (!programCode || !['approved', 'rejected'].includes(decision) || !participant) return;
    if (!programs.has(programCode)) programs.set(programCode, {
      participants: new Set(),
      votes: new Map(),
      positiveTerms: new Map(),
      negativeTerms: new Map(),
    });
    const group = programs.get(programCode);
    if (group.participants.has(participant)) return;
    group.participants.add(participant);
    group.votes.set(decision, (group.votes.get(decision) || 0) + 1);
    for (const [terms, target] of [[entry.positive_terms, group.positiveTerms], [entry.negative_terms, group.negativeTerms]]) {
      for (const term of new Set((Array.isArray(terms) ? terms : []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))) {
        target.set(term, (target.get(term) || 0) + 1);
      }
    }
  };
  const webRows = (Array.isArray(webFeedback) ? webFeedback : []).map((entry) => ({
    ...entry,
    participant_key: entry.student_user_id
      ? participantKey('account', entry.student_user_id)
      : accountByEmail.get(entry.email_key) || entry.email_key || participantKey('web-session', entry.matching_session_id),
  }));
  const ordered = [...webRows, ...appRows].sort((a, b) => {
    const timeA = Date.parse(a.updated_at || a.created_at || '') || 0;
    const timeB = Date.parse(b.updated_at || b.created_at || '') || 0;
    return timeB - timeA;
  });
  ordered.forEach((entry) => add(entry, 'app'));

  return [...programs.entries()]
    .filter(([, group]) => group.participants.size >= MIN_PARTICIPANTS)
    .map(([program_code, group]) => ({
      program_code,
      area,
      approved_count: group.votes.get('approved') || 0,
      rejected_count: group.votes.get('rejected') || 0,
      participant_count: group.participants.size,
      positive_terms: [...group.positiveTerms.entries()].filter(([, count]) => count >= MIN_PARTICIPANTS).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([term]) => term),
      negative_terms: [...group.negativeTerms.entries()].filter(([, count]) => count >= MIN_PARTICIPANTS).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([term]) => term),
    }));
}

async function loadCommunityFeedback(area) {
  if (!AREAS.has(area)) return [];
  try {
    const [webFeedback, appContributions] = await Promise.all([
      loadWebVotes(area),
      store.listCommunityContributions(area),
    ]);
    return buildCommunityStats(webFeedback, appContributions, area);
  } catch (error) {
    console.error('community feedback:', error.message);
    return [];
  }
}

module.exports = { MIN_PARTICIPANTS, participantKey, buildCommunityStats, loadCommunityFeedback };
