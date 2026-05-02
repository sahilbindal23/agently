alter table campaign_recommendation_snapshots
  add column if not exists match_type text,
  add column if not exists best_use_case text,
  add column if not exists expected_outcome text,
  add column if not exists risk_level text,
  add column if not exists proof_points text[] default '{}';
