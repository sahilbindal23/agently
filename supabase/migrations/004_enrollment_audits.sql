create table if not exists creator_audits (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  input jsonb not null default '{}',
  result jsonb not null default '{}',
  source text,
  created_at timestamptz default now()
);

create table if not exists brand_audits (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  input jsonb not null default '{}',
  result jsonb not null default '{}',
  source text,
  created_at timestamptz default now()
);

alter table creator_audits enable row level security;
alter table brand_audits enable row level security;

create policy "admins manage creator audits" on creator_audits for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "creators read own audits" on creator_audits for select using (profile_id = auth.uid());

create policy "admins manage brand audits" on brand_audits for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "brands read own audits" on brand_audits for select using (profile_id = auth.uid());
