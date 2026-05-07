-- ─────────────────────────────────────────────────────────────
-- 00014 — Phase 4B demo seeders
-- ─────────────────────────────────────────────────────────────
-- Populates program tasks, client enrollments + task status,
-- client supplement assignments + 14 days of adherence, and
-- functional metric benchmarks for any demo client.
--
-- Idempotent + deterministic, same pattern as 00013.

-- ─── Add Foundation phase tasks for the VIP program ─────────
do $$
declare
  vip_id constant uuid := '11111111-1111-1111-1111-111111111111';
  foundation_phase_id uuid;
begin
  select id into foundation_phase_id
  from public.program_phases
  where program_id = vip_id and sequence = 2;  -- Foundation is sequence 2

  if foundation_phase_id is null then
    return;  -- Program not seeded yet, skip
  end if;

  insert into public.program_tasks (phase_id, title, sequence, auto_detected)
  values
    (foundation_phase_id, 'Complete initial lab panel', 1, false),
    (foundation_phase_id, 'Connect Oura ring', 2, true),
    (foundation_phase_id, 'Initiate supplement protocol', 3, false),
    (foundation_phase_id, 'Review nutrition plan with coach', 4, false),
    (foundation_phase_id, 'First weekly check-in submitted', 5, true),
    (foundation_phase_id, 'Begin exercise protocol', 6, false),
    (foundation_phase_id, 'Implement sleep hygiene routine', 7, false),
    (foundation_phase_id, '2-week supplement adherence streak', 8, true),
    (foundation_phase_id, '2-week nutrition adherence streak', 9, true),
    (foundation_phase_id, 'Complete 30-day follow-up labs', 10, false),
    (foundation_phase_id, 'Submit second video check-in', 11, false),
    (foundation_phase_id, '4-week progress review with coach', 12, false)
  on conflict do nothing;
end;
$$;

-- ─── Phase 4B per-client seed function ──────────────────────
create or replace function security.seed_demo_phase4b_data(_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  vip_program_id constant uuid := '11111111-1111-1111-1111-111111111111';
  enrollment_id uuid;
  foundation_phase_id uuid;
  task_record record;
  supp_record record;
  cs_id uuid;
  day_offset int;
  rand1 double precision;
begin
  -- ─── Ensure enrollment exists ─────────────────────────
  select id into foundation_phase_id
  from public.program_phases
  where program_id = vip_program_id and sequence = 2;

  insert into public.client_enrollments
    (client_id, program_id, started_at, current_phase_id, status)
  values
    (_client_id, vip_program_id, current_date - 28, foundation_phase_id, 'active')
  on conflict (client_id) where status = 'active'
  do update set current_phase_id = excluded.current_phase_id;

  select id into enrollment_id
  from public.client_enrollments
  where client_id = _client_id and status = 'active'
  limit 1;

  if enrollment_id is null then
    return;
  end if;

  -- ─── Seed task progress for Foundation phase ──────────
  -- First 7 tasks done, rest pending — represents week 4 of Foundation
  for task_record in
    select id, sequence
    from public.program_tasks
    where phase_id = foundation_phase_id
    order by sequence
  loop
    if task_record.sequence <= 7 then
      insert into public.client_task_status
        (enrollment_id, task_id, status, completed_at)
      values
        (enrollment_id, task_record.id, 'complete',
         now() - ((10 - task_record.sequence) * interval '2 days'))
      on conflict (enrollment_id, task_id) do update
        set status = 'complete',
            completed_at = excluded.completed_at;
    else
      insert into public.client_task_status
        (enrollment_id, task_id, status)
      values
        (enrollment_id, task_record.id, 'pending')
      on conflict (enrollment_id, task_id) do update
        set status = 'pending';
    end if;
  end loop;

  -- ─── Assign 4 supplements ─────────────────────────────
  for supp_record in
    select id, name from public.supplements
    where name in (
      'Magnesium Glycinate',
      'Omega-3 (EPA/DHA)',
      'Berberine',
      'Creatine Monohydrate'
    )
  loop
    insert into public.client_supplements
      (client_id, supplement_id, dose, frequency, protocol_name, start_date, active)
    values (
      _client_id,
      supp_record.id,
      case supp_record.name
        when 'Magnesium Glycinate' then '400mg'
        when 'Omega-3 (EPA/DHA)'   then '2g'
        when 'Berberine'            then '500mg'
        when 'Creatine Monohydrate' then '5g'
      end,
      case supp_record.name
        when 'Magnesium Glycinate' then 'Nightly'
        when 'Berberine'            then '2x Daily'
        else 'Daily'
      end,
      case supp_record.name
        when 'Magnesium Glycinate' then 'Sleep Optimization'
        when 'Omega-3 (EPA/DHA)'   then 'Inflammation Reduction'
        when 'Berberine'            then 'Metabolic Support'
        when 'Creatine Monohydrate' then 'Recovery Optimization'
      end,
      current_date - 28,
      true
    )
    on conflict do nothing;

    select id into cs_id
    from public.client_supplements
    where client_id = _client_id and supplement_id = supp_record.id and active = true
    limit 1;

    -- ─── Seed 14 days of adherence ─────────────────────
    -- Deterministic: each supplement-day gets ~85% taken rate, with
    -- a few misses scattered for realism. Pseudo-random per supplement.
    for day_offset in 0..13 loop
      rand1 := security.pseudo_random(
        cs_id,
        day_offset * 31 + ascii(substring(supp_record.name, 1, 1))
      );
      insert into public.supplement_adherence
        (client_supplement_id, date, taken, recorded_via)
      values
        (cs_id, current_date - day_offset, rand1 < 0.85, 'manual')
      on conflict (client_supplement_id, date) do update
        set taken = excluded.taken;
    end loop;
  end loop;

  -- ─── Functional metrics ───────────────────────────────
  -- Insert two timepoints each: baseline (60 days ago) + current.
  -- Per-client noise so Samantha and a future demo client differ.
  declare
    base_seed int := abs(hashtext(_client_id::text)) % 100;
  begin
    insert into public.functional_metrics
      (client_id, metric_name, category, value, unit, recorded_at,
       baseline_value, target_value, lower_is_better)
    values
      (_client_id, 'Deadlift 1RM', 'strength', 275 + base_seed, 'lbs',
       current_date - 60, 225 + base_seed, 365 + base_seed, false),
      (_client_id, 'Deadlift 1RM', 'strength', 315 + base_seed, 'lbs',
       current_date - 14, 225 + base_seed, 365 + base_seed, false),

      (_client_id, 'Back Squat 1RM', 'strength', 235 + base_seed, 'lbs',
       current_date - 60, 185 + base_seed, 315 + base_seed, false),
      (_client_id, 'Back Squat 1RM', 'strength', 265 + base_seed, 'lbs',
       current_date - 14, 185 + base_seed, 315 + base_seed, false),

      (_client_id, 'Bench Press 1RM', 'strength', 185 + (base_seed/2)::int, 'lbs',
       current_date - 60, 155, 245, false),
      (_client_id, 'Bench Press 1RM', 'strength', 205 + (base_seed/2)::int, 'lbs',
       current_date - 14, 155, 245, false),

      (_client_id, 'Grip Strength', 'strength', 104, 'lbs',
       current_date - 60, 92, 130, false),
      (_client_id, 'Grip Strength', 'strength', 118, 'lbs',
       current_date - 14, 92, 130, false),

      (_client_id, 'VO₂ Max', 'endurance', 37, 'ml/kg/min',
       current_date - 60, 33, 48, false),
      (_client_id, 'VO₂ Max', 'endurance', 42, 'ml/kg/min',
       current_date - 14, 33, 48, false),

      (_client_id, '2-Mile Run', 'endurance', 17.5, 'min',
       current_date - 60, 19.0, 13.5, true),
      (_client_id, '2-Mile Run', 'endurance', 15.2, 'min',
       current_date - 14, 19.0, 13.5, true),

      (_client_id, 'Wall Sit Hold', 'mobility', 65, 'sec',
       current_date - 60, 45, 120, false),
      (_client_id, 'Wall Sit Hold', 'mobility', 92, 'sec',
       current_date - 14, 45, 120, false),

      (_client_id, 'Plank Hold', 'mobility', 120, 'sec',
       current_date - 60, 90, 240, false),
      (_client_id, 'Plank Hold', 'mobility', 165, 'sec',
       current_date - 14, 90, 240, false),

      (_client_id, 'Sit & Reach', 'mobility', 4.0, 'in',
       current_date - 60, 2.5, 8.0, false),
      (_client_id, 'Sit & Reach', 'mobility', 6.5, 'in',
       current_date - 14, 2.5, 8.0, false),

      (_client_id, 'Body Fat %', 'body_comp', 32.1, '%',
       current_date - 60, 34.5, 22, true),
      (_client_id, 'Body Fat %', 'body_comp', 28.4, '%',
       current_date - 14, 34.5, 22, true),

      (_client_id, 'Lean Mass', 'body_comp', 166, 'lbs',
       current_date - 60, 161, 178, false),
      (_client_id, 'Lean Mass', 'body_comp', 171, 'lbs',
       current_date - 14, 161, 178, false),

      (_client_id, 'Waist Circumference', 'body_comp', 42.0, 'in',
       current_date - 60, 44, 34, true),
      (_client_id, 'Waist Circumference', 'body_comp', 38.5, 'in',
       current_date - 14, 44, 34, true)
    on conflict do nothing;
  end;
end;
$$;

grant execute on function security.seed_demo_phase4b_data(uuid)
  to authenticated, service_role;

-- ─── Run for any existing demo clients ──────────────────────
do $$
declare
  demo_client uuid;
begin
  for demo_client in
    select id from public.profiles
    where email like '%@optified.dev' and role = 'client'
  loop
    perform security.seed_demo_phase4b_data(demo_client);
  end loop;
end;
$$;
