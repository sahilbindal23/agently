create table if not exists recommendation_outcome_ledger (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  entity_type text not null check (entity_type in ('creator', 'freelancer')),
  entity_id uuid not null,
  recommendation_snapshot_id uuid references campaign_recommendation_snapshots(id) on delete set null,
  input_snapshot jsonb not null default '{}'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  roi_estimate jsonb not null default '{}'::jsonb,
  prediction jsonb not null default '{}'::jsonb,
  original_rank integer,
  final_rank integer,
  base_fit_score numeric,
  final_fit_score numeric,
  marketplace_signals text[] not null default '{}',
  shortlisted boolean not null default false,
  offer_sent boolean not null default false,
  offer_id uuid references deals(id) on delete set null,
  freelancer_project_id uuid references freelancer_projects(id) on delete set null,
  offer_amount_cents integer,
  response_status text,
  counter_amount_cents integer,
  final_agreed_amount_cents integer,
  payment_status text,
  deliverable_status text,
  brand_feedback_score numeric,
  talent_feedback_score numeric,
  outcome_label text,
  outcome_notes text,
  last_event_name text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, entity_type, entity_id)
);

create index if not exists recommendation_outcome_ledger_campaign_idx on recommendation_outcome_ledger(campaign_id, final_rank);
create index if not exists recommendation_outcome_ledger_entity_idx on recommendation_outcome_ledger(entity_type, entity_id);
create index if not exists recommendation_outcome_ledger_outcome_idx on recommendation_outcome_ledger(outcome_label);
create index if not exists recommendation_outcome_ledger_prediction_gin_idx on recommendation_outcome_ledger using gin (prediction);

alter table recommendation_outcome_ledger enable row level security;

drop policy if exists "Admins can manage recommendation outcome ledger" on recommendation_outcome_ledger;
create policy "Admins can manage recommendation outcome ledger"
  on recommendation_outcome_ledger
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

drop policy if exists "Brands can read own recommendation outcome ledger" on recommendation_outcome_ledger;
create policy "Brands can read own recommendation outcome ledger"
  on recommendation_outcome_ledger
  for select
  using (
    exists (
      select 1 from campaigns
      where campaigns.id = recommendation_outcome_ledger.campaign_id
      and campaigns.profile_id = auth.uid()
    )
  );
