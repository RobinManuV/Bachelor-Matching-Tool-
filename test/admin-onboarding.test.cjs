const test = require('node:test');
const assert = require('node:assert/strict');

let profile;
let updatedUserId;
let updateCount = 0;
const adminClient = {
  auth: { getUser: async () => ({ data: { user: { id: 'school-admin-1' } }, error: null }) },
  from(table) {
    assert.equal(table, 'admin_profiles');
    return {
      select(fields) { assert.match(fields, /onboarding_completed_at/); return this; },
      update(values) { this.values = values; return this; },
      eq(column, value) {
        assert.equal(column, 'user_id');
        if (this.values) {
          updatedUserId = value;
          updateCount++;
          profile.onboarding_completed_at = this.values.onboarding_completed_at;
          return Promise.resolve({ error: null });
        }
        assert.equal(value, 'school-admin-1');
        return this;
      },
      single() { return Promise.resolve({ data: profile, error: null }); },
    };
  },
};
const clientsPath = require.resolve('../lib/supabase-clients');
require.cache[clientsPath] = {
  id: clientsPath, filename: clientsPath, loaded: true,
  exports: { getAdminClient: () => adminClient, getPublicClient: () => ({}) },
};
const { handler } = require('../netlify/functions/admin.cjs');
const event = () => ({
  httpMethod: 'POST', queryStringParameters: { route: 'onboarding/complete' },
  headers: { authorization: 'Bearer test-token' }, body: '{}',
});

test('el tutorial se completa en el perfil del administrador del colegio', async () => {
  profile = { user_id: 'school-admin-1', role: 'school', onboarding_completed_at: null };
  updatedUserId = null; updateCount = 0;
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  assert.equal(updatedUserId, 'school-admin-1');
  assert.equal(updateCount, 1);
  assert.ok(Date.parse(JSON.parse(response.body).onboarding_completed_at));

  const second = await handler(event());
  assert.equal(second.statusCode, 200);
  assert.equal(JSON.parse(second.body).onboarding_completed_at, profile.onboarding_completed_at);
  assert.equal(updateCount, 1);
});

test('el administrador Robin no puede completar el tutorial de un colegio', async () => {
  profile = { user_id: 'school-admin-1', role: 'robin', onboarding_completed_at: null };
  updateCount = 0;
  const response = await handler(event());
  assert.equal(response.statusCode, 403);
  assert.equal(updateCount, 0);
});
