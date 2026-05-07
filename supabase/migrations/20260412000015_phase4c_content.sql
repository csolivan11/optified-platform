-- ─────────────────────────────────────────────────────────────
-- 00015 — Phase 4C content seeder (education + assignments)
-- ─────────────────────────────────────────────────────────────
-- Adds a richer article catalog and assigns relevant articles to
-- demo clients. Idempotent.

-- ─── Expand article catalog ─────────────────────────────────
insert into public.education_articles
  (slug, title, excerpt, body, category, read_time_min, published, published_at)
values
  (
    'why-magnesium-glycinate-at-night',
    'Why Magnesium Glycinate at Night',
    'Understanding GABA receptor function and why glycinate form specifically supports sleep architecture over citrate or oxide.',
    E'# Why Magnesium Glycinate at Night\n\nMagnesium is involved in over 300 enzymatic reactions, but for sleep specifically, the key mechanism is its action on the GABA receptor system.\n\n## The GABA Connection\n\nGABA is your primary inhibitory neurotransmitter — it''s what tells your nervous system to wind down. Magnesium acts as an allosteric modulator of GABA-A receptors, meaning it enhances GABA''s natural calming effect without directly being a sedative.\n\n## Why Glycinate Specifically\n\nThe form matters more than most people realize:\n\n- **Magnesium glycinate** is bound to glycine, an amino acid that itself promotes deeper sleep and lowers core body temperature. You get a double benefit.\n- **Magnesium citrate** is well-absorbed but has a laxative effect at therapeutic doses — not what you want at bedtime.\n- **Magnesium oxide** is poorly absorbed (about 4% bioavailability). You''re mostly buying expensive urine.\n\n## Timing\n\nTake 30-60 minutes before bed. The peak plasma concentration aligns with sleep onset, supporting the natural drop in core body temperature that initiates deep sleep.\n\n## Your Protocol\n\n400mg of magnesium glycinate, nightly. This is the dose your protocol uses. Higher doses don''t produce better sleep outcomes in studies — they just produce more side effects.',
    'Supplements',
    4,
    true,
    now()
  ),
  (
    'inflammation-and-hs-crp',
    'hs-CRP and Systemic Inflammation',
    'High-sensitivity C-reactive protein is the cleanest single marker of systemic inflammation. Here''s what drives it and how to bring it down.',
    E'# hs-CRP and Systemic Inflammation\n\nhs-CRP (high-sensitivity C-reactive protein) is produced by your liver in response to inflammatory signals from your body. It''s one of the cleanest single markers of "background inflammation" — the kind that quietly drives cardiovascular disease, insulin resistance, and accelerated aging.\n\n## Targets\n\n- **Optimal**: under 1.0 mg/L\n- **Average**: 1.0-3.0 mg/L\n- **Elevated risk**: above 3.0 mg/L\n\n## What Drives It Up\n\nThe biggest contributors, in rough order of impact:\n\n1. **Visceral fat** — adipose tissue around organs is metabolically active and pumps out inflammatory cytokines\n2. **Poor sleep** — even one night of disrupted sleep raises hs-CRP measurably\n3. **Chronic infections** — gum disease especially\n4. **Insulin resistance** — creates a self-reinforcing cycle with inflammation\n5. **Diet** — refined carbs, industrial seed oils, ultra-processed foods\n\n## What Brings It Down\n\nThe interventions with the strongest evidence:\n\n- **Omega-3 supplementation** (2-4g EPA+DHA daily)\n- **Sleep optimization** — 7+ hours, consistent timing\n- **Visceral fat reduction** — even modest weight loss makes a meaningful dent\n- **Resistance training** — the anti-inflammatory effect is dose-dependent\n- **Mediterranean-style eating pattern**',
    'Inflammation',
    5,
    true,
    now()
  ),
  (
    'understanding-cac-score',
    'Understanding Your CAC Score',
    'A coronary artery calcium score is one of the strongest single predictors of cardiovascular risk. Here''s how to interpret yours.',
    E'# Understanding Your CAC Score\n\nA coronary artery calcium (CAC) score is generated from a low-dose CT scan that measures calcified plaque in your coronary arteries. It''s arguably the single most useful cardiovascular test available — far more predictive than cholesterol numbers alone.\n\n## How to Read the Score\n\n- **0** — No detectable calcium. Excellent. 10-year cardiac event risk is very low.\n- **1-99** — Mild plaque. Some risk, but very manageable with lifestyle.\n- **100-399** — Moderate plaque. Risk is meaningful and warrants aggressive prevention.\n- **400+** — Significant plaque. Risk is high; requires medical management plus lifestyle.\n\n## What a Zero Means (and Doesn''t)\n\nA CAC score of zero means no *calcified* plaque was detected. It does not rule out soft (non-calcified) plaque, which is more common in younger patients and can still rupture. But it does tell you that whatever atherosclerotic process is happening in your arteries hasn''t advanced to the calcification stage yet — and at that point, your trajectory is still very much in your control.\n\n## When to Repeat\n\nIf your score is zero and you maintain a clean cardiovascular profile, you can typically wait 5+ years before repeating. If your score is rising, more frequent monitoring (every 1-2 years) is appropriate to track velocity.',
    'Cardiovascular',
    3,
    true,
    now()
  ),
  (
    'creatine-beyond-performance',
    'Creatine Beyond Performance',
    'Creatine is the most-studied supplement in the world — and the data on cognition, longevity, and recovery is more compelling than the muscle-building story.',
    E'# Creatine Beyond Performance\n\nCreatine has been studied in over a thousand peer-reviewed trials. Most people know it as a strength supplement, but the broader physiological story is more interesting.\n\n## What It Actually Does\n\nCreatine is involved in your body''s rapid energy production. Specifically, it regenerates ATP (your cells'' immediate energy currency) faster than the standard pathways. Tissues with high energy demand — muscle, brain, heart — use the most.\n\n## Beyond Muscle\n\n- **Cognition**: meta-analyses show improvements in working memory and reasoning, especially in sleep-deprived states or in older adults\n- **Mood**: emerging evidence for adjunctive use in depression\n- **Recovery from concussion**: the Defense Department has used creatine in TBI protocols\n- **Bone density**: small effect, but consistent\n- **Hydration**: pulls water *into* cells, not under the skin (despite the old myth)\n\n## Dosing\n\n5g daily of creatine monohydrate. The "loading phase" (20g/day for a week) isn''t necessary — it just gets you to saturation faster. Steady 5g/day reaches the same plateau in 3-4 weeks.\n\nTiming is irrelevant. Take it whenever you''ll remember.',
    'Supplements',
    4,
    true,
    now()
  )
on conflict (slug) do nothing;

-- ─── Assign relevant articles to demo clients ───────────────
do $$
declare
  demo_client uuid;
  art record;
  reasons text[] := array[
    'Triggered: your most recent hs-CRP reading',
    'Triggered: part of your active protocol',
    'Triggered: based on your cardiovascular markers',
    'Manually assigned by your coach'
  ];
begin
  for demo_client in
    select id from public.profiles
    where email like '%@optified.dev' and role = 'client'
  loop
    -- Assign the 4 most-relevant articles
    for art in
      select a.id, row_number() over (order by a.published_at) as rn
      from public.education_articles a
      where a.slug in (
        'why-magnesium-glycinate-at-night',
        'inflammation-and-hs-crp',
        'triglyceride-hdl-ratio',
        'understanding-cac-score'
      )
    loop
      insert into public.client_article_assignments
        (client_id, article_id, reason, assigned_at)
      values
        (demo_client, art.id, reasons[((art.rn - 1) % 4) + 1],
         now() - (art.rn * interval '2 days'))
      on conflict (client_id, article_id) do nothing;
    end loop;
  end loop;
end;
$$;
