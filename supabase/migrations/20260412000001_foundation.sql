-- ─────────────────────────────────────────────────────────────
-- 00001 — Foundation: extensions, security helpers, profiles
-- ─────────────────────────────────────────────────────────────

-- Required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";  -- case-insensitive email comparisons

-- ─── Security helper schema ─────────────────────────────────
-- We put helper functions in a dedicated `security` schema so RLS
-- policies remain readable (`security.is_admin()` vs inline EXISTS clauses).
create schema if not exists security;
grant usage on schema security to authenticated, anon, service_role;

-- ─── PHI stub schema ────────────────────────────────────────
-- Future PHI tables live here, gated off from app code in beta.
-- When PHI infra lands, either: (a) these tables stay here and
-- Supabase gets enterprise BAA, or (b) they migrate to AWS RDS.
-- Either way, the application's repository-layer boundary is the
-- only place that changes.
create schema if not exists phi_stub;
grant usage on schema phi_stub to service_role;  -- authenticated explicitly excluded

-- ─── Role enum ──────────────────────────────────────────────
create type public.user_role as enum ('client', 'coach', 'admin');

-- ─── profiles ───────────────────────────────────────────────
-- Extends auth.users with app-level fields. Every auth user has one profile.
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          public.user_role not null default 'client',
  email         citext not null unique,
  first_name    text,
  last_name     text,
  display_name  text,
  avatar_url    text,
  timezone      text default 'America/New_York',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Application-level user profile. Extends auth.users.';
comment on column public.profiles.role is 'Single role per user for beta. See migration docs for future multi-role plan.';

create index idx_profiles_role on public.profiles(role);

-- ─── coach_assignments ──────────────────────────────────────
-- Maps coaches to their clients. Supports historical tracking (unassigned_at)
-- and a primary-coach concept for when multi-coach teams are introduced.
create table public.coach_assignments (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  coach_id        uuid not null references public.profiles(id) on delete restrict,
  is_primary      boolean not null default true,
  assigned_at     timestamptz not null default now(),
  unassigned_at   timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.coach_assignments is 'Maps coaches to clients. unassigned_at=null means currently active.';

create index idx_coach_assignments_client on public.coach_assignments(client_id) where unassigned_at is null;
create index idx_coach_assignments_coach on public.coach_assignments(coach_id) where unassigned_at is null;

-- Enforce: only one primary coach per client at a time
create unique index idx_coach_assignments_one_primary_per_client
  on public.coach_assignments(client_id)
  where is_primary = true and unassigned_at is null;

-- ─── Updated-at trigger helper ──────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ─── Security helpers ───────────────────────────────────────
-- These are the reusable predicates RLS policies call.

-- Returns true if the caller has the given role.
create or replace function security.has_role(_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = _role
  );
$$;

-- Returns true if caller is an admin.
create or replace function security.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select security.has_role('admin');
$$;

-- Returns true if caller is a coach (or admin — admins have all coach powers).
create or replace function security.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('coach', 'admin')
  );
$$;

-- Returns true if caller is a coach currently assigned to the given client.
-- Admins pass this check automatically.
create or replace function security.is_coach_of(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    security.is_admin()
    or exists (
      select 1 from public.coach_assignments
      where coach_id = auth.uid()
        and client_id = _client_id
        and unassigned_at is null
    );
$$;

-- Returns true if caller is the client themselves OR a coach assigned to them OR an admin.
create or replace function security.can_access_client(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = _client_id
    or security.is_coach_of(_client_id);
$$;

grant execute on all functions in schema security to authenticated;

-- ─── Auto-create profile on auth signup ─────────────────────
-- When Supabase Auth creates a user, mirror into public.profiles.
-- The admin invite flow (Phase 3) will then update the role appropriately.
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    -- Default new signups to 'client'. Admin-created accounts will override this
    -- via the invite flow in Phase 3.
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();
