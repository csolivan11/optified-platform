-- ─────────────────────────────────────────────────────────────
-- 00017 — Microbiome and Sleep Logs Schema
-- ─────────────────────────────────────────────────────────────

-- Seed catalog elements for gut and metabolic metrics
insert into phi_stub.biomarker_catalog (key, display_name, category, unit, optimal_low, optimal_high)
values
  ('gut_score', 'Gut Microbiome Score', 'gut', '%', 50.0, 100.0),
  ('hexa_lps_prod', 'Hexa-LPS Production', 'gut', 'level', 0.0, 0.2), 
  ('beta_glucuronidase', 'Beta-Glucuronidase Activity', 'gut', 'level', 0.0, 0.5),
  ('indolepropionic_acid', 'Indolepropionic Acid (IPA)', 'gut', 'level', 0.5, 1.0),
  ('hydrogen_sulfide', 'Hydrogen Sulfide Gas', 'gut', 'level', 0.0, 0.3),
  ('rer_resting', 'Resting Respiratory Exchange Ratio', 'metabolic', 'ratio', 0.7, 0.8),
  ('fat_burning_eff', 'Fat Burning Efficiency', 'metabolic', '%', 70.0, 100.0)
on conflict (key) do update set
  display_name = excluded.display_name,
  category = excluded.category,
  unit = excluded.unit,
  optimal_low = excluded.optimal_low,
  optimal_high = excluded.optimal_high;

-- Create Microbiome results table
create table phi_stub.microbiome_results (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  sample_id       text not null,
  test_date       date not null,
  diversity_index numeric,             -- Shannon Index
  dysbiosis_index numeric,
  detected_pathobionts text[],         -- e.g. {'Clostridium bolteae', 'E. coli'}
  raw_json_metrics jsonb,              -- Flexible storage for full profiles
  created_at      timestamptz not null default now()
);

grant all on phi_stub.microbiome_results to service_role;
alter table phi_stub.microbiome_results enable row level security;
create index idx_microbiome_client on phi_stub.microbiome_results(client_id);

-- Create Sleep logs tracking table
create table phi_stub.sleep_logs (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references public.profiles(id) on delete cascade,
  log_date            date not null,
  morning_light_min   integer,        -- Target 10-20 min outdoor sunlight
  caffeine_cutoff_hr  integer,        -- Hours before sleep (Target > 8)
  alcohol_cutoff_hr   integer,        -- Hours before sleep (Target > 4)
  bedroom_temp_f      numeric,        -- Target 60-67F
  sleep_score         numeric,        -- Ingested from Oura/Whoop
  hrv_rmssd           numeric,
  created_at          timestamptz not null default now(),
  unique (client_id, log_date)
);

grant all on phi_stub.sleep_logs to service_role;
alter table phi_stub.sleep_logs enable row level security;
create index idx_sleep_logs_client on phi_stub.sleep_logs(client_id, log_date desc);

-- Seed interpretive study citations for gut & metabolic health
insert into public.medical_interpretations (biomarker_key, clinical_summary, longevity_implication, recommended_interventions, journal_citation)
values
  (
    'gut_diversity',
    'Shannon index of gut bacterial diversity. Reflects taxonomy distribution and species richness.',
    'High diversity protects against inflammatory bowel disease, insulin resistance, and cognitive decline.',
    'Consume a high-fiber, diverse plant-based diet (aim for 30+ different plants weekly) and prebiotic starches.',
    'Valdes et al., BMJ (2018): "Role of the gut microbiota in nutrition and health."'
  ),
  (
    'hexa_lps_prod',
    'Hexa-acylated lipopolysaccharide (hexa-LPS) is a potent pro-inflammatory endotoxin produced by specific gram-negative gut bacteria.',
    'Elevated hexa-LPS promotes metabolic endotoxemia, vascular inflammation, and macrophage M1 polarization.',
    'Reduce saturated fat intake (butter, coconut oils, fatty meats) and incorporate soluble fibers to support barrier function.',
    'Cani et al., Diabetes (2007): "Metabolic Endotoxemia Initiates Obesity and Insulin Resistance."'
  ),
  (
    'indolepropionic_acid',
    'Indolepropionic acid (IPA) is a deamination metabolite produced exclusively by gut microbiota. It acts as a powerful neuroprotective antioxidant.',
    'Circulating IPA levels protect against beta-amyloid aggregation, neuronal oxidative injury, and type 2 diabetes development.',
    'Increase dietary fiber intake, specifically rye, bran, and whole oats to fuel IPA-producing species.',
    'Tuomainen et al., Scientific Reports (2018): "Association of serum indolepropionic acid with risk of type 2 diabetes."'
  ),
  (
    'rer_resting',
    'Respiratory Exchange Ratio (RER) measures carbon dioxide produced relative to oxygen consumed at rest.',
    'An RER closer to 0.70 indicates fat oxidation (metabolic flexibility). An RER near 1.00 indicates pure glucose utilization.',
    'Incorporate fasted Zone 2 aerobic base building exercises to improve mitochondrial fatty acid oxidation.',
    'Goodpaster et al., Cell Metabolism (2017): "Metabolic Flexibility in Health and Disease."'
  )
on conflict (biomarker_key) do update set
  clinical_summary = excluded.clinical_summary,
  longevity_implication = excluded.longevity_implication,
  recommended_interventions = excluded.recommended_interventions,
  journal_citation = excluded.journal_citation;
