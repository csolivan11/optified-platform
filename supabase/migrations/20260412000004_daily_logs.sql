-- ─────────────────────────────────────────────────────────────
-- 00004 — Self-reported daily wellness data (non-PHI)
-- ─────────────────────────────────────────────────────────────
-- This is consumer wellness data (weight, steps, mood, etc.)
-- that clients self-report. In a non-covered-entity context, this
-- is legally analogous to a Fitbit / MyFitnessPal log.
--
-- NOTE: fasting_glucose is intentionally excluded here. When
-- added post-beta, it goes in phi_stub.glucose_readings.

create table public.daily_logs (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  date            date not null,

  -- Body measurements (self-entered)
  weight_lbs      numeric(5,1) check (weight_lbs > 0 and weight_lbs < 1000),
  waist_inches    numeric(4,1) check (waist_inches > 0 and waist_inches < 100),

  -- Activity
  steps           int check (steps >= 0),

  -- Sleep
  sleep_hours     numeric(3,1) check (sleep_hours >= 0 and sleep_hours < 24),

  -- Subjective scores (1–10 scales)
  mood_score      int check (mood_score between 1 and 10),
  energy_score    int check (energy_score between 1 and 10),
  hunger_score    int check (hunger_score between 1 and 10),

  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (client_id, date)
);

create index idx_daily_logs_client_date on public.daily_logs(client_id, date desc);

create trigger trg_daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.tg_set_updated_at();

comment on table public.daily_logs is
  'Self-reported daily wellness data. NOT PHI in non-covered-entity context.';
