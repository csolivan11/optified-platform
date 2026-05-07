-- ─────────────────────────────────────────────────────────────
-- 00011 — Row-Level Security policies
-- ─────────────────────────────────────────────────────────────
-- Principle: every table enables RLS. Without explicit policies,
-- all access is DENIED (except postgres/service_role bypass).
-- Policies are written per operation (select/insert/update/delete)
-- for maximum clarity and auditability.
--
-- Access patterns:
--   - clients see only their own data
--   - coaches see data for clients they're assigned to
--   - admins see everything
--
-- Helpers used (from schema `security`):
--   security.is_admin()
--   security.is_coach()
--   security.is_coach_of(client_id)
--   security.can_access_client(client_id)  -- self OR coach OR admin

-- ─── profiles ───────────────────────────────────────────────
alter table public.profiles enable row level security;

-- SELECT: everyone can read their own profile; coaches/admins can read
-- profiles of clients they're assigned to.
create policy profiles_select_self_or_coach
  on public.profiles for select
  using (
    id = auth.uid()
    or security.is_admin()
    or security.is_coach_of(id)
  );

-- UPDATE: users can update their own profile; admins can update any.
create policy profiles_update_self_or_admin
  on public.profiles for update
  using (
    id = auth.uid()
    or security.is_admin()
  )
  with check (
    id = auth.uid()
    or security.is_admin()
  );

-- INSERT: handled exclusively by the auth trigger. No direct inserts allowed.
-- DELETE: cascade from auth.users deletion only. No direct deletes.

-- ─── coach_assignments ──────────────────────────────────────
alter table public.coach_assignments enable row level security;

-- SELECT: admins always; coaches can see their own assignments;
-- clients can see their current coach.
create policy coach_assignments_select
  on public.coach_assignments for select
  using (
    security.is_admin()
    or coach_id = auth.uid()
    or client_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE: admin only.
create policy coach_assignments_modify_admin
  on public.coach_assignments for all
  using (security.is_admin())
  with check (security.is_admin());

-- ─── programs (master catalog) ──────────────────────────────
alter table public.programs enable row level security;

-- SELECT: all authenticated users can see active programs (browsable catalog).
create policy programs_select
  on public.programs for select
  using (
    auth.uid() is not null
    and (active = true or security.is_admin())
  );

-- MODIFY: admin only.
create policy programs_modify_admin
  on public.programs for all
  using (security.is_admin())
  with check (security.is_admin());

-- ─── program_phases / program_tasks ─────────────────────────
alter table public.program_phases enable row level security;
alter table public.program_tasks enable row level security;

create policy phases_select on public.program_phases for select
  using (auth.uid() is not null);

create policy phases_modify_admin on public.program_phases for all
  using (security.is_admin()) with check (security.is_admin());

create policy tasks_select on public.program_tasks for select
  using (auth.uid() is not null);

create policy tasks_modify_admin on public.program_tasks for all
  using (security.is_admin()) with check (security.is_admin());

-- ─── client_enrollments ─────────────────────────────────────
alter table public.client_enrollments enable row level security;

create policy enrollments_select
  on public.client_enrollments for select
  using (security.can_access_client(client_id));

-- Coaches can modify enrollments for their clients; admins anywhere.
create policy enrollments_insert
  on public.client_enrollments for insert
  with check (security.is_coach_of(client_id));

create policy enrollments_update
  on public.client_enrollments for update
  using (security.is_coach_of(client_id))
  with check (security.is_coach_of(client_id));

-- ─── client_task_status ─────────────────────────────────────
alter table public.client_task_status enable row level security;

-- Helper: given an enrollment_id, get the client_id for policy check
create or replace function security.client_id_for_enrollment(_enrollment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.client_enrollments where id = _enrollment_id;
$$;
grant execute on function security.client_id_for_enrollment(uuid) to authenticated;

create policy task_status_select
  on public.client_task_status for select
  using (security.can_access_client(security.client_id_for_enrollment(enrollment_id)));

-- Clients can mark their own non-auto tasks complete; coaches can mark anything.
create policy task_status_insert
  on public.client_task_status for insert
  with check (security.can_access_client(security.client_id_for_enrollment(enrollment_id)));

create policy task_status_update
  on public.client_task_status for update
  using (security.can_access_client(security.client_id_for_enrollment(enrollment_id)))
  with check (security.can_access_client(security.client_id_for_enrollment(enrollment_id)));

-- ─── supplements (master catalog) ───────────────────────────
alter table public.supplements enable row level security;

create policy supplements_select on public.supplements for select
  using (auth.uid() is not null);

create policy supplements_modify_admin on public.supplements for all
  using (security.is_admin()) with check (security.is_admin());

-- ─── client_supplements / adherence / exercise / nutrition ──
alter table public.client_supplements enable row level security;
alter table public.supplement_adherence enable row level security;
alter table public.client_exercise_protocols enable row level security;
alter table public.client_nutrition_targets enable row level security;

-- client_supplements: readable by client/coach/admin; modifiable by coach/admin only.
create policy client_supplements_select
  on public.client_supplements for select
  using (security.can_access_client(client_id));

create policy client_supplements_modify
  on public.client_supplements for all
  using (security.is_coach_of(client_id))
  with check (security.is_coach_of(client_id));

-- Helper for adherence (joins client_supplements for policy check)
create or replace function security.client_id_for_supplement(_cs_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.client_supplements where id = _cs_id;
$$;
grant execute on function security.client_id_for_supplement(uuid) to authenticated;

-- adherence: clients can record their own; coaches can see.
create policy adherence_select
  on public.supplement_adherence for select
  using (security.can_access_client(security.client_id_for_supplement(client_supplement_id)));

create policy adherence_insert
  on public.supplement_adherence for insert
  with check (security.can_access_client(security.client_id_for_supplement(client_supplement_id)));

create policy adherence_update
  on public.supplement_adherence for update
  using (security.can_access_client(security.client_id_for_supplement(client_supplement_id)))
  with check (security.can_access_client(security.client_id_for_supplement(client_supplement_id)));

-- exercise protocols
create policy exercise_protocols_select
  on public.client_exercise_protocols for select
  using (security.can_access_client(client_id));

create policy exercise_protocols_modify
  on public.client_exercise_protocols for all
  using (security.is_coach_of(client_id))
  with check (security.is_coach_of(client_id));

-- nutrition targets
create policy nutrition_targets_select
  on public.client_nutrition_targets for select
  using (security.can_access_client(client_id));

create policy nutrition_targets_modify
  on public.client_nutrition_targets for all
  using (security.is_coach_of(client_id))
  with check (security.is_coach_of(client_id));

-- ─── daily_logs (self-reported wellness) ────────────────────
alter table public.daily_logs enable row level security;

-- Clients read/write their own logs. Coaches/admins read only.
create policy daily_logs_select
  on public.daily_logs for select
  using (security.can_access_client(client_id));

create policy daily_logs_insert
  on public.daily_logs for insert
  with check (client_id = auth.uid() or security.is_coach_of(client_id));

create policy daily_logs_update
  on public.daily_logs for update
  using (client_id = auth.uid() or security.is_coach_of(client_id))
  with check (client_id = auth.uid() or security.is_coach_of(client_id));

-- ─── wearable_connections ───────────────────────────────────
alter table public.wearable_connections enable row level security;

-- Clients see and manage their own connections. Coaches/admins see but don't manage.
create policy wearable_conn_select
  on public.wearable_connections for select
  using (security.can_access_client(client_id));

create policy wearable_conn_modify_self
  on public.wearable_connections for all
  using (client_id = auth.uid() or security.is_admin())
  with check (client_id = auth.uid() or security.is_admin());

-- ─── wearable_data_points ───────────────────────────────────
alter table public.wearable_data_points enable row level security;

create policy wearable_data_select
  on public.wearable_data_points for select
  using (security.can_access_client(client_id));

-- Inserts come from the sync worker via service_role (bypasses RLS).
-- Direct user inserts are not permitted.

-- ─── functional_metrics ─────────────────────────────────────
alter table public.functional_metrics enable row level security;

create policy functional_select
  on public.functional_metrics for select
  using (security.can_access_client(client_id));

create policy functional_insert
  on public.functional_metrics for insert
  with check (security.can_access_client(client_id));

create policy functional_update
  on public.functional_metrics for update
  using (security.can_access_client(client_id))
  with check (security.can_access_client(client_id));

-- ─── coach_notes ────────────────────────────────────────────
alter table public.coach_notes enable row level security;

-- Clients see notes where visible_to_client = true AND not soft-deleted.
-- Coaches assigned to the client see all their client's notes.
-- Admins see everything.
create policy coach_notes_select
  on public.coach_notes for select
  using (
    deleted_at is null
    and (
      security.is_coach_of(client_id)
      or (client_id = auth.uid() and visible_to_client = true)
    )
  );

-- Only the authoring coach or admin can modify a note.
create policy coach_notes_insert
  on public.coach_notes for insert
  with check (
    security.is_coach_of(client_id)
    and coach_id = auth.uid()
  );

create policy coach_notes_update
  on public.coach_notes for update
  using (coach_id = auth.uid() or security.is_admin())
  with check (coach_id = auth.uid() or security.is_admin());

-- ─── client_check_ins ───────────────────────────────────────
alter table public.client_check_ins enable row level security;

create policy check_ins_select
  on public.client_check_ins for select
  using (security.can_access_client(client_id));

create policy check_ins_insert_self
  on public.client_check_ins for insert
  with check (client_id = auth.uid());

create policy check_ins_update
  on public.client_check_ins for update
  using (
    -- client can edit their own submission until coach responds
    (client_id = auth.uid() and responded_at is null)
    or security.is_coach_of(client_id)
  )
  with check (
    (client_id = auth.uid() and responded_at is null)
    or security.is_coach_of(client_id)
  );

-- ─── education_articles / triggers / assignments ────────────
alter table public.education_articles enable row level security;
alter table public.education_triggers enable row level security;
alter table public.client_article_assignments enable row level security;

-- Articles: any authenticated user sees published ones; admins see drafts too.
create policy articles_select
  on public.education_articles for select
  using (
    auth.uid() is not null
    and (published = true or security.is_admin())
  );

create policy articles_modify_admin
  on public.education_articles for all
  using (security.is_admin()) with check (security.is_admin());

-- Triggers: admin only (these are system configuration).
create policy triggers_admin_only
  on public.education_triggers for all
  using (security.is_admin()) with check (security.is_admin());

-- Client article assignments: client sees their own; coach/admin sees their clients'.
create policy article_assignments_select
  on public.client_article_assignments for select
  using (security.can_access_client(client_id));

create policy article_assignments_modify
  on public.client_article_assignments for all
  using (security.is_coach_of(client_id) or client_id = auth.uid())
  with check (security.is_coach_of(client_id) or client_id = auth.uid());

-- ─── audit_log ──────────────────────────────────────────────
alter table public.audit_log enable row level security;

-- Actors can see their own audit entries (transparency).
-- Admins see everything.
-- Nobody can insert directly — only via service_role (repository layer).
create policy audit_log_select
  on public.audit_log for select
  using (
    actor_id = auth.uid()
    or security.is_admin()
  );

-- No INSERT/UPDATE/DELETE policies for non-admin.
-- INSERT happens via the service_role client in the repository layer.
-- (The immutability trigger from migration 00009 blocks UPDATE/DELETE entirely.)

-- ─── notifications ──────────────────────────────────────────
alter table public.notifications enable row level security;

create policy notifications_select_own
  on public.notifications for select
  using (recipient_id = auth.uid() or security.is_admin());

create policy notifications_update_own
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- INSERT happens server-side via service_role.
