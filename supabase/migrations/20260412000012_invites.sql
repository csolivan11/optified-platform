-- ─────────────────────────────────────────────────────────────
-- 00012 — Invite system
-- ─────────────────────────────────────────────────────────────
-- Custom invite flow (not Supabase built-in auth invites). See
-- Phase 3 docs for rationale — we want control over the sender
-- (Resend), the template rendering, and the metadata attached.

create type public.invite_status as enum (
  'pending',     -- created but not yet accepted
  'accepted',    -- user completed signup + password set
  'expired',     -- passed expires_at without acceptance
  'revoked'      -- admin cancelled before acceptance
);

create table public.invites (
  id              uuid primary key default uuid_generate_v4(),

  -- Token is the secret sent in the invite URL. Stored as sha256 hash so
  -- a DB leak doesn't expose usable tokens. The plaintext token lives
  -- only in the outgoing email.
  token_hash      text not null unique,

  email           citext not null,
  role            public.user_role not null default 'client',

  -- Metadata applied to the profile on acceptance
  first_name      text,
  last_name       text,
  program_id      uuid references public.programs(id),
  assigned_coach_id uuid references public.profiles(id),

  -- Lifecycle
  status          public.invite_status not null default 'pending',
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  accepted_by     uuid references public.profiles(id),
  revoked_at      timestamptz,
  revoked_by      uuid references public.profiles(id),

  -- Audit
  invited_by      uuid not null references public.profiles(id),
  invited_at      timestamptz not null default now(),

  -- Prevent creating a new invite for an email that already has a pending one.
  -- (Admin can revoke the old invite first if they want to reset.)
  created_at      timestamptz not null default now()
);

-- A given email can have at most one pending invite at a time.
create unique index idx_invites_one_pending_per_email
  on public.invites(email)
  where status = 'pending';

create index idx_invites_status on public.invites(status, expires_at);
create index idx_invites_invited_by on public.invites(invited_by, invited_at desc);

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.invites enable row level security;

-- Admins can see and manage all invites. Invites are never visible to
-- the invitee before acceptance — the email link is the only signal
-- they have, and token validation happens via service_role server-side.
create policy invites_admin_only
  on public.invites for all
  using (security.is_admin())
  with check (security.is_admin());

comment on table public.invites is
  'Custom invite tokens. Plaintext token never stored — only sha256 hash. Service role uses this table during /accept-invite flow.';
