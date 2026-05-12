-- Account deletion requests support self-serve deletion while protecting
-- active payment, deliverable, offer, and dispute workflows.

alter table profiles
  add column if not exists deletion_status text not null default 'active',
  add column if not exists deletion_requested_at timestamptz;

create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  email text not null,
  role text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'completed', 'rejected', 'cancelled')),
  reason text,
  blockers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references profiles(id) on delete set null
);

create index if not exists account_deletion_requests_profile_idx on account_deletion_requests(profile_id, requested_at desc);
create index if not exists account_deletion_requests_status_idx on account_deletion_requests(status, requested_at desc);

alter table account_deletion_requests enable row level security;

drop policy if exists "users read own deletion requests" on account_deletion_requests;
create policy "users read own deletion requests" on account_deletion_requests
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "users create own deletion requests" on account_deletion_requests;
create policy "users create own deletion requests" on account_deletion_requests
  for insert with check (profile_id = auth.uid());

drop policy if exists "admins manage deletion requests" on account_deletion_requests;
create policy "admins manage deletion requests" on account_deletion_requests
  for all using (public.is_admin())
  with check (public.is_admin());
