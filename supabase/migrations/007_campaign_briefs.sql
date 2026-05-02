create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete set null,
  profile_id uuid references profiles(id) on delete set null,
  title text not null,
  campaign_goal text,
  budget_cents integer default 0,
  city_focus text,
  region_focus text,
  campaign_length text,
  target_audience text,
  platforms text[] default '{}',
  creator_categories text[] default '{}',
  freelancer_needs text[] default '{}',
  languages text[] default '{}',
  status text default 'brief',
  created_at timestamptz default now()
);

create table if not exists campaign_shortlists (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  entity_type text check (entity_type in ('creator', 'freelancer')),
  entity_id uuid not null,
  fit_score numeric,
  reason text,
  status text default 'shortlisted',
  created_at timestamptz default now()
);

alter table campaigns enable row level security;
alter table campaign_shortlists enable row level security;

create policy "admins manage campaigns" on campaigns
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "brands read own campaigns" on campaigns
  for select using (profile_id = auth.uid());

create policy "brands create own campaigns" on campaigns
  for insert with check (profile_id = auth.uid());

create policy "admins manage campaign shortlists" on campaign_shortlists
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "brands read own campaign shortlists" on campaign_shortlists
  for select using (exists (
    select 1 from campaigns c
    where c.id = campaign_shortlists.campaign_id
      and c.profile_id = auth.uid()
  ));
