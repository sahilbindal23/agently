do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role%';

  if constraint_name is not null then
    execute format('alter table profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table profiles
  add constraint profiles_role_check check (role in ('admin', 'creator', 'brand', 'freelancer'));

create table if not exists freelancers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  display_name text not null,
  service_category text,
  bio text,
  home_city text,
  service_regions text[] default '{}',
  languages text[] default '{}',
  skills text[] default '{}',
  starting_rate_cents integer,
  day_rate_cents integer,
  availability_status text default 'available',
  rating_score numeric,
  portfolio_score numeric,
  created_at timestamptz default now()
);

create table if not exists portfolio_items (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid references freelancers(id) on delete cascade,
  title text,
  url text,
  media_type text,
  category text,
  brand_client text,
  description text,
  created_at timestamptz default now()
);

alter table freelancers enable row level security;
alter table portfolio_items enable row level security;

create policy "admins manage freelancers" on freelancers for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "freelancers read own profile" on freelancers for select using (profile_id = auth.uid());
create policy "brands read freelancers" on freelancers for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('brand', 'admin')));

create policy "admins manage portfolio items" on portfolio_items for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "freelancers read own portfolio" on portfolio_items for select using (exists (select 1 from freelancers f where f.id = portfolio_items.freelancer_id and f.profile_id = auth.uid()));
create policy "brands read portfolio items" on portfolio_items for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('brand', 'admin')));
