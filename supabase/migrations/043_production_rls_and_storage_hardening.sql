-- Production hardening pass.
-- Adds reusable ownership helpers, fills RLS gaps around payments/contracts/
-- messages/social accounts, and prepares private storage buckets for
-- contracts, portfolios, and deliverable assets.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.owns_creator(target_creator_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from creators
    where id = target_creator_id
      and profile_id = auth.uid()
  );
$$;

create or replace function public.owns_freelancer(target_freelancer_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from freelancers
    where id = target_freelancer_id
      and profile_id = auth.uid()
  );
$$;

create or replace function public.owns_brand(target_brand_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from brands b
    join profiles p on lower(p.email) = lower(b.contact_email)
    where b.id = target_brand_id
      and p.id = auth.uid()
  );
$$;

create or replace function public.can_access_deal(target_deal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1
      from deals d
      left join creators c on c.id = d.creator_id
      left join brands b on b.id = d.brand_id
      left join profiles bp on lower(bp.email) = lower(b.contact_email)
      where d.id = target_deal_id
        and (
          c.profile_id = auth.uid()
          or bp.id = auth.uid()
        )
    );
$$;

create or replace function public.can_access_freelancer_project(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1
      from freelancer_projects fp
      left join freelancers f on f.id = fp.freelancer_id
      left join brands b on b.id = fp.brand_id
      left join profiles bp on lower(bp.email) = lower(b.contact_email)
      left join campaigns c on c.id = fp.campaign_id
      where fp.id = target_project_id
        and (
          f.profile_id = auth.uid()
          or bp.id = auth.uid()
          or c.profile_id = auth.uid()
        )
    );
$$;

create or replace function public.can_access_contract(target_contract_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1 from contracts c
      where c.id = target_contract_id
        and public.can_access_deal(c.deal_id)
    );
$$;

create or replace function public.can_access_payment(target_payment_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1 from payments p
      where p.id = target_payment_id
        and (
          (p.deal_id is not null and public.can_access_deal(p.deal_id))
          or (p.freelancer_project_id is not null and public.can_access_freelancer_project(p.freelancer_project_id))
        )
    );
$$;

create or replace function public.can_access_thread(target_thread_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1 from message_thread_participants mtp
      where mtp.thread_id = target_thread_id
        and mtp.profile_id = auth.uid()
    );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_creator(uuid) to authenticated;
grant execute on function public.owns_freelancer(uuid) to authenticated;
grant execute on function public.owns_brand(uuid) to authenticated;
grant execute on function public.can_access_deal(uuid) to authenticated;
grant execute on function public.can_access_freelancer_project(uuid) to authenticated;
grant execute on function public.can_access_contract(uuid) to authenticated;
grant execute on function public.can_access_payment(uuid) to authenticated;
grant execute on function public.can_access_thread(uuid) to authenticated;

-- Core profile/entity write ownership. Server routes still use the service
-- role, but these protect future direct Supabase client writes.
drop policy if exists "users update own profile" on profiles;
create policy "users update own profile" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "creators update own profile" on creators;
create policy "creators update own profile" on creators
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "freelancers update own profile" on freelancers;
create policy "freelancers update own profile" on freelancers
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "brands update own profile" on brands;
create policy "brands update own profile" on brands
  for update using (public.owns_brand(id))
  with check (public.owns_brand(id));

-- Deals and freelancer projects are visible to both commercial parties.
drop policy if exists "brands read own deals" on deals;
create policy "brands read own deals" on deals
  for select using (brand_id is not null and public.owns_brand(brand_id));

drop policy if exists "parties read freelancer projects" on freelancer_projects;
create policy "parties read freelancer projects" on freelancer_projects
  for select using (
    public.can_access_freelancer_project(id)
  );

-- Payments should never be globally visible. Admin can still manage all.
drop policy if exists "parties read own payments" on payments;
create policy "parties read own payments" on payments
  for select using (public.can_access_payment(id));

-- Contracts, flags, and deliverables are visible only to deal/project parties.
drop policy if exists "parties read own contracts" on contracts;
create policy "parties read own contracts" on contracts
  for select using (public.can_access_deal(deal_id));

drop policy if exists "parties insert own contracts" on contracts;
create policy "parties insert own contracts" on contracts
  for insert with check (
    uploaded_by = auth.uid()
    and public.can_access_deal(deal_id)
  );

drop policy if exists "parties read own contract flags" on contract_flags;
create policy "parties read own contract flags" on contract_flags
  for select using (public.can_access_contract(contract_id));

drop policy if exists "parties read own deliverables" on deliverables;
create policy "parties read own deliverables" on deliverables
  for select using (public.can_access_deal(deal_id));

drop policy if exists "creators insert own deliverables" on deliverables;
create policy "creators insert own deliverables" on deliverables
  for insert with check (
    exists (
      select 1 from deals d
      where d.id = deliverables.deal_id
        and public.owns_creator(d.creator_id)
    )
  );

-- Disputes were created without RLS in the original migration.
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

alter table deals
  add column if not exists dispute_status text default 'none' check (dispute_status in ('none', 'open', 'resolved'));

alter table freelancer_projects
  add column if not exists dispute_status text default 'none' check (dispute_status in ('none', 'open', 'resolved'));

alter table disputes enable row level security;

drop policy if exists "admins manage disputes" on disputes;
create policy "admins manage disputes" on disputes
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "parties read own disputes" on disputes;
create policy "parties read own disputes" on disputes
  for select using (
    (deal_id is not null and public.can_access_deal(deal_id))
    or (freelancer_project_id is not null and public.can_access_freelancer_project(freelancer_project_id))
  );

drop policy if exists "parties create own disputes" on disputes;
create policy "parties create own disputes" on disputes
  for insert with check (
    opened_by_profile_id = auth.uid()
    and (
      (deal_id is not null and public.can_access_deal(deal_id))
      or (freelancer_project_id is not null and public.can_access_freelancer_project(freelancer_project_id))
    )
  );

-- Message creation/update policies for direct client access.
drop policy if exists "participants create message threads" on message_threads;
create policy "participants create message threads" on message_threads
  for insert with check (created_by = auth.uid());

drop policy if exists "participants update own message threads" on message_threads;
create policy "participants update own message threads" on message_threads
  for update using (public.can_access_thread(id))
  with check (public.can_access_thread(id));

drop policy if exists "participants create message participants" on message_thread_participants;
create policy "participants create message participants" on message_thread_participants
  for insert with check (
    profile_id = auth.uid()
    or exists (
      select 1 from message_threads mt
      where mt.id = message_thread_participants.thread_id
        and mt.created_by = auth.uid()
    )
  );

drop policy if exists "participants update own message participants" on message_thread_participants;
create policy "participants update own message participants" on message_thread_participants
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "participants create messages" on messages;
create policy "participants create messages" on messages
  for insert with check (
    sender_profile_id = auth.uid()
    and public.can_access_thread(thread_id)
  );

-- Social account RLS now covers brands and freelancers as well as creators.
drop policy if exists "users read own connected social accounts" on connected_social_accounts;
create policy "users read own connected social accounts" on connected_social_accounts
  for select using (
    profile_id = auth.uid()
    or (creator_id is not null and public.owns_creator(creator_id))
    or (brand_id is not null and public.owns_brand(brand_id))
    or (freelancer_id is not null and public.owns_freelancer(freelancer_id))
  );

drop policy if exists "users read own social metric snapshots" on social_metric_snapshots;
create policy "users read own social metric snapshots" on social_metric_snapshots
  for select using (
    exists (
      select 1 from connected_social_accounts csa
      where csa.id = social_metric_snapshots.connected_account_id
        and (
          csa.profile_id = auth.uid()
          or (csa.creator_id is not null and public.owns_creator(csa.creator_id))
          or (csa.brand_id is not null and public.owns_brand(csa.brand_id))
          or (csa.freelancer_id is not null and public.owns_freelancer(csa.freelancer_id))
        )
    )
  );

-- Storage buckets. Profile images stay public; commercial docs/assets are
-- private and should be served through signed URLs or server routes.
insert into storage.buckets (id, name, public)
values
  ('profile-images', 'profile-images', true),
  ('contracts', 'contracts', false),
  ('portfolio-assets', 'portfolio-assets', false),
  ('deliverable-assets', 'deliverable-assets', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public read profile images" on storage.objects;
create policy "public read profile images" on storage.objects
  for select using (bucket_id = 'profile-images');

drop policy if exists "authenticated upload profile images" on storage.objects;
create policy "authenticated upload profile images" on storage.objects
  for insert with check (
    bucket_id = 'profile-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "authenticated update profile images" on storage.objects;
create policy "authenticated update profile images" on storage.objects
  for update using (
    bucket_id = 'profile-images'
    and auth.role() = 'authenticated'
  )
  with check (
    bucket_id = 'profile-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "authenticated delete profile images" on storage.objects;
create policy "authenticated delete profile images" on storage.objects
  for delete using (
    bucket_id = 'profile-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "authenticated upload private agently assets" on storage.objects;
create policy "authenticated upload private agently assets" on storage.objects
  for insert with check (
    bucket_id in ('contracts', 'portfolio-assets', 'deliverable-assets')
    and auth.role() = 'authenticated'
  );

drop policy if exists "authenticated read own private agently assets" on storage.objects;
create policy "authenticated read own private agently assets" on storage.objects
  for select using (
    bucket_id in ('contracts', 'portfolio-assets', 'deliverable-assets')
    and (
      public.is_admin()
      or owner = auth.uid()
      or name like auth.uid()::text || '/%'
    )
  );
