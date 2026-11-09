const test = require('node:test');
const assert = require('node:assert/strict');

test('la consulta interna exige la clave y devuelve el total y las sesiones del correo', async () => {
  const { createHandler } = require('../netlify/functions/recommender-sessions.cjs');
  let queriedEmail;
  const handler = createHandler({
    secret: 'shared-secret',
    listSessions: async (email) => {
      queriedEmail = email;
      return { count: 2, sessions: [{ id: 'session-1', created_at: '2026-11-09T12:00:00Z' }] };
    },
  });
  const event = (secret) => ({ httpMethod: 'GET', headers: { 'x-robin-lead-secret': secret }, queryStringParameters: { email: '  TEST@Example.com ' } });
  assert.equal((await handler(event('wrong'))).statusCode, 401);
  const response = await handler(event('shared-secret'));
  assert.equal(response.statusCode, 200);
  assert.equal(queriedEmail, 'test@example.com');
  assert.deepEqual(JSON.parse(response.body), { count: 2, sessions: [{ id: 'session-1', created_at: '2026-11-09T12:00:00Z' }] });
});
