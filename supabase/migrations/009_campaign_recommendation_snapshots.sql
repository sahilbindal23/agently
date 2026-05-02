create table if not exists campaign_recommendation_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  entity_type text check (entity_type in ('creator', 'freelancer')),
  entity_id uuid not null,
  fit_score numeric,
  score_breakdown jsonb default '{}'::jsonb,
  roi_estimate jsonb default '{}'::jsonb,
  watchouts text[] default '{}',
  reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (campaign_id, entity_type, entity_id)
);

alter table campaign_recommendation_snapshots enable row level security;

create policy "admins manage campaign recommendation snapshots" on campaign_recommendation_snapshots
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "brands read own recommendation snapshots" on campaign_recommendation_snapshots
  for select using (exists (
    select 1 from campaigns c
    where c.id = campaign_recommendation_snapshots.campaign_id
      and c.profile_id = auth.uid()
  ));
