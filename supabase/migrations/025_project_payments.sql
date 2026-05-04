alter table payments
  add column if not exists freelancer_project_id uuid references freelancer_projects(id) on delete cascade;

create unique index if not exists payments_deal_id_key
  on payments(deal_id)
  where deal_id is not null;

create unique index if not exists payments_freelancer_project_id_key
  on payments(freelancer_project_id)
  where freelancer_project_id is not null;

create index if not exists payments_project_status_idx on payments(freelancer_project_id, status);
