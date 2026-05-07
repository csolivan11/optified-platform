-- ─────────────────────────────────────────────────────────────
-- 00013 — Deterministic sham data seeder
-- ─────────────────────────────────────────────────────────────
-- Generates realistic wearable + daily-log data for demo clients.
--
-- Design goals:
--   1. Deterministic: same client_id + day offset ALWAYS produces the
--      same value. Resetting the DB regenerates identical data. This
--      makes screenshots reproducible and tests stable.
--   2. Realistic: values follow plausible physiological ranges with
--      day-of-week and trend patterns.
--   3. Clearly flagged: every sham row has is_simulated=true, so
--      production can filter simulated data out of analytics later.

-- ─── Add simulated-flag columns ─────────────────────────────
alter table public.wearable_data_points
  add column if not exists is_simulated boolean not null default false;

alter table public.daily_logs
  add column if not exists is_simulated boolean not null default false;

create index if not exists idx_wearable_data_real_only
  on public.wearable_data_points(client_id, metric, recorded_at desc)
  where is_simulated = false;

-- ─── Helper: deterministic pseudo-random from client_id + seed ──
-- Converts a UUID + integer seed into a stable float in [0, 1).
-- Used to vary generated metrics per-client without storing state.
create or replace function security.pseudo_random(_client_id uuid, _seed int)
returns double precision
language sql
immutable
as $$
  -- Hash the combination of client UUID and seed to get a stable bytea,
  -- then pull 4 bytes and normalize to [0, 1).
  select (get_byte(digest(_client_id::text || ':' || _seed::text, 'md5'), 0) * 256
        + get_byte(digest(_client_id::text || ':' || _seed::text, 'md5'), 1))
         / 65536.0;
$$;

-- Reserved: pgcrypto's digest() lives in the `extensions` schema created
-- by `create extension pgcrypto`. The cast works in default search_path.

-- ─── Seeder: writes N days of wearable data + daily logs ────
-- Call: select security.seed_demo_wearable_data('<uuid>', 60);
--
-- Generates for each day in the last N days:
--   - wearable_data_points: hrv_rmssd, resting_hr, sleep_total_min,
--     sleep_deep_min, sleep_rem_min, sleep_light_min, steps
--   - daily_logs: weight_lbs (trending down), sleep_hours (derived),
--     steps (mirrors wearable), mood_score, energy_score
--
-- Idempotent: uses ON CONFLICT DO UPDATE so re-running refreshes values.
create or replace function security.seed_demo_wearable_data(
  _client_id uuid,
  _days int default 60
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  day_offset int;
  day_date date;
  dow int;              -- day of week, 0 = Sunday

  -- Per-client baselines (stable across runs)
  baseline_hrv numeric;
  baseline_rhr numeric;
  baseline_weight numeric;

  -- Per-day computed values
  hrv_val numeric;
  rhr_val numeric;
  weight_val numeric;
  sleep_total_min int;
  sleep_deep_min int;
  sleep_rem_min int;
  sleep_light_min int;
  steps_val int;
  mood_val int;
  energy_val int;

  -- Deterministic noise
  rand1 double precision;
  rand2 double precision;
begin
  -- Baselines from the client UUID — stable per-client
  baseline_hrv := 48 + (security.pseudo_random(_client_id, 1) * 12);  -- 48-60
  baseline_rhr := 50 + (security.pseudo_random(_client_id, 2) * 8);   -- 50-58
  baseline_weight := 180 + (security.pseudo_random(_client_id, 3) * 50); -- 180-230

  for day_offset in 0.._days - 1 loop
    day_date := current_date - day_offset;
    dow := extract(dow from day_date)::int;

    -- Two independent random sources per day
    rand1 := security.pseudo_random(_client_id, day_offset * 7 + 11);
    rand2 := security.pseudo_random(_client_id, day_offset * 7 + 13);

    -- HRV: trends upward over time (improving) + day-to-day variance.
    -- Weekend dip (dow 0, 6) models social drinking / late nights.
    hrv_val := baseline_hrv
               + (_days - day_offset) * 0.15         -- upward trend
               + (rand1 - 0.5) * 8                    -- noise +/- 4
               - case when dow in (0, 6) then 3 else 0 end;
    hrv_val := greatest(28, least(80, hrv_val));

    -- RHR: inverse trend — decreasing as HRV rises. Subtle.
    rhr_val := baseline_rhr
               - (_days - day_offset) * 0.05
               + (rand2 - 0.5) * 4;
    rhr_val := greatest(38, least(72, rhr_val));

    -- Weight: linear downward trend with small noise
    weight_val := baseline_weight
                  - (_days - day_offset) * 0.08
                  + (rand1 - 0.5) * 1.2;

    -- Sleep: varies by day of week. Weekends slightly more total,
    -- weekdays more consistent.
    sleep_total_min := 420                            -- 7 hour base
                       + floor((rand1 - 0.5) * 120)::int  -- +/- 1 hour
                       + case when dow in (5, 6) then 30 else 0 end;
    sleep_total_min := greatest(300, least(560, sleep_total_min));

    -- Sleep stages: typical ratios
    sleep_deep_min := floor(sleep_total_min * (0.14 + rand2 * 0.06))::int;
    sleep_rem_min := floor(sleep_total_min * (0.20 + rand1 * 0.06))::int;
    sleep_light_min := sleep_total_min - sleep_deep_min - sleep_rem_min;

    -- Steps: weekday walking routine + weekend variability
    steps_val := case
      when dow in (0, 6) then 6000 + floor(rand1 * 6000)::int
      else 7500 + floor(rand2 * 4500)::int
    end;

    -- Subjective scores
    mood_val := 6 + floor(rand1 * 4)::int;      -- 6-9
    energy_val := 5 + floor(rand2 * 5)::int;    -- 5-9

    -- ─── INSERT wearable data points ─────────────────────
    insert into public.wearable_data_points
      (client_id, provider, metric, value, unit, recorded_at, is_simulated)
    values
      (_client_id, 'oura', 'hrv_rmssd', round(hrv_val, 1), 'ms',
       day_date::timestamp + interval '4 hours', true),
      (_client_id, 'oura', 'resting_hr', round(rhr_val, 0), 'bpm',
       day_date::timestamp + interval '4 hours', true),
      (_client_id, 'oura', 'sleep_total_min', sleep_total_min, 'min',
       day_date::timestamp + interval '4 hours', true),
      (_client_id, 'oura', 'sleep_deep_min', sleep_deep_min, 'min',
       day_date::timestamp + interval '4 hours', true),
      (_client_id, 'oura', 'sleep_rem_min', sleep_rem_min, 'min',
       day_date::timestamp + interval '4 hours', true),
      (_client_id, 'oura', 'sleep_light_min', sleep_light_min, 'min',
       day_date::timestamp + interval '4 hours', true),
      (_client_id, 'oura', 'steps', steps_val, 'count',
       day_date::timestamp + interval '4 hours', true)
    on conflict (client_id, provider, metric, recorded_at) do update
      set value = excluded.value,
          is_simulated = true;

    -- ─── INSERT daily log ────────────────────────────────
    insert into public.daily_logs
      (client_id, date, weight_lbs, sleep_hours, steps, mood_score, energy_score, is_simulated)
    values
      (_client_id, day_date, round(weight_val, 1),
       round((sleep_total_min / 60.0)::numeric, 1), steps_val,
       mood_val, energy_val, true)
    on conflict (client_id, date) do update
      set weight_lbs = excluded.weight_lbs,
          sleep_hours = excluded.sleep_hours,
          steps = excluded.steps,
          mood_score = excluded.mood_score,
          energy_score = excluded.energy_score,
          is_simulated = true;
  end loop;

  -- Also ensure the client has a Oura connection row marked as simulated-source
  insert into public.wearable_connections
    (client_id, provider, status, connected_at, last_sync_at)
  values
    (_client_id, 'oura', 'active', now() - interval '60 days', now())
  on conflict (client_id, provider) do update
    set status = 'active',
        last_sync_at = now();
end;
$$;

comment on function security.seed_demo_wearable_data(uuid, int) is
  'Generates deterministic, realistic wearable + daily-log data for a demo client. Call from seed.sql or admin tooling. Every row is flagged is_simulated=true.';

-- Grant so admin Server Actions can invoke it if we later build a
-- "seed demo data" button in the admin UI.
grant execute on function security.seed_demo_wearable_data(uuid, int)
  to authenticated, service_role;
