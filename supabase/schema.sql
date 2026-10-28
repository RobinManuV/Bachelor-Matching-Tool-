-- Bachelor Matching Tool: sesiones, datos de contacto y resultados.
-- El catálogo de 229 carreras sigue versionado en lib/careers-data.json.

create table if not exists public.matching_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  consented_at timestamptz not null,

  first_name text not null check (char_length(first_name) between 2 and 500),
  last_name text not null check (char_length(last_name) between 2 and 500),
  email text not null check (char_length(email) between 5 and 320),
  phone text not null check (char_length(phone) between 2 and 500),
  school text not null check (char_length(school) between 2 and 500),
  origin_city text not null check (char_length(origin_city) between 2 and 500),
  origin_country text not null check (char_length(origin_country) between 2 and 500),

  selected_area text not null check (selected_area in (
    'ciencias',
    'tecnologia_y_programacion',
    'business',
    'ciencias_de_la_salud',
    'ingenierias',
    'ciencias_sociales',
    'artes'
  )),
  academic_system text not null,
  academic_subjects jsonb not null default '[]'::jsonb
    check (jsonb_typeof(academic_subjects) = 'array'),
  questionnaire jsonb not null
    check (jsonb_typeof(questionnaire) = 'object'),

  recommendation_source text not null
    check (recommendation_source in ('ai', 'fallback')),
  recommendation_model text,
  recommendations jsonb not null
    check (jsonb_typeof(recommendations) = 'array')
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 160),
  normalized_name text not null unique,
  access_code text not null unique,
  status text not null default 'approved' check (status in ('approved', 'disabled'))
);

alter table public.matching_sessions
  add column if not exists school_id uuid references public.schools(id) on delete set null;

create table if not exists public.school_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_name text not null check (char_length(school_name) between 2 and 160),
  contact_name text not null check (char_length(contact_name) between 2 and 160),
  job_title text not null check (char_length(job_title) between 2 and 160),
  corporate_email text not null check (char_length(corporate_email) between 5 and 320),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null
);

create unique index if not exists school_applications_pending_email_idx
  on public.school_applications (lower(corporate_email)) where status = 'pending';

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('robin', 'school')),
  school_id uuid references public.schools(id) on delete restrict,
  check ((role = 'robin' and school_id is null) or (role = 'school' and school_id is not null))
);

create index if not exists matching_sessions_created_at_idx
  on public.matching_sessions (created_at desc);
create index if not exists matching_sessions_email_idx
  on public.matching_sessions (lower(email));
create index if not exists matching_sessions_selected_area_idx
  on public.matching_sessions (selected_area);
create index if not exists matching_sessions_school_id_idx
  on public.matching_sessions (school_id, created_at desc);

alter table public.matching_sessions enable row level security;
alter table public.schools enable row level security;
alter table public.school_applications enable row level security;
alter table public.admin_profiles enable row level security;

-- La web nunca accede directamente a esta tabla. Solo la Function de Netlify,
-- mediante SUPABASE_SECRET_KEY, puede leer o escribir. No se crean políticas
-- públicas y se retiran explícitamente los permisos de las claves de cliente.
revoke all on table public.matching_sessions from anon, authenticated;
revoke all on table public.schools from anon, authenticated;
revoke all on table public.school_applications from anon, authenticated;
revoke all on table public.admin_profiles from anon, authenticated;
grant all on table public.matching_sessions to service_role;
grant all on table public.schools to service_role;
grant all on table public.school_applications to service_role;
grant all on table public.admin_profiles to service_role;
