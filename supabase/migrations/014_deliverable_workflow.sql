alter table deliverables
  add column if not exists freelancer_project_id uuid references freelancer_projects(id) on delete cascade,
  add column if not exists title text,
  add column if not exists notes text,
  add column if not exists review_notes text;

alter table freelancer_projects
  add column if not exists deliverable_status text default 'not_started';

create index if not exists deliverables_deal_id_idx on deliverables(deal_id);
create index if not exists deliverables_freelancer_project_id_idx on deliverables(freelancer_project_id);
