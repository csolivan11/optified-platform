-- ─────────────────────────────────────────────────────────────
-- 00005 — Wearable integrations
-- ─────────────────────────────────────────────────────────────

-- ─── Wearable provider enum ─────────────────────────────────
create type public.wearable_provider as enum (
  'oura',
  'whoop',
  'garmin',
  'apple_health',
  'fitbit'
);

create type public.wearable_connection_status as enum (
  'active',
  'expired',
  'revoked'
);

-- ─── wearable_connections ───────────────────────────────────
-- OAuth credentials for the connection between a client and a wearable provider.
-- Tokens are stored at the application level; in production these should
-- additionally be encrypted via a column-level encryption scheme when PHI
-- moves to a BAA-backed store. For beta non-PHI scope, Supabase's at-rest
-- encryption is the security floor.
create table public.wearable_connections (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references public.profiles(id) on delete cascade,
  provider          public.wearable_provider not null,
  access_token      text,                                 -- OAuth2 access token
  refresh_token     text,                                 -- OAuth2 refresh token
  expires_at        timestamptz,
  provider_user_id  text,                                 -- external ID returned by the provider
  scope             text,                                 -- granted scopes
  connected_at      timestamptz not null default now(),
  last_sync_at      timestamptz,
  status            public.wearable_connection_status not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (client_id, provider)
);

create index idx_wearable_conn_client on public.wearable_connections(client_id);
create index idx_wearable_conn_active on public.wearable_connections(client_id) where status = 'active';

create trigger trg_wearable_conn_updated_at
  before update on public.wearable_connections
  for each row execute function public.tg_set_updated_at();

comment on column public.wearable_connections.access_token is
  'OAuth2 access token. Consider column-level encryption in production.';

-- ─── wearable_data_points ───────────────────────────────────
-- Generic store for any metric from any wearable. Designed so that adding
-- a new provider (Whoop, Garmin, etc.) requires zero schema changes.
create table public.wearable_data_points (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  provider      public.wearable_provider not null,
  metric        text not null,         -- 'hrv_rmssd', 'resting_hr', 'sleep_deep_min', etc.
  value         numeric not null,
  unit          text,                  -- 'ms', 'bpm', 'min', etc.
  recorded_at   timestamptz not null,
  raw_payload   jsonb,                 -- optional: store the original provider payload for debugging
  created_at    timestamptz not null default now()
);

-- Primary query pattern: get last N days of metric M for client C
create index idx_wearable_data_client_metric_time
  on public.wearable_data_points(client_id, metric, recorded_at desc);

-- Dedup guard: same client + metric + timestamp should never be inserted twice
-- (allow different providers to report the same metric though — they'll
-- have different semantics and the app layer picks a source-of-truth).
create unique index idx_wearable_data_dedup
  on public.wearable_data_points(client_id, provider, metric, recorded_at);

comment on table public.wearable_data_points is
  'Generic time-series for any wearable metric. Source-of-truth per metric is resolved in the application layer.';
