-- Campaign applications: creators can apply to open campaigns.
--
-- Schema-wise this is the same shape as a brand-initiated invite — both
-- map to (campaign_id, creator_id, status) — so we extend the existing
-- campaign_invites table with a `source` column rather than creating a
-- parallel applications table. Saves a join when listing both kinds for
-- the brand's "review" tab.
--
--   source = 'brand_invite'        → brand reached out to the creator
--   source = 'creator_application' → creator applied to an open campaign

alter table campaign_invites
  add column if not exists source text not null default 'brand_invite'
    check (source in ('brand_invite', 'creator_application'));

-- Index for the brand-side query "show me everyone who applied to my
-- campaign X". Filtering by campaign_id + source is the hot path.
create index if not exists campaign_invites_source_idx
  on campaign_invites(campaign_id, source);

-- Let creators see and create applications for themselves. Existing
-- "admins manage" and "brands read own" policies stay in place; we add
-- two creator-scoped policies.
drop policy if exists "creators read own campaign applications" on campaign_invites;
create policy "creators read own campaign applications" on campaign_invites
  for select using (
    exists (
      select 1 from creators c
      where c.id = campaign_invites.creator_id
        and c.profile_id = (select auth.uid())
    )
  );

drop policy if exists "creators create own campaign applications" on campaign_invites;
create policy "creators create own campaign applications" on campaign_invites
  for insert with check (
    source = 'creator_application'
    and exists (
      select 1 from creators c
      where c.id = campaign_invites.creator_id
        and c.profile_id = (select auth.uid())
    )
    and exists (
      select 1 from campaigns ca
      where ca.id = campaign_invites.campaign_id
        and ca.visibility = 'open'
    )
  );
