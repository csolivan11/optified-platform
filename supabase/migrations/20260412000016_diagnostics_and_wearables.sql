-- ─────────────────────────────────────────────────────────────
-- 00016 — Diagnostics and Wearables Extensions
-- ─────────────────────────────────────────────────────────────

-- ─── 1. Biomarker Catalog ──────────────────────────────────────
create table phi_stub.biomarker_catalog (
  key           text primary key,
  display_name  text not null,
  category      text not null, -- 'cardiovascular', 'methylation', 'metabolic', 'gut'
  unit          text,
  optimal_low   numeric,
  optimal_high  numeric
);

-- Grant permissions to service_role for metadata query
grant select on phi_stub.biomarker_catalog to service_role;
alter table phi_stub.biomarker_catalog enable row level security;

-- Seed Catalog
insert into phi_stub.biomarker_catalog (key, display_name, category, unit, optimal_low, optimal_high)
values
  ('apoB', 'Apolipoprotein B', 'cardiovascular', 'mg/dL', 0.0, 70.0),
  ('hsCRP', 'High-Sensitivity CRP', 'cardiovascular', 'mg/L', 0.0, 1.0),
  ('coq10', 'Coenzyme Q10', 'mitochondrial', 'mg/L', 1.2, 3.0),
  ('magnesium', 'Magnesium (RBC)', 'metabolic', 'mg/dL', 5.5, 6.5),
  ('homocysteine', 'Homocysteine', 'methylation', 'micromol/L', 5.0, 8.0),
  ('sam_sah_ratio', 'Methylation Index', 'methylation', 'ratio', 4.0, 6.0),
  ('glutathione', 'Glutathione (Reduced)', 'methylation', 'micromol/L', 200.0, 500.0),
  ('vo2_peak', 'VO2 Peak', 'metabolic', 'ml/min/kg', 45.0, 99.0),
  ('gut_diversity', 'Gut Diversity Index', 'gut', 'index', 7.5, 10.0),
  ('hexa_lps', 'Hexa-Lipopolysaccharide', 'gut', 'level', 0.0, 0.2)
on conflict (key) do update set
  display_name = excluded.display_name,
  category = excluded.category,
  unit = excluded.unit,
  optimal_low = excluded.optimal_low,
  optimal_high = excluded.optimal_high;

-- ─── 2. Genomic Variants (Nutrigenomix / methylation SNPS) ─────
create table phi_stub.genomic_variants (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  gene_name     text not null,      -- 'MTHFR', 'COMT', 'MTR'
  rsid          text not null,      -- 'rs1801133'
  genotype      text not null,      -- 'C/T', 'T/T', 'A/G'
  impact_level  text not null,      -- 'low', 'medium', 'high'
  clinical_note text,
  created_at    timestamptz not null default now()
);

grant all on phi_stub.genomic_variants to service_role;
alter table phi_stub.genomic_variants enable row level security;

-- ─── 3. Metabolic Assessments (PNOE) ───────────────────────────
create table phi_stub.metabolic_assessments (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  test_date       date not null,
  test_type       text not null,      -- 'resting_rmr', 'active_amr'
  vo2_peak        numeric,
  rmr_kcal        integer,
  rer_resting     numeric,
  vt1_bpm         integer,            -- Ventilatory Threshold 1
  vt2_bpm         integer,            -- Ventilatory Threshold 2 (Anaerobic)
  fat_max_bpm     integer,
  source_file_url text,
  created_at      timestamptz not null default now()
);

grant all on phi_stub.metabolic_assessments to service_role;
alter table phi_stub.metabolic_assessments enable row level security;

-- ─── 4. Medical Interpretations Reference Library ──────────────
create table public.medical_interpretations (
  biomarker_key             text primary key references phi_stub.biomarker_catalog(key) on delete cascade,
  clinical_summary          text not null,
  longevity_implication     text not null,
  recommended_interventions text,
  journal_citation          text
);

grant select on public.medical_interpretations to authenticated;
grant all on public.medical_interpretations to service_role;
alter table public.medical_interpretations enable row level security;

create policy "Users can read medical interpretations library"
  on public.medical_interpretations for select
  using (true);

-- Seed Reference Library
insert into public.medical_interpretations (biomarker_key, clinical_summary, longevity_implication, recommended_interventions, journal_citation)
values
  (
    'apoB', 
    'Apolipoprotein B (apoB) is the primary structural protein found on all atherogenic lipid particles, representing the absolute particle count.',
    'Lowering apoB below 70 mg/dL is strongly correlated with a near-zero incidence of coronary artery plaque buildup, extending cardiovascular healthspan.',
    'Co-optimize lipid panel using dietary modifications (reduce saturated fats) and low-dose lipid-lowering therapies if clinically indicated.',
    'Ference et al., JACC (2019): "Association of Lifetime Exposure to Lower LDL-C and apoB with Risk of Cardiovascular Disease."'
  ),
  (
    'homocysteine',
    'Homocysteine is an amino acid sulfur derivative. High levels reflect impaired methylation cycle pathways or folate/B12 depletion.',
    'Chronic elevation is an independent risk factor for systemic endothelial damage, arterial stiffening, and cognitive decline.',
    'Supplement with bioavailable methyl-donors (Methylfolate L-5-MTHF, Methylcobalamin, Betaine/TMG) to lower homocysteine.',
    'Smith et al., PLoS ONE (2010): "Preventing Alzheimer''s Disease-related Brain Atrophy by Lowering Homocysteine with B Vitamins."'
  ),
  (
    'vo2_peak',
    'VO2 Peak/Max measures the maximum volume of oxygen the cells can consume during peak physical exertion.',
    'VO2 Max is the strongest cardiorespiratory metric predicting all-cause mortality. High VO2 Max extends lifespan by up to 5-10 years.',
    'Incorporate structured high-intensity interval training (HIIT) and zone 2 aerobic base building exercises.',
    'Kokkinos et al., JACC (2022): "Cardiorespiratory Fitness and All-Cause Mortality in 750,000 Military Veterans."'
  )
on conflict (biomarker_key) do update set
  clinical_summary = excluded.clinical_summary,
  longevity_implication = excluded.longevity_implication,
  recommended_interventions = excluded.recommended_interventions,
  journal_citation = excluded.journal_citation;
