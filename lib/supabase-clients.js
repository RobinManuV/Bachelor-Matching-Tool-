const { createClient } = require('@supabase/supabase-js');

let adminClient;

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} no configurada`);
  return value;
}

function client(key) {
  return createClient(required('SUPABASE_URL'), key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function getAdminClient() {
  if (!adminClient) adminClient = client(required('SUPABASE_SECRET_KEY'));
  return adminClient;
}

function getPublicClient() {
  return client(required('SUPABASE_PUBLISHABLE_KEY'));
}

module.exports = { getAdminClient, getPublicClient };
