-- Platform-generated signed agreements between brand and talent.
-- Distinct from the existing `contracts` table (which holds external
-- brand-supplied contracts being scanned for risk).
-- Agreement is auto-generated when an offer is accepted, snapshotting the
-- agreed terms, and must be signed by both parties before payment can fund.

create table if not exists deal_agreements (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  freelancer_project_id uuid references freelancer_projects(id) on delete cascade,
  template_version text not null default 'v1',
  -- Snapshot of the offer terms at agreement-generation time so later
  -- amount/scope changes don't silently mutate the agreed-on contract.
  rendered_terms jsonb not null,
  rendered_html text not null,

  brand_signed_at timestamptz,
  brand_signed_name text,
  brand_signed_profile_id uuid references profiles(id) on delete set null,
  brand_signed_ip text,

  talent_signed_at timestamptz,
  talent_signed_name text,
  talent_signed_profile_id uuid references profiles(id) on delete set null,
  talent_signed_ip text,

  status text not null default 'pending_signatures'
    check (status in ('pending_signatures', 'fully_signed', 'voided')),
  fully_signed_at timestamptz,
  voided_at timestamptz,
  voided_reason text,

  created_at timestamptz not null default now(),

  constraint deal_agreements_target_check check (
    (deal_id is not null and freelancer_project_id is null) or
    (deal_id is null and freelancer_project_id is not null)
  )
);

create index if not exists deal_agreements_deal_idx on deal_agreements(deal_id);
create index if not exists deal_agreements_project_idx on deal_agreements(freelancer_project_id);
create index if not exists deal_agreements_status_idx on deal_agreements(status);

-- Only one active (non-voided) agreement per deal or project at a time.
create unique index if not exists deal_agreements_deal_active_uniq
  on deal_agreements(deal_id)
  where status != 'voided' and deal_id is not null;
create unique index if not exists deal_agreements_project_active_uniq
  on deal_agreements(freelancer_project_id)
  where status != 'voided' and freelancer_project_id is not null;

alter table deal_agreements enable row level security;
drop policy if exists "Parties can read their agreement" on deal_agreements;
create policy "Parties can read their agreement"
  on deal_agreements for select
  using (
    -- Admin
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    -- Brand party (resolved via brand contact_email)
    or exists (
      select 1 from deals d
      join brands b on b.id = d.brand_id
      join profiles p on p.email = b.contact_email
      where d.id = deal_agreements.deal_id and p.id = auth.uid()
    )
    or exists (
      select 1 from freelancer_projects fp
      join brands b on b.id = fp.brand_id
      join profiles p on p.email = b.contact_email
      where fp.id = deal_agreements.freelancer_project_id and p.id = auth.uid()
    )
    -- Talent party
    or exists (
      select 1 from deals d
      join creators c on c.id = d.creator_id
      where d.id = deal_agreements.deal_id and c.profile_id = auth.uid()
    )
    or exists (
      select 1 from freelancer_projects fp
      join freelancers f on f.id = fp.freelancer_id
      where fp.id = deal_agreements.freelancer_project_id and f.profile_id = auth.uid()
    )
  );

-- Track the deal's contract gate. Adds an explicit signal to the deals row
-- so payment / deliverable code can check at a glance.
alter table deals
  add column if not exists agreement_status text default 'not_required'
    check (agreement_status in ('not_required', 'pending_signatures', 'fully_signed', 'voided'));
alter table freelancer_projects
  add column if not exists agreement_status text default 'not_required'
    check (agreement_status in ('not_required', 'pending_signatures', 'fully_signed', 'voided'));
