alter table campaigns
  add column if not exists visibility text default 'open';

create table if not exists campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  status text default 'invited',
  created_at timestamptz default now(),
  unique (campaign_id, creator_id)
);

alter table campaign_invites enable row level security;

create policy "admins manage campaign invites" on campaign_invites
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "brands read own campaign invites" on campaign_invites
  for select using (exists (
    select 1 from campaigns c
    where c.id = campaign_invites.campaign_id
      and c.profile_id = auth.uid()
  ));
