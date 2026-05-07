-- ─────────────────────────────────────────────────────────────
-- 00003 — Protocols: supplements, exercise, nutrition
-- ─────────────────────────────────────────────────────────────

-- ─── supplements (master catalog) ───────────────────────────
-- Shared across all clients. Admin-managed.
create table public.supplements (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null unique,
  category        text,
  default_dose    text,
  notes           text,  -- general notes: timing, interactions, evidence
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_supplements_updated_at
  before update on public.supplements
  for each row execute function public.tg_set_updated_at();

-- ─── client_supplements ─────────────────────────────────────
-- What this specific client has been prescribed.
create table public.client_supplements (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references public.profiles(id) on delete cascade,
  supplement_id     uuid not null references public.supplements(id) on delete restrict,
  dose              text not null,           -- "400mg"
  frequency         text not null,           -- "Nightly", "2x Daily"
  protocol_name     text,                    -- "Sleep Optimization"
  start_date        date not null default current_date,
  end_date          date,
  active            boolean not null default true,
  prescribed_by     uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_client_supplements_client on public.client_supplements(client_id) where active = true;

create trigger trg_client_supplements_updated_at
  before update on public.client_supplements
  for each row execute function public.tg_set_updated_at();

-- ─── supplement_adherence ───────────────────────────────────
-- Per-day adherence log. One row per client_supplement per day.
create type public.adherence_source as enum (
  'manual',       -- client ticked the box in-app
  'sms_reply',    -- future: client replied to evening SMS
  'auto'          -- future: inferred from other signals
);

create table public.supplement_adherence (
  id                      uuid primary key default uuid_generate_v4(),
  client_supplement_id    uuid not null references public.client_supplements(id) on delete cascade,
  date                    date not null,
  taken                   boolean not null,
  recorded_at             timestamptz not null default now(),
  recorded_via            public.adherence_source not null default 'manual',
  unique (client_supplement_id, date)
);

create index idx_adherence_supp_date on public.supplement_adherence(client_supplement_id, date desc);

-- ─── client_exercise_protocols ──────────────────────────────
create table public.client_exercise_protocols (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  activity      text not null,           -- "Resistance Training"
  frequency     text not null,           -- "3x per week"
  duration      text,                    -- "45 mins"
  notes         text,
  active        boolean not null default true,
  prescribed_by uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_exercise_protocols_client on public.client_exercise_protocols(client_id) where active = true;

create trigger trg_exercise_protocols_updated_at
  before update on public.client_exercise_protocols
  for each row execute function public.tg_set_updated_at();

-- ─── client_nutrition_targets ───────────────────────────────
create table public.client_nutrition_targets (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references public.profiles(id) on delete cascade,
  diet_template     text,                    -- "Low Carb"
  calories          int check (calories >= 0),
  protein_servings  int check (protein_servings >= 0),
  carb_servings     int check (carb_servings >= 0),
  fat_servings      int check (fat_servings >= 0),
  veg_servings      int check (veg_servings >= 0),
  fruit_servings    int check (fruit_servings >= 0),
  fiber_grams       int check (fiber_grams >= 0),
  effective_from    date not null default current_date,
  effective_until   date,
  prescribed_by     uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from)
);

create index idx_nutrition_client on public.client_nutrition_targets(client_id, effective_from desc);
