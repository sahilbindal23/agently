-- Supabase advisor cleanup pass.
--
-- Two classes of issue addressed:
--
--   1. CRITICAL — Security Definer View on benchmark_anomalies_review.
--      Postgres views default to using the view CREATOR's permissions
--      rather than the querying user's. That means RLS policies on the
--      underlying tables are NOT enforced when reading through the view.
--      Fix: recreate with `security_invoker = true` so RLS applies.
--
--   2. WARNING — Auth RLS Initialization Plan on every policy that calls
--      auth.uid() directly. Postgres re-evaluates the function once per
--      row, which is slow on tables with thousands of rows. Wrapping in
--      (select auth.uid()) lets the planner evaluate it ONCE per query.
--      The semantics are identical; only performance changes.
--
-- This migration only touches policies that were flagged. Policies that
-- already wrap auth.uid() in a subquery, or that go through SECURITY
-- DEFINER helper functions (is_admin, owns_*, can_access_*), are fine.

-- =============================================================================
-- 1. Fix the SECURITY DEFINER view (CRITICAL)
-- =============================================================================

drop view if exists public.benchmark_anomalies_review cascade;
create view public.benchmark_anomalies_review
  with (security_invoker = true)
as
select
  a.*,
  o.platform,
  o.niche,
  o.deliverable_type,
  o.tier,
  o.deal_id,
  o.freelancer_project_id,
  o.observed_at,
  s.slug as source_slug_resolved,
  s.kind as source_kind
from benchmark_anomalies a
left join rate_observations o on o.id = a.observation_id
left join benchmark_sources s on s.id = o.source_id;

-- =============================================================================
-- 2. Rewrite legacy policies to use (select auth.uid()) (WARNING)
-- =============================================================================

-- profiles: own or admin
drop policy if exists "profiles own or admin" on profiles;
create policy "profiles own or admin" on profiles
  for select using (
    (select auth.uid()) = id
    or public.is_admin()
  );

-- creators: admin manage + read own
drop policy if exists "admins manage creators" on creators;
create policy "admins manage creators" on creators
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "creators read own profile" on creators;
create policy "creators read own profile" on creators
  for select using (profile_id = (select auth.uid()));

-- brands: admin manage
drop policy if exists "admins manage brands" on brands;
create policy "admins manage brands" on brands
  for all using (public.is_admin())
  with check (public.is_admin());

-- deals: admin manage + creator read
drop policy if exists "admins manage deals" on deals;
create policy "admins manage deals" on deals
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "creators read own deals" on deals;
create policy "creators read own deals" on deals
  for select using (
    exists (
      select 1 from creators c
      where c.id = deals.creator_id
        and c.profile_id = (select auth.uid())
    )
  );

-- payments + contracts: admin manage
drop policy if exists "admins manage payments" on payments;
create policy "admins manage payments" on payments
  for all using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins manage contracts" on contracts;
create policy "admins manage contracts" on contracts
  for all using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- 3. Hardening pass: rewrite production policies that use raw auth.uid()
--    (from migration 043). Same performance issue, same fix.
-- =============================================================================

drop policy if exists "users update own profile" on profiles;
create policy "users update own profile" on profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "creators update own profile" on creators;
create policy "creators update own profile" on creators
  for update using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists "freelancers update own profile" on freelancers;
create policy "freelancers update own profile" on freelancers
  for update using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists "parties insert own contracts" on contracts;
create policy "parties insert own contracts" on contracts
  for insert with check (
    uploaded_by = (select auth.uid())
    and public.can_access_deal(deal_id)
  );

drop policy if exists "parties create own disputes" on disputes;
create policy "parties create own disputes" on disputes
  for insert with check (
    opened_by_profile_id = (select auth.uid())
    and (
      (deal_id is not null and public.can_access_deal(deal_id))
      or (freelancer_project_id is not null and public.can_access_freelancer_project(freelancer_project_id))
    )
  );

drop policy if exists "participants create message threads" on message_threads;
create policy "participants create message threads" on message_threads
  for insert with check (created_by = (select auth.uid()));

drop policy if exists "participants create message participants" on message_thread_participants;
create policy "participants create message participants" on message_thread_participants
  for insert with check (
    profile_id = (select auth.uid())
    or exists (
      select 1 from message_threads mt
      where mt.id = message_thread_participants.thread_id
        and mt.created_by = (select auth.uid())
    )
  );

drop policy if exists "participants update own message participants" on message_thread_participants;
create policy "participants update own message participants" on message_thread_participants
  for update using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists "participants create messages" on messages;
create policy "participants create messages" on messages
  for insert with check (
    sender_profile_id = (select auth.uid())
    and public.can_access_thread(thread_id)
  );

drop policy if exists "users read own connected social accounts" on connected_social_accounts;
create policy "users read own connected social accounts" on connected_social_accounts
  for select using (
    profile_id = (select auth.uid())
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
          csa.profile_id = (select auth.uid())
          or (csa.creator_id is not null and public.owns_creator(csa.creator_id))
          or (csa.brand_id is not null and public.owns_brand(csa.brand_id))
          or (csa.freelancer_id is not null and public.owns_freelancer(csa.freelancer_id))
        )
    )
  );

-- Storage policies use auth.role() and auth.uid() raw - same fix.
drop policy if exists "authenticated upload profile images" on storage.objects;
create policy "authenticated upload profile images" on storage.objects
  for insert with check (
    bucket_id = 'profile-images'
    and (select auth.role()) = 'authenticated'
  );

drop policy if exists "authenticated update profile images" on storage.objects;
create policy "authenticated update profile images" on storage.objects
  for update using (
    bucket_id = 'profile-images'
    and (select auth.role()) = 'authenticated'
  )
  with check (
    bucket_id = 'profile-images'
    and (select auth.role()) = 'authenticated'
  );

drop policy if exists "authenticated delete profile images" on storage.objects;
create policy "authenticated delete profile images" on storage.objects
  for delete using (
    bucket_id = 'profile-images'
    and (select auth.role()) = 'authenticated'
  );

drop policy if exists "authenticated upload private agently assets" on storage.objects;
create policy "authenticated upload private agently assets" on storage.objects
  for insert with check (
    bucket_id in ('contracts', 'portfolio-assets', 'deliverable-assets')
    and (select auth.role()) = 'authenticated'
  );

drop policy if exists "authenticated read own private agently assets" on storage.objects;
create policy "authenticated read own private agently assets" on storage.objects
  for select using (
    bucket_id in ('contracts', 'portfolio-assets', 'deliverable-assets')
    and (
      public.is_admin()
      or owner = (select auth.uid())
      or name like (select auth.uid())::text || '/%'
    )
  );

-- =============================================================================
-- 4. Account deletion policies (migration 045) - same fix
-- =============================================================================

drop policy if exists "users read own deletion requests" on account_deletion_requests;
create policy "users read own deletion requests" on account_deletion_requests
  for select using (profile_id = (select auth.uid()) or public.is_admin());

drop policy if exists "users create own deletion requests" on account_deletion_requests;
create policy "users create own deletion requests" on account_deletion_requests
  for insert with check (profile_id = (select auth.uid()));
