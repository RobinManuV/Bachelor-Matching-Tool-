const { getAdminClient } = require('../lib/supabase-clients');
const { ROBIN_ADMIN_EMAILS } = require('../lib/admin-access');

async function main() {
  const password = String(process.env.ROBIN_ADMIN_INITIAL_PASSWORD || '');
  if (!password) throw new Error('Configura ROBIN_ADMIN_INITIAL_PASSWORD antes de ejecutar este script');
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  for (const email of ROBIN_ADMIN_EMAILS) {
    let user = data.users.find((entry) => entry.email?.toLowerCase() === email);
    if (user) {
      const updated = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
      if (updated.error) throw updated.error;
      user = updated.data.user;
    } else {
      const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: 'robin' } });
      if (created.error) throw created.error;
      user = created.data.user;
    }
    const profile = await supabase.from('admin_profiles').upsert({ user_id: user.id, email, full_name: email.split('@')[0], role: 'robin', school_id: null });
    if (profile.error) throw profile.error;
    console.log(`Administrador preparado: ${email}`);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
