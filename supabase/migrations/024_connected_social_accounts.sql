create table if not exists connected_social_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  provider text not null check (provider in ('instagram', 'facebook', 'youtube')),
  platform_account_id text,
  handle text,
  account_url text,
  status text default 'mock_connected',
  scopes text[] default '{}',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  unique (creator_id, provider, handle)
);

create table if not exists social_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  connected_account_id uuid references connected_social_accounts(id) on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  provider text not null check (provider in ('instagram', 'facebook', 'youtube')),
  followers integer default 0,
  avg_views_30d integer default 0,
  reach_30d integer default 0,
  impressions_30d integer default 0,
  engagement_rate_30d numeric default 0,
  india_audience_percent numeric default 0,
  bangalore_audience_percent numeric default 0,
  top_cities text[] default '{}',
  audience_age_range text,
  content_category_signals text[] default '{}',
  raw_metrics jsonb default '{}'::jsonb,
  source text default 'mock_api',
  synced_at timestamptz default now()
);

create index if not exists connected_social_accounts_creator_idx on connected_social_accounts(creator_id, provider);
create index if not exists social_metric_snapshots_creator_provider_idx on social_metric_snapshots(creator_id, provider, synced_at desc);

alter table connected_social_accounts enable row level security;
alter table social_metric_snapshots enable row level security;

create policy "admins manage connected social accounts" on connected_social_accounts
  for all using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "creators read own connected social accounts" on connected_social_accounts
  for select using (profile_id = auth.uid());

create policy "admins manage social metric snapshots" on social_metric_snapshots
  for all using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "creators read own social metric snapshots" on social_metric_snapshots
  for select using (
    exists (
      select 1 from connected_social_accounts csa
      where csa.id = social_metric_snapshots.connected_account_id
      and csa.profile_id = auth.uid()
    )
  );
