-- Supabase Advisor: Auth RLS Initialization Plan
-- Wrap auth.uid() in scalar subqueries so Postgres evaluates the current
-- user once per query instead of once per row for creator audit policies.

drop policy if exists "admins manage creator audits" on creator_audits;
create policy "admins manage creator audits"
  on creator_audits
  for all
  using (
    exists (
      select 1
      from profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

drop policy if exists "creators read own audits" on creator_audits;
create policy "creators read own audits"
  on creator_audits
  for select
  using (profile_id = (select auth.uid()));
