const { timingSafeEqual } = require('node:crypto');
const { getAdminClient } = require('../../lib/supabase-clients');

function json(statusCode, value) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(value) };
}

async function listSessions(email) {
  const { data, count, error } = await getAdminClient().from('matching_sessions')
    .select('id,created_at', { count: 'exact' })
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return { count: count || 0, sessions: data || [] };
}

function createHandler({ secret = process.env.ROBIN_CRM_LEAD_SECRET, listSessions: query = listSessions } = {}) {
  return async (event) => {
    if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });
    if (!secret) return json(503, { error: 'service_unavailable' });
    const provided = String(event.headers?.['x-robin-lead-secret'] || event.headers?.['X-Robin-Lead-Secret'] || '');
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return json(401, { error: 'unauthorized' });
    const email = String(event.queryStringParameters?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 320) return json(400, { error: 'invalid_email' });
    try {
      return json(200, await query(email));
    } catch (error) {
      console.error('recommender-sessions:', error.message);
      return json(500, { error: 'lookup_failed' });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
