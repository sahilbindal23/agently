-- Conversion funnel observations: CTR, conversion rate, AOV by niche/platform.
-- Same row-per-datapoint pattern as rate_observations / engagement_observations.
-- Used by the ROI calculator to project expected campaign revenue from
-- expected reach -> clicks -> conversions -> revenue.

create table if not exists conversion_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references benchmark_sources(id) on delete restrict,
  platform text not null default 'unknown',
  niche text not null default 'unknown',
  ctr_pct numeric not null check (ctr_pct >= 0 and ctr_pct <= 100),
  conversion_rate_pct numeric not null check (conversion_rate_pct >= 0 and conversion_rate_pct <= 100),
  aov_inr integer not null check (aov_inr >= 0),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  deal_id uuid references deals(id) on delete set null,
  observed_at timestamptz not null default now(),
  raw_metadata jsonb,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists conversion_observations_lookup_idx on conversion_observations(platform, niche);
create index if not exists conversion_observations_observed_at_idx on conversion_observations(observed_at desc);

alter table conversion_observations enable row level security;

drop policy if exists "Admins can manage conversion observations" on conversion_observations;
create policy "Admins can manage conversion observations"
  on conversion_observations
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

-- Materialized view: aggregated conversion funnels per (platform, niche)
drop materialized view if exists conversion_benchmark_aggregates cascade;
create materialized view conversion_benchmark_aggregates as
with weighted as (
  select
    o.platform,
    o.niche,
    o.ctr_pct,
    o.conversion_rate_pct,
    o.aov_inr,
    o.confidence * s.reliability_score *
      greatest(0.3, exp(-extract(epoch from (now() - o.observed_at)) / (86400.0 * 365.0))) as weight,
    o.observed_at,
    s.kind as source_kind
  from conversion_observations o
  join benchmark_sources s on s.id = o.source_id
)
select
  platform,
  niche,
  count(*) as observation_count,
  case when sum(weight) > 0 then sum(ctr_pct * weight) / sum(weight) else avg(ctr_pct) end as weighted_ctr_pct,
  case when sum(weight) > 0 then sum(conversion_rate_pct * weight) / sum(weight) else avg(conversion_rate_pct) end as weighted_conversion_rate_pct,
  case when sum(weight) > 0 then round(sum(aov_inr * weight) / sum(weight)) else round(avg(aov_inr)) end as weighted_aov_inr,
  percentile_cont(0.25) within group (order by ctr_pct) as p25_ctr_pct,
  percentile_cont(0.50) within group (order by ctr_pct) as p50_ctr_pct,
  percentile_cont(0.75) within group (order by ctr_pct) as p75_ctr_pct,
  percentile_cont(0.25) within group (order by conversion_rate_pct) as p25_conversion_pct,
  percentile_cont(0.50) within group (order by conversion_rate_pct) as p50_conversion_pct,
  percentile_cont(0.75) within group (order by conversion_rate_pct) as p75_conversion_pct,
  max(observed_at) as latest_observation_at,
  count(*) filter (where source_kind = 'internal_deal') as internal_deal_count,
  sum(weight) as total_weight
from weighted
group by platform, niche;

create unique index if not exists conversion_benchmark_aggregates_uidx
  on conversion_benchmark_aggregates (platform, niche);

-- Update the refresh function to include conversion aggregates
create or replace function refresh_benchmark_aggregates() returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently rate_benchmark_aggregates;
  refresh materialized view concurrently engagement_benchmark_aggregates;
  refresh materialized view concurrently conversion_benchmark_aggregates;
end;
$$;
