-- ─────────────────────────────────────────────────────────────
-- 00002 — Programs, phases, tasks, enrollments
-- ─────────────────────────────────────────────────────────────

-- ─── Program tier enum ──────────────────────────────────────
create type public.program_tier as enum (
  'foundation',
  'accelerator',
  'elite',
  'apex',
  'vip'
);

-- ─── programs ───────────────────────────────────────────────
-- Master catalog of program templates. Admin-managed.
create table public.programs (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  tier            public.program_tier not null,
  duration_weeks  int not null check (duration_weeks > 0),
  description     text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_programs_updated_at
  before update on public.programs
  for each row execute function public.tg_set_updated_at();

-- ─── program_phases ─────────────────────────────────────────
-- Each program is broken into sequential phases.
create table public.program_phases (
  id            uuid primary key default uuid_generate_v4(),
  program_id    uuid not null references public.programs(id) on delete cascade,
  name          text not null,
  sequence      int not null check (sequence >= 1),
  description   text,
  created_at    timestamptz not null default now(),
  unique (program_id, sequence)
);

create index idx_program_phases_program on public.program_phases(program_id, sequence);

-- ─── program_tasks ──────────────────────────────────────────
-- Template tasks per phase. Individual client progress is tracked separately
-- in client_task_status to preserve the template for future enrollments.
create table public.program_tasks (
  id              uuid primary key default uuid_generate_v4(),
  phase_id        uuid not null references public.program_phases(id) on delete cascade,
  title           text not null,
  description     text,
  sequence        int not null default 0,
  auto_detected   boolean not null default false,
  detection_rule  jsonb,  -- future: structured rule for system auto-completion
  created_at      timestamptz not null default now()
);

create index idx_program_tasks_phase on public.program_tasks(phase_id, sequence);

comment on column public.program_tasks.auto_detected is 'If true, system auto-marks complete based on detection_rule (e.g. "Oura connected").';

-- ─── Enrollment status enum ─────────────────────────────────
create type public.enrollment_status as enum (
  'active',
  'paused',
  'completed',
  'withdrawn'
);

-- ─── client_enrollments ─────────────────────────────────────
-- A specific client's journey through a program.
create table public.client_enrollments (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references public.profiles(id) on delete cascade,
  program_id        uuid not null references public.programs(id) on delete restrict,
  started_at        date not null default current_date,
  current_phase_id  uuid references public.program_phases(id),
  status            public.enrollment_status not null default 'active',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_enrollments_client on public.client_enrollments(client_id);
create index idx_enrollments_active on public.client_enrollments(status) where status = 'active';

-- Enforce one active enrollment per client
create unique index idx_enrollments_one_active_per_client
  on public.client_enrollments(client_id)
  where status = 'active';

create trigger trg_enrollments_updated_at
  before update on public.client_enrollments
  for each row execute function public.tg_set_updated_at();

-- ─── Task status enum ───────────────────────────────────────
create type public.task_status as enum (
  'pending',
  'in_progress',
  'complete'
);

-- ─── client_task_status ─────────────────────────────────────
-- Tracks each client's completion of each task.
create table public.client_task_status (
  id              uuid primary key default uuid_generate_v4(),
  enrollment_id   uuid not null references public.client_enrollments(id) on delete cascade,
  task_id         uuid not null references public.program_tasks(id) on delete cascade,
  status          public.task_status not null default 'pending',
  completed_at    timestamptz,
  completed_by    uuid references public.profiles(id),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (enrollment_id, task_id)
);

create index idx_task_status_enrollment on public.client_task_status(enrollment_id);

create trigger trg_task_status_updated_at
  before update on public.client_task_status
  for each row execute function public.tg_set_updated_at();
