-- Supabase Advisor: RLS Enabled No Policy
-- These tables had RLS enabled but no explicit policies, which is secure by
-- default but noisy in Advisor. Add narrow admin-only policies so intent is
-- explicit while normal app access continues through service-role routes.

drop policy if exists "admins manage ai valuations" on public.ai_valuations;
create policy "admins manage ai valuations"
  on public.ai_valuations
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

drop policy if exists "admins manage benchmark sources" on public.benchmark_sources;
create policy "admins manage benchmark sources"
  on public.benchmark_sources
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

drop policy if exists "admins manage brand matches" on public.brand_matches;
create policy "admins manage brand matches"
  on public.brand_matches
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );
