-- Benchmark observations layer: row-per-datapoint + materialized aggregations
-- Coexists with legacy rate_benchmarks table; the V2 reader merges both.
-- This is the layer that auto-grows from closed Agently deals.

-- ---------------------------------------------------------------------
-- 1. Sources: where each observation came from + how reliable that source is
-- ---------------------------------------------------------------------
create table if not exists benchmark_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('public_report', 'paid_dataset', 'survey', 'internal_deal', 'human_curated', 'industry_news')),
  reliability_score numeric not null default 0.5 check (reliability_score >= 0 and reliability_score <= 1),
  url text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists benchmark_sources_kind_idx on benchmark_sources(kind);

insert into benchmark_sources (slug, name, kind, reliability_score, url, notes) values
  ('india_priors_v1',           'Agently India priors v1 (LLM-recalled)', 'public_report',  0.40, '',                                                                              'Initial JSON priors from public reports - directionally OK, not individually verified'),
  ('qoruz_2025',                'Qoruz Engagement Benchmarks 2025',        'public_report',  0.85, 'https://qoruz.com/blog/engagement-rate-benchmarks-to-aim-for-in-2025/',         'Qoruz tier-level engagement rates; verified May 2025'),
  ('groupm_inca_2022',          'GroupM INCA Influencer Marketing Report', 'public_report',  0.80, 'https://www.buzzincontent.com/story/indian-influencer-marketing-industry-to-grow-at-25-cagr-to-reach-rs-2-800-crore-in-2026-groupm-inca/', 'Industry size + brand tier preferences (talent+production cost only)'),
  ('goat_kantar_2025',          'Goat Agency / Kantar India Report 2025',  'public_report',  0.85, '',                                                                              '2025 actual: Rs 4,500 cr, +25% YoY'),
  ('bcg_waves_2025',            'BCG-WAVES Creator Economy Report 2025',   'public_report',  0.90, 'https://www.bcg.com/publications/2025/india-from-content-to-commerce-mapping-indias-creator-economy', '2-2.5M Indian creators, ~Rs 29.6 lakh cr influenced spend'),
  ('hobo_video_2025',           'Hobo.video India Rate Card 2025',         'industry_news',  0.55, 'https://hobo.video/blog/the-real-cost-of-influencer-marketing-in-india-2025/',  'Tier-level INR ranges - cross-check, not primary anchor'),
  ('founder_research_v1',       'Agently founder research v1 (legacy)',    'human_curated',  0.55, '',                                                                              'Original 8 seed rows in rate_benchmarks table'),
  ('internal_deal',             'Closed Agently deal',                     'internal_deal',  1.00, '',                                                                              'Auto-generated from payment_status=released. Highest reliability - real money traded'),
  ('admin_curated',             'Admin manual entry',                      'human_curated',  0.65, '',                                                                              'Admin entered via /rate-benchmarks form')
on conflict (slug) do update set
  name = excluded.name,
  kind = excluded.kind,
  reliability_score = excluded.reliability_score,
  url = excluded.url,
  notes = excluded.notes;

-- ---------------------------------------------------------------------
-- 2. Rate observations: one row per datapoint, never pre-aggregated
-- ---------------------------------------------------------------------
create table if not exists rate_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references benchmark_sources(id) on delete restrict,
  platform text not null,
  niche text not null default 'unknown',
  deliverable_type text not null default 'unknown',
  tier text check (tier in ('nano', 'micro', 'mid', 'macro', 'mega', 'unknown')),
  city text default 'unknown',
  market text not null default 'India',
  language text default 'unknown',
  follower_count integer,
  avg_views_count integer,
  amount_cents integer not null check (amount_cents >= 0),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  deal_id uuid references deals(id) on delete set null,
  freelancer_project_id uuid references freelancer_projects(id) on delete set null,
  observed_at timestamptz not null default now(),
  raw_metadata jsonb,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists rate_observations_lookup_idx on rate_observations(platform, niche, deliverable_type, tier, city);
create index if not exists rate_observations_observed_at_idx on rate_observations(observed_at desc);
create index if not exists rate_observations_source_idx on rate_observations(source_id);
create index if not exists rate_observations_deal_idx on rate_observations(deal_id) where deal_id is not null;
create index if not exists rate_observations_project_idx on rate_observations(freelancer_project_id) where freelancer_project_id is not null;

alter table rate_observations enable row level security;

drop policy if exists "Admins can manage rate observations" on rate_observations;
create policy "Admins can manage rate observations"
  on rate_observations
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------
-- 3. Engagement observations: ER datapoints (separate from rate)
-- ---------------------------------------------------------------------
create table if not exists engagement_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references benchmark_sources(id) on delete restrict,
  platform text not null,
  niche text not null default 'unknown',
  tier text check (tier in ('nano', 'micro', 'mid', 'macro', 'mega', 'unknown')),
  language text default 'unknown',
  follower_count integer,
  engagement_rate_pct numeric not null check (engagement_rate_pct >= 0 and engagement_rate_pct <= 100),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  observed_at timestamptz not null default now(),
  raw_metadata jsonb,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists engagement_observations_lookup_idx on engagement_observations(platform, niche, tier);
create index if not exists engagement_observations_observed_at_idx on engagement_observations(observed_at desc);

alter table engagement_observations enable row level security;

drop policy if exists "Admins can manage engagement observations" on engagement_observations;
create policy "Admins can manage engagement observations"
  on engagement_observations
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------
-- 4. Materialized view: rate aggregates (read path for engines)
--    Combines rate_observations with weighting by source reliability * obs confidence
--    Recency weighting: observations from last 365 days get full weight, older get decay
-- ---------------------------------------------------------------------
drop materialized view if exists rate_benchmark_aggregates cascade;
create materialized view rate_benchmark_aggregates as
with weighted as (
  select
    o.platform,
    o.niche,
    o.deliverable_type,
    o.tier,
    o.city,
    o.market,
    o.amount_cents,
    o.confidence * s.reliability_score *
      greatest(0.3, exp(-extract(epoch from (now() - o.observed_at)) / (86400.0 * 365.0))) as weight,
    o.observed_at,
    s.kind as source_kind
  from rate_observations o
  join benchmark_sources s on s.id = o.source_id
)
select
  platform,
  niche,
  deliverable_type,
  tier,
  city,
  market,
  count(*) as observation_count,
  sum(weight) as total_weight,
  -- Weighted percentile approximations (Postgres percentile_cont doesn't accept weights;
  -- we compute percentile_cont as a baseline + weighted mean for the central estimate)
  percentile_cont(0.25) within group (order by amount_cents) as p25_cents,
  percentile_cont(0.50) within group (order by amount_cents) as p50_cents,
  percentile_cont(0.75) within group (order by amount_cents) as p75_cents,
  case when sum(weight) > 0
    then round(sum(amount_cents * weight) / sum(weight))
    else round(avg(amount_cents))
  end as weighted_mean_cents,
  -- How recent and how trustworthy on average
  max(observed_at) as latest_observation_at,
  avg(weight) as avg_weight,
  count(*) filter (where source_kind = 'internal_deal') as internal_deal_count
from weighted
group by platform, niche, deliverable_type, tier, city, market;

create unique index if not exists rate_benchmark_aggregates_uidx
  on rate_benchmark_aggregates (platform, niche, deliverable_type, tier, city, market);

-- ---------------------------------------------------------------------
-- 5. Materialized view: engagement aggregates
-- ---------------------------------------------------------------------
drop materialized view if exists engagement_benchmark_aggregates cascade;
create materialized view engagement_benchmark_aggregates as
with weighted as (
  select
    o.platform,
    o.niche,
    o.tier,
    o.engagement_rate_pct,
    o.confidence * s.reliability_score *
      greatest(0.3, exp(-extract(epoch from (now() - o.observed_at)) / (86400.0 * 365.0))) as weight,
    o.observed_at
  from engagement_observations o
  join benchmark_sources s on s.id = o.source_id
)
select
  platform,
  niche,
  tier,
  count(*) as observation_count,
  percentile_cont(0.25) within group (order by engagement_rate_pct) as p25_pct,
  percentile_cont(0.50) within group (order by engagement_rate_pct) as p50_pct,
  percentile_cont(0.75) within group (order by engagement_rate_pct) as p75_pct,
  case when sum(weight) > 0
    then sum(engagement_rate_pct * weight) / sum(weight)
    else avg(engagement_rate_pct)
  end as weighted_mean_pct,
  max(observed_at) as latest_observation_at,
  sum(weight) as total_weight
from weighted
group by platform, niche, tier;

create unique index if not exists engagement_benchmark_aggregates_uidx
  on engagement_benchmark_aggregates (platform, niche, tier);

-- ---------------------------------------------------------------------
-- 6. Refresh function: callable from app code or cron
-- ---------------------------------------------------------------------
create or replace function refresh_benchmark_aggregates() returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently rate_benchmark_aggregates;
  refresh materialized view concurrently engagement_benchmark_aggregates;
end;
$$;
