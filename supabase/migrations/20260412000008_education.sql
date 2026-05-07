-- ─────────────────────────────────────────────────────────────
-- 00008 — Education content
-- ─────────────────────────────────────────────────────────────

create table public.education_articles (
  id              uuid primary key default uuid_generate_v4(),
  slug            text not null unique,
  title           text not null,
  excerpt         text,
  body            text not null,           -- markdown
  category        text,                    -- "Metabolic Health", "Sleep", etc.
  read_time_min   int check (read_time_min > 0),
  cover_image_url text,
  published       boolean not null default false,
  published_at    timestamptz,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_articles_published on public.education_articles(published_at desc) where published = true;
create index idx_articles_category on public.education_articles(category) where published = true;

create trigger trg_articles_updated_at
  before update on public.education_articles
  for each row execute function public.tg_set_updated_at();

-- ─── education_triggers ─────────────────────────────────────
-- Rules that decide when to surface an article to a client.
create type public.education_trigger_type as enum (
  'biomarker_range',   -- "if hs-CRP > 3, surface 'Inflammation 101'"
  'protocol_match',    -- "if taking magnesium glycinate, surface 'Why glycinate form'"
  'manual_assign'      -- coach-assigned
);

create table public.education_triggers (
  id            uuid primary key default uuid_generate_v4(),
  article_id    uuid not null references public.education_articles(id) on delete cascade,
  trigger_type  public.education_trigger_type not null,
  trigger_rule  jsonb not null,  -- structured rule; see docs/education-triggers.md
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index idx_triggers_article on public.education_triggers(article_id) where active = true;
create index idx_triggers_active on public.education_triggers(trigger_type) where active = true;

-- ─── client_article_assignments ─────────────────────────────
create table public.client_article_assignments (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  article_id    uuid not null references public.education_articles(id) on delete cascade,
  reason        text,                          -- why surfaced (trigger name or "manual")
  assigned_by   uuid references public.profiles(id),
  assigned_at   timestamptz not null default now(),
  read_at       timestamptz,
  unique (client_id, article_id)
);

create index idx_article_assignments_client on public.client_article_assignments(client_id, assigned_at desc);
create index idx_article_assignments_unread on public.client_article_assignments(client_id) where read_at is null;
