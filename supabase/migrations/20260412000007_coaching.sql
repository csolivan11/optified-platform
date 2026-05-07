-- ─────────────────────────────────────────────────────────────
-- 00007 — Coaching communication
-- ─────────────────────────────────────────────────────────────
-- NOTE: beta policy is that coach notes contain BEHAVIORAL/LIFESTYLE
-- observations only — no clinical interpretation, no ICD codes, no
-- diagnostic language. Clinical-context notes go in phi_stub.clinical_notes
-- once PHI infrastructure is activated.

create table public.coach_notes (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  coach_id      uuid not null references public.profiles(id) on delete restrict,
  content       text not null,
  week_number   int check (week_number >= 0),
  visible_to_client boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz       -- soft delete preserves history
);

create index idx_coach_notes_client on public.coach_notes(client_id, created_at desc)
  where deleted_at is null;

create trigger trg_coach_notes_updated_at
  before update on public.coach_notes
  for each row execute function public.tg_set_updated_at();

comment on column public.coach_notes.visible_to_client is
  'If false, note is coach-only (internal observation). True = shown in client program tab.';

-- ─── client_check_ins ───────────────────────────────────────
-- Weekly video check-ins from client + coach response.
create table public.client_check_ins (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  week_number     int not null check (week_number >= 0),
  video_url       text,                        -- Loom / Vimeo link
  questions       text,                        -- client's submitted questions
  coach_response  text,
  responded_by    uuid references public.profiles(id),
  submitted_at    timestamptz not null default now(),
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (client_id, week_number)
);

create index idx_check_ins_client on public.client_check_ins(client_id, submitted_at desc);
create index idx_check_ins_pending on public.client_check_ins(submitted_at) where responded_at is null;
