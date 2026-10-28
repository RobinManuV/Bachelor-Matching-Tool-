const fs = require('node:fs');
const path = require('node:path');
const postgres = require('postgres');
const { createClient } = require('@supabase/supabase-js');
const { ROBIN_ADMIN_EMAILS, schoolPassword } = require('../lib/admin-access');

const ROOT = path.resolve(__dirname, '..');
const DEMO_SCHOOL = {
  name: 'Colegio Demo',
  email: 'colegio.demo@project-robin.com',
};

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} no configurada para el despliegue`);
  return value;
}

async function existingUsers(supabase) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function ensureUser(supabase, users, { email, password, metadata }) {
  const current = users.find((user) => user.email?.toLowerCase() === email);
  if (current) return current;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw error || new Error(`No se pudo crear ${email}`);
  users.push(data.user);
  return data.user;
}

async function main() {
  const databaseUrl = required('SUPABASE_DB_URL');
  const supabaseUrl = required('SUPABASE_URL');
  const secretKey = required('SUPABASE_SECRET_KEY');
  const robinPassword = required('ROBIN_ADMIN_INITIAL_PASSWORD');
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: databaseUrl.includes('localhost') ? false : 'require',
  });

  try {
    await sql.unsafe(fs.readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf8'));

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const users = await existingUsers(supabase);
    for (const email of ROBIN_ADMIN_EMAILS) {
      await ensureUser(supabase, users, {
        email,
        password: robinPassword,
        metadata: { role: 'robin' },
      });
    }
    await ensureUser(supabase, users, {
      email: DEMO_SCHOOL.email,
      password: schoolPassword(DEMO_SCHOOL.name),
      metadata: { role: 'school' },
    });

    await sql.unsafe(fs.readFileSync(path.join(ROOT, 'supabase/seed.sql'), 'utf8'));
    const [roles] = await sql`
      select count(*)::int as count
      from public.admin_profiles
      where email in (
        'manuel@project-robin.com',
        'noel@project-robin.com',
        'maria@project-robin.com',
        'colegio.demo@project-robin.com'
      )
    `;
    if (roles.count !== 4) throw new Error('No se han preparado los cuatro accesos iniciales');
    console.log('Base de datos y accesos iniciales preparados.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(`Preparación del despliegue: ${error.message}`);
  process.exitCode = 1;
});
