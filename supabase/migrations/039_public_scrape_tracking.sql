-- Track public-Instagram-scrape state on creator_platforms so the
-- /api/social/scrape-instagram endpoint can cache (24h TTL), audit failures,
-- and surface consistency deltas vs. self-reported follower counts.

alter table creator_platforms
  add column if not exists last_scrape_attempted_at timestamptz,
  add column if not exists last_scrape_status text,
  add column if not exists last_scrape_followers integer,
  add column if not exists last_scrape_self_report_delta_pct numeric;

create index if not exists creator_platforms_scrape_lookup_idx
  on creator_platforms(platform, handle, last_scrape_attempted_at desc)
  where last_scrape_status = 'success';
