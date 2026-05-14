-- Supabase Advisor cleanup:
-- 1. Function Search Path Mutable: pin refresh_benchmark_aggregates search_path.
-- 2. Materialized View in API: remove direct API access to benchmark aggregates.
-- 3. Public Bucket Allows Listing: remove broad SELECT policy from public profile image bucket.
-- 4. Public Can Execute SECURITY DEFINER Function: make contract access helper authenticated-only.

-- Keep the benchmark refresh function service-role friendly, but make its
-- execution environment deterministic.
create or replace function public.refresh_benchmark_aggregates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.rate_benchmark_aggregates;
  refresh materialized view concurrently public.engagement_benchmark_aggregates;
end;
$$;

revoke all on function public.refresh_benchmark_aggregates() from public;
revoke all on function public.refresh_benchmark_aggregates() from anon;
revoke all on function public.refresh_benchmark_aggregates() from authenticated;
grant execute on function public.refresh_benchmark_aggregates() to service_role;

-- These aggregate materialized views are backend engine inputs, not public
-- Data API resources. Server-side code reads them through the service role.
revoke all on public.rate_benchmark_aggregates from public;
revoke all on public.rate_benchmark_aggregates from anon;
revoke all on public.rate_benchmark_aggregates from authenticated;
grant select on public.rate_benchmark_aggregates to service_role;

revoke all on public.engagement_benchmark_aggregates from public;
revoke all on public.engagement_benchmark_aggregates from anon;
revoke all on public.engagement_benchmark_aggregates from authenticated;
grant select on public.engagement_benchmark_aggregates to service_role;

-- profile-images is a public bucket, so object URLs can remain public without
-- allowing clients to list every object through storage.objects SELECT.
drop policy if exists "public read profile images" on storage.objects;

-- can_access_contract is meant as an RLS helper for signed-in users, not as a
-- public RPC endpoint. Keep authenticated execution for contract policies.
revoke all on function public.can_access_contract(uuid) from public;
revoke all on function public.can_access_contract(uuid) from anon;
revoke all on function public.can_access_contract(uuid) from authenticated;
grant execute on function public.can_access_contract(uuid) to authenticated;
grant execute on function public.can_access_contract(uuid) to service_role;
