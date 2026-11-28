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

create table if not exists public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  matching_session_id uuid not null references public.matching_sessions(id) on delete cascade,
  program_code text not null check (char_length(program_code) between 2 and 160),
  decision text not null check (decision in ('approved', 'rejected')),
  unique (matching_session_id, program_code)
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
  onboarding_completed_at timestamptz,
  check ((role = 'robin' and school_id is null) or (role = 'school' and school_id is not null))
);

alter table public.admin_profiles
  add column if not exists onboarding_completed_at timestamptz;

create index if not exists matching_sessions_created_at_idx
  on public.matching_sessions (created_at desc);
create index if not exists matching_sessions_email_idx
  on public.matching_sessions (lower(email));
create index if not exists matching_sessions_selected_area_idx
  on public.matching_sessions (selected_area);
create index if not exists matching_sessions_school_id_idx
  on public.matching_sessions (school_id, created_at desc);
create index if not exists recommendation_feedback_program_idx
  on public.recommendation_feedback (program_code, decision);
create index if not exists recommendation_feedback_created_at_idx
  on public.recommendation_feedback (created_at desc);

alter table public.matching_sessions enable row level security;
alter table public.recommendation_feedback enable row level security;
alter table public.schools enable row level security;
alter table public.school_applications enable row level security;
alter table public.admin_profiles enable row level security;

-- La web nunca accede directamente a esta tabla. Solo la Function de Netlify,
-- mediante SUPABASE_SECRET_KEY, puede leer o escribir. No se crean políticas
-- públicas y se retiran explícitamente los permisos de las claves de cliente.
revoke all on table public.matching_sessions from anon, authenticated;
revoke all on table public.recommendation_feedback from anon, authenticated;
revoke all on table public.schools from anon, authenticated;
revoke all on table public.school_applications from anon, authenticated;
revoke all on table public.admin_profiles from anon, authenticated;
grant all on table public.matching_sessions to service_role;
grant all on table public.recommendation_feedback to service_role;
grant all on table public.schools to service_role;
grant all on table public.school_applications to service_role;
grant all on table public.admin_profiles to service_role;
alter table public.matching_sessions
  add column if not exists student_user_id uuid references auth.users(id) on delete set null;

create index if not exists matching_sessions_student_user_id_idx
  on public.matching_sessions (student_user_id, created_at desc)
  where student_user_id is not null;

create table if not exists public.student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  consent_status text not null default 'pending_guardian'
    check (consent_status in ('active', 'pending_guardian')),
  consented_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (consent_status <> 'active' or (consented_at is not null and consent_version is not null))
);

create table if not exists public.student_guardian_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  guardian_email text not null check (char_length(guardian_email) between 5 and 320),
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.student_recommendation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  selected_areas text[] not null check (cardinality(selected_areas) > 0),
  academic_system text not null,
  academic_subjects jsonb not null default '[]'::jsonb
    check (jsonb_typeof(academic_subjects) = 'array'),
  questionnaire jsonb not null check (jsonb_typeof(questionnaire) = 'object'),
  recommendation_source text not null check (recommendation_source in ('ai', 'fallback')),
  recommendation_model text,
  recommendations jsonb not null check (jsonb_typeof(recommendations) = 'array'),
  unique (id, user_id)
);

create table if not exists public.student_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  program_code text not null check (char_length(program_code) between 2 and 160),
  decision text not null check (decision in ('approved', 'rejected')),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, program_code),
  foreign key (session_id, user_id)
    references public.student_recommendation_sessions(id, user_id) on delete cascade
);

create table if not exists public.career_feedback_contributions (
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_hash text not null check (char_length(participant_hash) = 64),
  area text not null check (area in (
    'ciencias', 'tecnologia_y_programacion', 'business', 'ciencias_de_la_salud',
    'ingenierias', 'ciencias_sociales', 'artes'
  )),
  program_code text not null check (char_length(program_code) between 2 and 160),
  decision text not null check (decision in ('approved', 'rejected')),
  positive_terms text[] not null default '{}',
  negative_terms text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, area, program_code),
  check (cardinality(positive_terms) <= 12),
  check (cardinality(negative_terms) <= 12)
);

create index if not exists student_recommendation_sessions_user_created_idx
  on public.student_recommendation_sessions (user_id, created_at desc);
create index if not exists student_recommendation_feedback_area_program_idx
  on public.student_recommendation_feedback (program_code, decision);

create index if not exists career_feedback_contributions_area_hash_idx
  on public.career_feedback_contributions (area, participant_hash);
create index if not exists career_feedback_contributions_area_program_idx
  on public.career_feedback_contributions (area, program_code);

alter table public.student_profiles enable row level security;
alter table public.student_guardian_consents enable row level security;
alter table public.student_recommendation_sessions enable row level security;
alter table public.student_recommendation_feedback enable row level security;
alter table public.career_feedback_contributions enable row level security;

drop policy if exists student_profiles_select_own on public.student_profiles;
create policy student_profiles_select_own on public.student_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists student_guardian_consents_select_own on public.student_guardian_consents;
create policy student_guardian_consents_select_own on public.student_guardian_consents
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists student_recommendation_sessions_select_own on public.student_recommendation_sessions;
create policy student_recommendation_sessions_select_own on public.student_recommendation_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists student_recommendation_feedback_select_own on public.student_recommendation_feedback;
create policy student_recommendation_feedback_select_own on public.student_recommendation_feedback
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.student_profiles from anon, authenticated;
revoke all on table public.student_guardian_consents from anon, authenticated;
revoke all on table public.student_recommendation_sessions from anon, authenticated;
revoke all on table public.student_recommendation_feedback from anon, authenticated;
revoke all on table public.career_feedback_contributions from anon, authenticated;
grant select on table public.student_profiles to authenticated;
grant select on table public.student_guardian_consents to authenticated;
grant select on table public.student_recommendation_sessions to authenticated;
grant select on table public.student_recommendation_feedback to authenticated;
grant all on table public.student_profiles to service_role;
grant all on table public.student_guardian_consents to service_role;
grant all on table public.student_recommendation_sessions to service_role;
grant all on table public.student_recommendation_feedback to service_role;
grant all on table public.career_feedback_contributions to service_role;
