-- ============================================================================
-- WIPE ALL NON-ADMIN USER ACCOUNTS
-- ============================================================================
--
-- Use case: clean slate before inviting beta testers so they can sign up
-- fresh with their real emails.
--
-- What this preserves:
--   - Your admin account(s) — anything where profiles.role = 'admin'
--   - Demo data — anything where is_demo = true (the seeded demo
--     creators / brands / freelancers used for testing the UI)
--   - Rate benchmarks, audit_logs, product_events — historical data
--     not tied to a single user
--
-- What this deletes:
--   - All non-admin auth.users + profiles
--   - All creator / freelancer / brand rows owned by those profiles
--     (UNLESS they are flagged is_demo = true)
--   - All deals / contracts / payments / disputes / deliverables that
--     cascade from those rows
--   - All connected social accounts + snapshots for those profiles
--   - All campaigns, shortlists, invites tied to deleted brands
--   - All messages / threads / notifications / deletion requests
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Run PHASE 1 first to see what will be deleted (no changes made)
--   3. If counts look right, run PHASE 2 inside a transaction
--   4. Run PHASE 3 to delete the auth.users entries
--
-- ============================================================================

-- ============================================================================
-- PHASE 1 — Preview. Run this first to see what will be wiped.
-- ============================================================================

with targets as (
  select id, email, role, created_at
  from public.profiles
  where role != 'admin'
)
select
  'Non-admin profiles to delete' as bucket,
  count(*) as count
from targets
union all
select 'Creators (non-demo) to delete', count(*)
  from public.creators
  where (is_demo is null or is_demo = false)
    and profile_id in (select id from public.profiles where role != 'admin')
union all
select 'Freelancers (non-demo) to delete', count(*)
  from public.freelancers
  where (is_demo is null or is_demo = false)
    and profile_id in (select id from public.profiles where role != 'admin')
union all
select 'Brands (non-demo) tied to non-admin profiles', count(*)
  from public.brands b
  where (b.is_demo is null or b.is_demo = false)
    and lower(b.contact_email) in (
      select lower(email) from public.profiles where role != 'admin'
    )
union all
select 'Deals to cascade-delete', count(*)
  from public.deals d
  where d.creator_id in (
    select id from public.creators
    where profile_id in (select id from public.profiles where role != 'admin')
      and (is_demo is null or is_demo = false)
  )
union all
select 'Auth users to delete', count(*)
  from auth.users u
  where u.id in (select id from public.profiles where role != 'admin');

-- ============================================================================
-- PHASE 2 — Wipe application data. Wraps in a transaction so you can ROLLBACK
-- if the row counts look wrong after delete. COMMIT to make permanent.
-- ============================================================================

begin;

-- Hold the IDs we're nuking in a temp table for reuse
create temp table _doomed_profiles on commit drop as
  select id, lower(email) as email
  from public.profiles
  where role != 'admin';

create temp table _doomed_creators on commit drop as
  select c.id
  from public.creators c
  where (c.is_demo is null or c.is_demo = false)
    and c.profile_id in (select id from _doomed_profiles);

create temp table _doomed_freelancers on commit drop as
  select f.id
  from public.freelancers f
  where (f.is_demo is null or f.is_demo = false)
    and f.profile_id in (select id from _doomed_profiles);

create temp table _doomed_brands on commit drop as
  select b.id
  from public.brands b
  where (b.is_demo is null or b.is_demo = false)
    and lower(b.contact_email) in (select email from _doomed_profiles);

-- Most child tables have ON DELETE CASCADE from deals / contracts /
-- creators / brands / freelancer_projects, so we only need to delete
-- the parents. Tables WITHOUT cascade are listed first.

-- Tables tied to profile_id directly
delete from public.app_notifications where profile_id in (select id from _doomed_profiles);
delete from public.notification_preferences where profile_id in (select id from _doomed_profiles);
delete from public.account_deletion_requests where profile_id in (select id from _doomed_profiles);
delete from public.connected_social_accounts where profile_id in (select id from _doomed_profiles);

-- Brand-side data (brand_audits, campaigns, campaign_invites, campaign_shortlists)
delete from public.campaign_invites where campaign_id in (
  select id from public.campaigns where brand_id in (select id from _doomed_brands)
);
delete from public.campaign_shortlists where campaign_id in (
  select id from public.campaigns where brand_id in (select id from _doomed_brands)
);
delete from public.campaigns where brand_id in (select id from _doomed_brands);
delete from public.brand_audits where brand_id in (select id from _doomed_brands);
delete from public.brand_matches where brand_id in (select id from _doomed_brands);

-- Deals cascade through contracts, payments, deliverables, disputes
delete from public.deals where creator_id in (select id from _doomed_creators);
delete from public.deals where brand_id in (select id from _doomed_brands);

-- Freelancer projects cascade similarly
delete from public.freelancer_projects where freelancer_id in (select id from _doomed_freelancers);
delete from public.freelancer_projects where brand_id in (select id from _doomed_brands);

-- Creator / freelancer / brand auxiliary data
delete from public.creator_platforms where creator_id in (select id from _doomed_creators);
delete from public.creator_audits where creator_id in (select id from _doomed_creators);
delete from public.ai_valuations where creator_id in (select id from _doomed_creators);
delete from public.outreach_messages where creator_id in (select id from _doomed_creators);
delete from public.freelancer_service_rates where freelancer_id in (select id from _doomed_freelancers);
delete from public.portfolio_items where freelancer_id in (select id from _doomed_freelancers);

-- Now the parent rows
delete from public.creators where id in (select id from _doomed_creators);
delete from public.freelancers where id in (select id from _doomed_freelancers);
delete from public.brands where id in (select id from _doomed_brands);

-- Message threads where any participant is a doomed profile
delete from public.message_threads where id in (
  select thread_id from public.message_thread_participants
  where profile_id in (select id from _doomed_profiles)
);

-- Finally the profiles themselves
delete from public.profiles where id in (select id from _doomed_profiles);

-- Sanity check before commit
select 'Remaining non-admin profiles (should be 0)' as label, count(*)
  from public.profiles where role != 'admin';

-- If the counts look right, run:
--   commit;
-- If anything looks wrong, run:
--   rollback;

-- ============================================================================
-- PHASE 3 — Delete the auth.users entries.
-- Run this ONLY after Phase 2 has been committed.
-- ============================================================================
--
-- This deletes the actual Supabase Auth records so the same email can sign
-- up again. Cannot be rolled back. Run only after PHASE 2 is committed.
--
-- ⚠️  CRITICAL SAFETY: explicitly EXISTS-join against the admin profiles
-- so we are positively whitelisting admins, not negatively excluding them.
-- An earlier version of this used `id NOT IN (select id from public.profiles)`
-- which is unsafe — Postgres treats `x NOT IN (empty_set)` as TRUE for
-- every row, so if the profiles table was unexpectedly empty the delete
-- would wipe ALL auth.users including admins.
--
-- delete from auth.users
-- where not exists (
--   select 1 from public.profiles p
--   where p.id = auth.users.id
--     and p.role = 'admin'
-- );
--
-- Verify cleanup with:
-- select count(*) as remaining_admin_auth_users from auth.users;  -- should match admin profile count
-- select count(*) as total_profiles from public.profiles where role = 'admin';
