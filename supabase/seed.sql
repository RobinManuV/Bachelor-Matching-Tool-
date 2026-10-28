-- Datos iniciales idempotentes para el panel.
-- Las cuentas que pueden iniciar sesión se crean antes mediante Supabase Auth
-- en scripts/deploy-setup.cjs. Este archivo enlaza esas cuentas con sus roles.

insert into public.schools (
  id,
  name,
  normalized_name,
  access_code,
  status
) values (
  '00000000-0000-4000-8000-000000000001',
  'Colegio Demo',
  'colegio demo',
  'colegio-demo-2027',
  'approved'
)
on conflict (normalized_name) do update set
  name = excluded.name,
  access_code = excluded.access_code,
  status = excluded.status;

insert into public.admin_profiles (user_id, email, full_name, role, school_id)
select
  id,
  lower(email),
  case lower(email)
    when 'manuel@project-robin.com' then 'Manuel'
    when 'noel@project-robin.com' then 'Noel'
    when 'maria@project-robin.com' then 'Maria'
  end,
  'robin',
  null
from auth.users
where lower(email) in (
  'manuel@project-robin.com',
  'noel@project-robin.com',
  'maria@project-robin.com'
)
on conflict (user_id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  school_id = null;

insert into public.admin_profiles (user_id, email, full_name, role, school_id)
select
  id,
  lower(email),
  'Colegio Demo',
  'school',
  (select id from public.schools where normalized_name = 'colegio demo')
from auth.users
where lower(email) = 'colegio.demo@project-robin.com'
on conflict (user_id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  school_id = excluded.school_id;
