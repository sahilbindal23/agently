create table if not exists freelancer_projects (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete set null,
  freelancer_id uuid references freelancers(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  title text not null,
  scope text,
  amount_cents integer default 0,
  currency text default 'inr',
  due_date date,
  usage_context text,
  approval_terms text,
  status text default 'submitted',
  payment_status text default 'unpaid',
  talent_response text,
  responded_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

alter table freelancer_projects enable row level security;

create policy "admins manage freelancer projects" on freelancer_projects
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "freelancers read own projects" on freelancer_projects
  for select using (exists (
    select 1 from freelancers f
    where f.id = freelancer_projects.freelancer_id
      and f.profile_id = auth.uid()
  ));

create policy "brands read own freelancer projects" on freelancer_projects
  for select using (exists (
    select 1 from campaigns c
    where c.id = freelancer_projects.campaign_id
      and c.profile_id = auth.uid()
  ));
