-- ─────────────────────────────────────────────────────────────
-- 00010 — PHI stub tables
-- ─────────────────────────────────────────────────────────────
-- These tables live in the `phi_stub` schema, intentionally separated
-- from `public`. In beta, NO APPLICATION CODE reads from or writes to
-- these tables. The client UI surfaces that need this data show the
-- InDevelopmentNotice component instead.
--
-- When PHI infrastructure arrives (Supabase enterprise BAA, or AWS RDS
-- migration), these table definitions either (a) become active in place
-- with the upgraded BAA, or (b) are extracted into the AWS-hosted PHI
-- database and the `phi_stub` schema is dropped.
--
-- Either way, the repository layer in `lib/repositories/` is the only
-- application-code boundary that changes.

-- ─── Biomarker result status enum (shared by several PHI tables) ─
create type phi_stub.biomarker_result_status as enum (
  'optimal',
  'attention',
  'critical',
  'insufficient_data'
);

-- ─── phi_stub.bloodwork_panels ──────────────────────────────
-- A single lab draw event (e.g. a March 2026 blood draw at Quest).
create table phi_stub.bloodwork_panels (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null,                   -- will reference public.profiles if same DB
  draw_date     date not null,
  lab_vendor    text,                            -- "Quest", "LabCorp", "Function Health"
  source_file_url text,                          -- reference to original PDF in secure storage
  notes         text,
  created_at    timestamptz not null default now()
);

-- ─── phi_stub.biomarker_results ─────────────────────────────
-- Individual biomarker values from a panel.
create table phi_stub.biomarker_results (
  id              uuid primary key default uuid_generate_v4(),
  panel_id        uuid not null references phi_stub.bloodwork_panels(id) on delete cascade,
  biomarker_key   text not null,                 -- 'apoB', 'hsCRP', 'testosterone', etc.
  value           numeric not null,
  unit            text,
  reference_low   numeric,
  reference_high  numeric,
  optimal_low     numeric,
  optimal_high    numeric,
  status          phi_stub.biomarker_result_status,
  created_at      timestamptz not null default now()
);

create index idx_phi_stub_results_panel on phi_stub.biomarker_results(panel_id);

-- ─── phi_stub.specialty_tests ───────────────────────────────
-- CAC, DEXA, MRI, colonoscopy, etc.
create type phi_stub.specialty_test_type as enum (
  'cac_score',
  'dexa_scan',
  'mri',
  'colonoscopy',
  'endoscopy',
  'echocardiogram',
  'stress_test',
  'other'
);

create table phi_stub.specialty_tests (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null,
  test_type     phi_stub.specialty_test_type not null,
  test_date     date not null,
  summary_value text,                            -- e.g. "0", "32.1% BF", "Normal"
  status        phi_stub.biomarker_result_status,
  narrative     text,                            -- summary/interpretation
  source_file_url text,
  created_at    timestamptz not null default now()
);

-- ─── phi_stub.medical_documents ─────────────────────────────
-- Uploaded PDFs, images, any document asset.
create table phi_stub.medical_documents (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null,
  filename      text not null,
  mime_type     text,
  storage_path  text not null,                   -- path in secure storage bucket
  size_bytes    bigint,
  uploaded_by   uuid,
  category      text,                            -- "lab_report", "imaging", "physician_note"
  created_at    timestamptz not null default now()
);

-- ─── phi_stub.clinical_notes ────────────────────────────────
-- Coach / clinician notes that contain CLINICAL context (diagnoses,
-- interpretations, recommendations involving medical condition names).
-- Segregated from public.coach_notes which is behavioral/lifestyle only.
create table phi_stub.clinical_notes (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null,
  author_id     uuid not null,
  content       text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- ─── Lock down phi_stub schema ──────────────────────────────
-- Revoke anything that might have been granted implicitly. Only service_role
-- can touch these tables in beta, and application code does not use service_role
-- against phi_stub tables (there are no repository implementations for them).
revoke all on all tables in schema phi_stub from public, authenticated, anon;
grant all on all tables in schema phi_stub to service_role;

-- Enable RLS on every phi_stub table with DEFAULT DENY.
-- This is belt-and-suspenders: even if someone accidentally grants SELECT,
-- the RLS deny-by-default posture still blocks reads.
alter table phi_stub.bloodwork_panels enable row level security;
alter table phi_stub.biomarker_results enable row level security;
alter table phi_stub.specialty_tests enable row level security;
alter table phi_stub.medical_documents enable row level security;
alter table phi_stub.clinical_notes enable row level security;

-- No policies are created. With RLS enabled and no policies, all access
-- is denied except for postgres/service_role bypass.
