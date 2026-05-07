-- ─────────────────────────────────────────────────────────────
-- 00009 — Audit log and notifications
-- ─────────────────────────────────────────────────────────────

-- ─── audit_log ──────────────────────────────────────────────
-- Append-only record of sensitive actions. Required for security posture
-- and essential when PHI arrives. Writes happen from the application
-- repository layer, not from database triggers, to preserve context
-- (user-agent, IP, feature flags at time of action).
create table public.audit_log (
  id              uuid primary key default uuid_generate_v4(),
  actor_id        uuid references public.profiles(id),
  actor_role      public.user_role,
  action          text not null,                 -- 'viewed_client', 'updated_protocol', 'impersonation_started'
  resource_type   text,                          -- 'profile', 'coach_note', 'supplement_prescription'
  resource_id     uuid,
  target_client_id uuid references public.profiles(id),  -- if action affects a specific client
  metadata        jsonb,                         -- action-specific context
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index idx_audit_actor on public.audit_log(actor_id, created_at desc);
create index idx_audit_target on public.audit_log(target_client_id, created_at desc) where target_client_id is not null;
create index idx_audit_action on public.audit_log(action, created_at desc);
create index idx_audit_created on public.audit_log(created_at desc);

-- Prevent updates and deletes at the table level — audit is append-only.
-- (RLS is layered on top, but this is belt-and-suspenders.)
create or replace function public.tg_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only; updates and deletes are not permitted';
end;
$$;

create trigger trg_audit_log_no_update
  before update on public.audit_log
  for each row execute function public.tg_audit_log_immutable();

create trigger trg_audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.tg_audit_log_immutable();

comment on table public.audit_log is
  'Append-only audit trail. Writes go through the repository layer. Never updated or deleted.';

-- ─── notifications ──────────────────────────────────────────
create type public.notification_type as enum (
  'system',
  'alert',
  'milestone',
  'reminder',
  'coach_message'
);

create table public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  type          public.notification_type not null,
  title         text not null,
  body          text,
  action_url    text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_notifications_recipient on public.notifications(recipient_id, created_at desc);
create index idx_notifications_unread on public.notifications(recipient_id) where read_at is null;
