-- ─────────────────────────────────────────────────────────────
-- 00023 — Multi-Tenant Clinic Infrastructure Schema
-- ─────────────────────────────────────────────────────────────

create table public.clinics (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique, -- e.g. 'Doc Yerkes Clinic Zurich', 'Optified Clinic SF'
  location    text not null,        -- e.g. 'SF', 'Zurich', 'Tokyo'
  tier        text not null default 'premium',
  created_at  timestamptz not null default now()
);

-- Alter profiles to support multitenant clinics mapping
alter table public.profiles add column clinic_id uuid references public.clinics(id) on delete set null;

-- Grant privileges
grant all on public.clinics to service_role;

-- Seed default clinic
insert into public.clinics (name, location, tier) values
  ('Doc Yerkes Anti-Aging Center', 'Zurich', 'premium'),
  ('Optified Longevity Hub SF', 'SF', 'standard');

-- Update mock coach profiles to align under Doc Yerkes clinic
update public.profiles 
set clinic_id = (select id from public.clinics where name = 'Doc Yerkes Anti-Aging Center' limit 1);
