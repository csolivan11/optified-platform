-- ─────────────────────────────────────────────────────────────
-- 00018 — Supplement Schedule and Daily Compliance Logger
-- ─────────────────────────────────────────────────────────────

-- Supplement Schedule rules set by practitioners
create table phi_stub.supplement_schedules (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  supplement_name text not null,      -- 'ReDaxin Sorghum Bioflavonoid Complex', 'L-5-MTHF'
  dosage          text not null,      -- '250 mg', '1000 mcg'
  frequency       text not null,      -- 'Once daily with morning meal', 'Twice daily'
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

grant all on phi_stub.supplement_schedules to service_role;
alter table phi_stub.supplement_schedules enable row level security;
create index idx_supp_sched_client on phi_stub.supplement_schedules(client_id);

-- Supplement Compliance intake logs recorded daily by clients
create table phi_stub.supplement_compliance_logs (
  id              uuid primary key default uuid_generate_v4(),
  schedule_id     uuid not null references phi_stub.supplement_schedules(id) on delete cascade,
  logged_date     date not null,
  taken           boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (schedule_id, logged_date)
);

grant all on phi_stub.supplement_compliance_logs to service_role;
alter table phi_stub.supplement_compliance_logs enable row level security;
create index idx_supp_comp_date on phi_stub.supplement_compliance_logs(logged_date);

-- Seed database supplement schedule rules for local demo
insert into phi_stub.supplement_schedules (client_id, supplement_name, dosage, frequency)
values
  ('80000000-0000-0000-0000-000000000001', 'ReDaxin Sorghum Complex', '500 mg', 'Once daily in the morning'),
  ('80000000-0000-0000-0000-000000000001', 'Active Methylfolate (L-5-MTHF)', '1000 mcg', 'Once daily with food'),
  ('80000000-0000-0000-0000-000000000001', 'Magnesium Glycinate', '400 mg', 'At bedtime')
on conflict do nothing;
