-- ─────────────────────────────────────────────────────────────
-- 00006 — Functional metrics (performance benchmarks)
-- ─────────────────────────────────────────────────────────────

create type public.functional_category as enum (
  'strength',
  'endurance',
  'mobility',
  'body_comp'
);

create table public.functional_metrics (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references public.profiles(id) on delete cascade,
  metric_name       text not null,           -- "Deadlift 1RM", "Wall Sit Hold"
  category          public.functional_category not null,
  value             numeric not null,
  unit              text not null,           -- "lbs", "sec", "ml/kg/min"
  recorded_at       date not null default current_date,

  -- Target-tracking fields — baseline and target are set once per client per metric.
  -- When a new data point is added with same client_id + metric_name, the repository
  -- layer copies baseline_value and target_value forward from the previous entry
  -- unless explicitly overridden.
  baseline_value    numeric,
  target_value      numeric,
  lower_is_better   boolean not null default false,

  notes             text,
  recorded_by       uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);

create index idx_functional_client_metric
  on public.functional_metrics(client_id, metric_name, recorded_at desc);

create index idx_functional_client_category
  on public.functional_metrics(client_id, category);

comment on column public.functional_metrics.lower_is_better is
  'True for metrics like resting HR, run time, body fat %, waist circumference.';
