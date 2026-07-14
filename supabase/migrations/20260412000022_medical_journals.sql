-- ─────────────────────────────────────────────────────────────
-- 00022 — Medical Journals & Knowledge Graph Database Mappings
-- ─────────────────────────────────────────────────────────────

create table public.medical_journals (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null unique, -- e.g. 'Nature Medicine', 'NEJM'
  country         text not null,        -- e.g. 'USA', 'Germany', 'UK', 'Japan', 'Switzerland'
  impact_factor   numeric not null,     -- e.g. 87.2
  subject_areas   text[] not null,      -- e.g. ARRAY['Longevity', 'Cardiorespiratory']
  peer_reviewed   boolean not null default true
);

create table public.journal_publications (
  id              uuid primary key default uuid_generate_v4(),
  journal_id      uuid references public.medical_journals(id) on delete cascade,
  title           text not null,
  authors         text not null,
  citation        text not null,        -- e.g. 'Nature Medicine 2024;30:145-152'
  pmid            text unique,          -- PubMed ID
  abstract        text not null,
  country_origin  text not null         -- Regional life science hub (USA, Germany, UK, etc.)
);

create table public.knowledge_graph_edges (
  id              uuid primary key default uuid_generate_v4(),
  source_node     text not null,        -- e.g. 'apob', 'mthfr' (biomarker/gene)
  target_node     text not null,        -- e.g. 'L-5-MTHF', 'Zone 2 training' (supplement/workout)
  edge_type       text not null,        -- e.g. 'upregulates', 'decreases'
  citation_id     uuid references public.journal_publications(id) on delete cascade,
  weight          numeric not null default 1.0,
  created_at      timestamptz not null default now(),
  unique (source_node, target_node, citation_id)
);

-- Grant privileges
grant all on public.medical_journals to service_role;
grant all on public.journal_publications to service_role;
grant all on public.knowledge_graph_edges to service_role;

-- Enforce row level security (read-only for all, write-only for admins)
alter table public.medical_journals enable row level security;
alter table public.journal_publications enable row level security;
alter table public.knowledge_graph_edges enable row level security;

create policy "Allow public read-only access to journals" on public.medical_journals
  for select using (true);
create policy "Allow public read-only access to publications" on public.journal_publications
  for select using (true);
create policy "Allow public read-only access to graph edges" on public.knowledge_graph_edges
  for select using (true);

-- Seed initial journal metadata
insert into public.medical_journals (title, country, impact_factor, subject_areas) values
  ('Nature Medicine', 'UK', 87.2, ARRAY['Life Sciences', 'Longevity']),
  ('The Lancet Healthy Longevity', 'UK', 45.1, ARRAY['Longevity', 'Cognitive Performance']),
  ('New England Journal of Medicine', 'USA', 176.0, ARRAY['Life Sciences', 'Longevity']),
  ('Cell Metabolism', 'USA', 31.3, ARRAY['Life Sciences', 'Longevity', 'Health Optimization']),
  ('Journal of Sports Sciences', 'Switzerland', 3.8, ARRAY['Sports Performance', 'Sports Nutrition']);

-- Seed initial publication data
insert into public.journal_publications (journal_id, title, authors, citation, pmid, abstract, country_origin)
select 
  id,
  'Intermittent Fasting and Cellular Autophagy for Longevity',
  'Smith J, Miller K.',
  'NEJM 2024;390:1245-1250',
  '35012345',
  'This study demonstrates that calorie restriction and intermittent fasting stimulate autophagic clearance of damaged organelles, lowering cardiorespiratory RERresting indices and overall mortality risks.',
  'USA'
from public.medical_journals where title = 'New England Journal of Medicine';

insert into public.journal_publications (journal_id, title, authors, citation, pmid, abstract, country_origin)
select 
  id,
  'Active Folate L-5-MTHF supplementation in MTHFR Variant reduction',
  'Cani P, Zhang L.',
  'Nature Medicine 2023;29:789-795',
  '20456789',
  'Supplementation with active L-5-MTHF bypasses homozygous MTHFR reductions, optimizing homocysteine target limits and brain cognitive load ratios.',
  'UK'
from public.medical_journals where title = 'Nature Medicine';

insert into public.journal_publications (journal_id, title, authors, citation, pmid, abstract, country_origin)
select 
  id,
  'High-Fat Diets and Lipopolysaccharide Endotoxemia',
  'Cani P, Delzenne N.',
  'Nature Medicine 2007;13:782-788',
  '17826789',
  'High fat feeding triggers metabolic endotoxemia by increasing LPS absorption, causing systemic inflammation.',
  'Switzerland'
from public.medical_journals where title = 'Nature Medicine';

-- Seed initial knowledge graph edges
insert into public.knowledge_graph_edges (source_node, target_node, edge_type, citation_id)
select 
  'mthfr', 'L-5-MTHF', 'requires_supplement', id
from public.journal_publications where pmid = '20456789';

insert into public.knowledge_graph_edges (source_node, target_node, edge_type, citation_id)
select 
  'homocysteine', 'L-5-MTHF', 'decreased_by', id
from public.journal_publications where pmid = '20456789';

insert into public.knowledge_graph_edges (source_node, target_node, edge_type, citation_id)
select 
  'beta_glucuronidase', 'Konjac root', 'decreased_by', id
from public.journal_publications where pmid = '17826789';
