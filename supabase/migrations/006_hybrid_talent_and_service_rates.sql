alter table freelancers
  add column if not exists hourly_rate_cents integer;

create table if not exists freelancer_service_rates (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid references freelancers(id) on delete cascade,
  service_name text not null,
  description text,
  rate_cents integer,
  pricing_unit text default 'project',
  created_at timestamptz default now()
);

alter table freelancer_service_rates enable row level security;

create policy "admins manage freelancer service rates" on freelancer_service_rates
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "talent read own freelancer service rates" on freelancer_service_rates
  for select using (exists (
    select 1 from freelancers f
    where f.id = freelancer_service_rates.freelancer_id
      and f.profile_id = auth.uid()
  ));

create policy "brands read freelancer service rates" on freelancer_service_rates
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('brand', 'admin')));
