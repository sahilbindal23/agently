create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  freelancer_project_id uuid references freelancer_projects(id) on delete cascade,
  opened_by_profile_id uuid not null references profiles(id) on delete cascade,
  opener_role text not null check (opener_role in ('brand', 'creator', 'freelancer')),
  reason text not null,
  evidence_url text,
  status text not null default 'open' check (status in ('open', 'resolved_release', 'resolved_refund', 'resolved_split', 'dismissed')),
  decision_note text,
  resolved_by_profile_id uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint disputes_target_check check (
    (deal_id is not null and freelancer_project_id is null)
    or (deal_id is null and freelancer_project_id is not null)
  )
);

create index if not exists disputes_deal_id_idx on disputes(deal_id);
create index if not exists disputes_freelancer_project_id_idx on disputes(freelancer_project_id);
create index if not exists disputes_status_idx on disputes(status);
create index if not exists disputes_opened_by_idx on disputes(opened_by_profile_id);

alter table deals add column if not exists dispute_status text default 'none' check (dispute_status in ('none', 'open', 'resolved'));
alter table freelancer_projects add column if not exists dispute_status text default 'none' check (dispute_status in ('none', 'open', 'resolved'));
