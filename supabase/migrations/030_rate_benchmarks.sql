create table if not exists rate_benchmarks (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  niche text not null,
  deliverable_type text not null,
  city text not null default 'Bengaluru',
  market text not null default 'India',
  follower_min integer,
  follower_max integer,
  avg_view_min integer,
  avg_view_max integer,
  low_cents integer not null,
  base_cents integer not null,
  high_cents integer not null,
  source_type text not null default 'founder_research',
  source_label text,
  confidence_score numeric not null default 0.6,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rate_benchmarks_lookup_idx on rate_benchmarks(platform, niche, deliverable_type, city);
create index if not exists rate_benchmarks_market_idx on rate_benchmarks(market, city);

alter table rate_benchmarks enable row level security;

drop policy if exists "Admins can manage rate benchmarks" on rate_benchmarks;
create policy "Admins can manage rate benchmarks"
  on rate_benchmarks
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

insert into rate_benchmarks (
  platform,
  niche,
  deliverable_type,
  city,
  market,
  follower_min,
  follower_max,
  avg_view_min,
  avg_view_max,
  low_cents,
  base_cents,
  high_cents,
  source_type,
  source_label,
  confidence_score,
  notes
)
select *
from (
  values
    ('Instagram', 'fashion lifestyle', 'Reel + 3 stories', 'Bengaluru', 'India', 25000, 100000, 12000, 60000, 1800000, 3500000, 6500000, 'founder_research', 'Agently seed benchmark v1', 0.55, 'Starter estimate for Bangalore fashion/lifestyle creators. Replace with interview and closed-deal evidence.'),
    ('Instagram', 'food cafe restaurant', 'Reel + stories', 'Bengaluru', 'India', 15000, 80000, 8000, 45000, 1200000, 2500000, 4500000, 'founder_research', 'Agently seed benchmark v1', 0.5, 'Local food/cafe campaigns are often budget-sensitive but can convert strongly for city launches.'),
    ('Instagram', 'beauty skincare', 'Reel + 3 stories', 'Bengaluru', 'India', 30000, 150000, 15000, 80000, 2500000, 5000000, 9000000, 'founder_research', 'Agently seed benchmark v1', 0.55, 'Beauty and skincare usually price above local food due to commerce fit and category competition.'),
    ('YouTube', 'tech gaming', '90-second integration', 'Bengaluru', 'India', 50000, 250000, 20000, 120000, 3500000, 8500000, 16000000, 'founder_research', 'Agently seed benchmark v1', 0.55, 'Useful baseline for tech/gaming integrations where purchase intent is clearer.'),
    ('YouTube', 'education career finance', 'Dedicated video', 'India', 'India', 75000, 350000, 30000, 180000, 7000000, 18000000, 35000000, 'founder_research', 'Agently seed benchmark v1', 0.5, 'Dedicated explainers can price materially higher when the brand has lead/CAC economics.'),
    ('Freelancer', 'videography production', 'Half-day shoot', 'Bengaluru', 'India', null, null, null, null, 1200000, 2500000, 5000000, 'founder_research', 'Agently seed benchmark v1', 0.45, 'Freelancer production rates should be calibrated from portfolio quality, equipment, turnaround, and usage.'),
    ('Freelancer', 'video editing', 'Short-form editing package', 'Bengaluru', 'India', null, null, null, null, 400000, 1200000, 3000000, 'founder_research', 'Agently seed benchmark v1', 0.45, 'Starter range for reels/shorts editing packages, not hourly retainers.'),
    ('Freelancer', 'podcast production', 'Podcast shoot + edit', 'Bengaluru', 'India', null, null, null, null, 1500000, 3500000, 7500000, 'founder_research', 'Agently seed benchmark v1', 0.45, 'Podcast work varies heavily with cameras, studio, number of reels cutdowns, and delivery timeline.')
) as seed(
  platform,
  niche,
  deliverable_type,
  city,
  market,
  follower_min,
  follower_max,
  avg_view_min,
  avg_view_max,
  low_cents,
  base_cents,
  high_cents,
  source_type,
  source_label,
  confidence_score,
  notes
)
where not exists (
  select 1 from rate_benchmarks
  where source_label = 'Agently seed benchmark v1'
);
