alter table deals
  add column if not exists counter_status text default 'none',
  add column if not exists counter_amount_cents integer,
  add column if not exists counter_deliverables text,
  add column if not exists counter_due_date date,
  add column if not exists counter_usage_rights text,
  add column if not exists counter_approval_terms text,
  add column if not exists counter_reason text,
  add column if not exists counter_created_at timestamptz,
  add column if not exists counter_responded_at timestamptz;

alter table freelancer_projects
  add column if not exists counter_status text default 'none',
  add column if not exists counter_amount_cents integer,
  add column if not exists counter_scope text,
  add column if not exists counter_due_date date,
  add column if not exists counter_usage_rights text,
  add column if not exists counter_approval_terms text,
  add column if not exists counter_reason text,
  add column if not exists counter_created_at timestamptz,
  add column if not exists counter_responded_at timestamptz;

create index if not exists deals_counter_status_idx on deals(counter_status);
create index if not exists freelancer_projects_counter_status_idx on freelancer_projects(counter_status);
