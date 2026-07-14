-- ─────────────────────────────────────────────────────────────
-- 00020 — Custom Biomarker Ranges for Personalized Longevity Targets
-- ─────────────────────────────────────────────────────────────

create table phi_stub.custom_biomarker_ranges (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  biomarker_key   text not null,      -- 'apob', 'homocysteine'
  min_value       numeric,
  max_value       numeric,
  created_at      timestamptz not null default now(),
  unique (client_id, biomarker_key)
);

grant all on phi_stub.custom_biomarker_ranges to service_role;
alter table phi_stub.custom_biomarker_ranges enable row level security;
create index idx_custom_ranges_client on phi_stub.custom_biomarker_ranges(client_id);
