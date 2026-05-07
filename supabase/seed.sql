-- ─────────────────────────────────────────────────────────────
-- Local development seed data
-- ─────────────────────────────────────────────────────────────
-- Runs automatically after migrations when you `supabase db reset` locally.
-- DOES NOT run against staging or production.
--
-- Purpose: give us enough fixtures to develop and demo against without
-- manually creating records in Studio every time we reset the DB.
--
-- Convention for demo accounts (created via Studio -> Authentication):
--   admin@optified.dev         (role: admin)
--   coach@optified.dev         (role: coach)
--   samantha@optified.dev      (role: client, assigned to coach)
--
-- You must create these auth users in Supabase Studio first, then re-run
-- `supabase db reset` so this seed can reference their IDs by email.

-- ─── Programs ───────────────────────────────────────────────
insert into public.programs (id, name, tier, duration_weeks, description)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '12-Month VIP Program',
    'vip',
    52,
    'Flagship white-glove program with weekly coaching, monthly labs, and quarterly assessments.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '6-Month Foundation',
    'foundation',
    26,
    'Core health optimization program. Biweekly coaching, quarterly labs.'
  )
on conflict (id) do nothing;

-- ─── Program phases for VIP ─────────────────────────────────
insert into public.program_phases (program_id, name, sequence, description)
values
  ('11111111-1111-1111-1111-111111111111', 'Onboarding',   1, 'Intake, assessments, baseline labs'),
  ('11111111-1111-1111-1111-111111111111', 'Foundation',   2, 'Protocol implementation, habit building'),
  ('11111111-1111-1111-1111-111111111111', 'Optimization', 3, 'Data-driven protocol refinement'),
  ('11111111-1111-1111-1111-111111111111', 'Mastery',      4, 'Long-term sustainability and independence')
on conflict do nothing;

-- ─── Supplement catalog ─────────────────────────────────────
insert into public.supplements (name, category, default_dose, notes)
values
  ('Magnesium Glycinate', 'Sleep',         '400mg',   'Glycinate form supports GABA function without GI side effects of oxide. Take 30–60min before bed.'),
  ('Omega-3 (EPA/DHA)',   'Inflammation',  '2g',      'Take with largest meal of the day. Prefer triglyceride form for bioavailability.'),
  ('Berberine',           'Metabolic',     '500mg',   'Take with carb-containing meals. Hold for 1 week before labs.'),
  ('Creatine Monohydrate','Recovery',      '5g',      'Take daily, timing irrelevant. Minimum effective dose is 3g; 5g is standard.'),
  ('Vitamin D3',          'Immune',        '5000 IU', 'Take with fat-containing meal. Target serum 50–80 ng/mL.')
on conflict (name) do nothing;

-- ─── Education articles (seed content) ──────────────────────
insert into public.education_articles (slug, title, excerpt, body, category, read_time_min, published, published_at)
values
  (
    'triglyceride-hdl-ratio',
    'The Triglyceride-to-HDL Ratio',
    'A single number that predicts insulin resistance, metabolic health, and cardiovascular risk better than most individual markers.',
    '# The Triglyceride-to-HDL Ratio\n\nThis ratio is one of the most useful single numbers in a standard lipid panel. Here''s why.\n\n(Full body TBD — seed stub only)',
    'Metabolic Health',
    4,
    true,
    now()
  ),
  (
    'hrv-what-it-means',
    'HRV: What It Means and Why It Matters',
    'Understanding heart rate variability as a window into your autonomic nervous system and recovery capacity.',
    '# Heart Rate Variability\n\nHRV reflects the balance between your sympathetic ("fight or flight") and parasympathetic ("rest and digest") nervous systems.\n\n(Full body TBD)',
    'Recovery',
    6,
    true,
    now()
  )
on conflict (slug) do nothing;

-- ─── Generate 60 days of sham wearable + daily-log data ────
-- Runs for any client marked as a demo account (email ends in @optified.dev).
-- Safe to run multiple times — the seeder uses ON CONFLICT DO UPDATE.
do $$
declare
  demo_client uuid;
begin
  for demo_client in
    select id from public.profiles
    where email like '%@optified.dev' and role = 'client'
  loop
    perform security.seed_demo_wearable_data(demo_client, 60);
    perform security.seed_demo_phase4b_data(demo_client);
  end loop;
end;
$$;

-- ─── Auto-assign demo coach to all demo clients ─────────────
-- Any @optified.dev coach gets every @optified.dev client in their
-- pipeline. Keeps the coach dashboard populated after `supabase db reset`.
do $$
declare
  coach_id_var uuid;
  client_id_var uuid;
begin
  for coach_id_var in
    select id from public.profiles where email like '%@optified.dev' and role = 'coach'
  loop
    for client_id_var in
      select id from public.profiles where email like '%@optified.dev' and role = 'client'
    loop
      -- The partial unique index `idx_coach_assignments_one_primary_per_client`
      -- prevents a second primary coach while the first is active.
      -- Using a where-clause insert guard instead of on-conflict to match.
      if not exists (
        select 1 from public.coach_assignments
        where client_id = client_id_var and unassigned_at is null
      ) then
        insert into public.coach_assignments (client_id, coach_id, is_primary)
        values (client_id_var, coach_id_var, true);
      end if;
    end loop;
  end loop;
end;
$$;

-- ─── Sample client check-in so coach pipeline has a "last check-in" value
do $$
declare
  demo_client uuid;
begin
  for demo_client in
    select id from public.profiles where email like '%@optified.dev' and role = 'client'
  loop
    insert into public.client_check_ins
      (client_id, week_number, questions, submitted_at)
    values (
      demo_client, 4,
      'Feeling much better on the new sleep protocol. Still struggling with the 2pm energy dip — should I shift my lunch timing?',
      now() - interval '3 days'
    )
    on conflict (client_id, week_number) do update
      set submitted_at = excluded.submitted_at;
  end loop;
end;
$$;
