-- Guardrails for the self-learning benchmark engine.
-- Adds outlier flagging on observations, per-tier hard bounds, an anomaly
-- audit table, and per-source frequency caps to prevent death spirals.

-- 1. Per-observation outlier status
alter table rate_observations
  add column if not exists outlier_status text not null default 'normal'
    check (outlier_status in ('normal', 'flagged', 'rejected')),
  add column if not exists deviation_factor numeric,
  add column if not exists baseline_median_at_ingest_cents integer,
  add column if not exists guardrail_notes text;

create index if not exists rate_observations_outlier_status_idx
  on rate_observations(outlier_status) where outlier_status != 'normal';

-- 2. Anomaly audit table for admin review
create table if not exists benchmark_anomalies (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid references rate_observations(id) on delete cascade,
  observation_kind text not null default 'rate_observation',
  reason text not null,
  -- 'hard_floor', 'hard_ceiling', 'std_dev_outlier', 'frequency_cap',
  -- 'anchor_match', 'manual_review'
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  amount_cents integer,
  baseline_median_cents integer,
  deviation_factor numeric,
  source_slug text,
  resolved_at timestamptz,
  resolved_by_profile_id uuid references profiles(id) on delete set null,
  resolution text check (resolution in ('confirmed_normal', 'confirmed_outlier', 'rejected', 'manual_override')),
  resolution_note text,
  created_at timestamptz not null default now()
);

create index if not exists benchmark_anomalies_unresolved_idx
  on benchmark_anomalies(created_at desc) where resolved_at is null;
create index if not exists benchmark_anomalies_observation_idx on benchmark_anomalies(observation_id);

alter table benchmark_anomalies enable row level security;
drop policy if exists "Admins manage benchmark anomalies" on benchmark_anomalies;
create policy "Admins manage benchmark anomalies"
  on benchmark_anomalies for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- 3. Down-weight internal_deal slightly. Real money traded is high signal but
-- not infallible (creator could have accepted a low-ball, brand could have
-- overpaid). 0.85 still ranks above public sources but no longer dominates.
update benchmark_sources
  set reliability_score = 0.85,
      notes = 'Auto-generated from payment_status=released. High signal but not infallible - capped at 0.85 to prevent anchor confirmation loops.'
  where slug = 'internal_deal';

-- 4. Rebuild rate_benchmark_aggregates to exclude rejected observations and
-- cap per-row weight (no single observation contributes more than 0.5 weight).
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
    least(0.5,
      o.confidence * s.reliability_score *
      greatest(0.3, exp(-extract(epoch from (now() - o.observed_at)) / (86400.0 * 365.0)))
    ) as weight,
    o.observed_at,
    s.kind as source_kind,
    o.outlier_status
  from rate_observations o
  join benchmark_sources s on s.id = o.source_id
  where o.outlier_status != 'rejected'
    and (o.outlier_status != 'flagged' or s.kind = 'internal_deal')
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
  percentile_cont(0.25) within group (order by amount_cents) as p25_cents,
  percentile_cont(0.50) within group (order by amount_cents) as p50_cents,
  percentile_cont(0.75) within group (order by amount_cents) as p75_cents,
  case when sum(weight) > 0
    then round(sum(amount_cents * weight) / sum(weight))
    else round(avg(amount_cents))
  end as weighted_mean_cents,
  max(observed_at) as latest_observation_at,
  avg(weight) as avg_weight,
  count(*) filter (where source_kind = 'internal_deal') as internal_deal_count,
  count(*) filter (where outlier_status = 'flagged') as flagged_count
from weighted
group by platform, niche, deliverable_type, tier, city, market;

create unique index if not exists rate_benchmark_aggregates_uidx
  on rate_benchmark_aggregates (platform, niche, deliverable_type, tier, city, market);

-- 5. Anomaly review helper view (latest unresolved first)
drop view if exists benchmark_anomalies_review cascade;
create view benchmark_anomalies_review as
select
  a.*,
  o.platform,
  o.niche,
  o.deliverable_type,
  o.tier,
  o.deal_id,
  o.freelancer_project_id,
  o.observed_at,
  s.slug as source_slug_resolved,
  s.kind as source_kind
from benchmark_anomalies a
left join rate_observations o on o.id = a.observation_id
left join benchmark_sources s on s.id = o.source_id;
