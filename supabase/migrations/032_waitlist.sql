-- Early-access waitlist for the beta launch.
--
-- During beta we don't open self-serve signup to everyone — we concierge-
-- onboard in small batches to keep the marketplace dense on the supply side
-- (see the launch plan). This table captures "request early access" submissions
-- from the public /early-access page so we can review, prioritise, and invite
-- people in controlled waves.
--
-- It is deliberately NOT the profiles/auth table: a waitlist row is just an
-- expression of interest, not an account. When we invite someone they go
-- through the normal /signup + /intake flow, at which point a real profile is
-- created. status tracks where each lead is in that pipeline.

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  -- Which side of the marketplace they're joining as. Defaults to creator
  -- because the beta seeds the supply (creator/freelancer) side first, but the
  -- column is general so the same table can capture brands later.
  role text not null default 'creator' check (role in ('creator', 'brand', 'freelancer')),
  full_name text not null,
  email text not null,
  -- Lightweight profile snapshot so we can prioritise invites by niche/size
  -- without making people fill a full intake before they're even accepted.
  primary_platform text,
  handle text,
  primary_niche text,
  follower_band text,
  city text,
  note text,
  -- Pipeline state: pending (new) -> invited (we sent an invite) ->
  -- joined (they created an account) | rejected (not a fit for beta).
  status text not null default 'pending' check (status in ('pending', 'invited', 'joined', 'rejected')),
  -- Attribution: where the lead came from (e.g. 'instagram_ad', 'organic').
  source text,
  -- DPDP Act 2023: record explicit consent to be contacted, plus the request
  -- metadata, so the consent can't be faked client-side.
  consent_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- One waitlist entry per email per role. A creator and a brand could share an
-- email (e.g. a solo founder wearing both hats), so the uniqueness is on the
-- pair, not email alone. Re-submitting the same pair is treated as idempotent
-- by the API rather than erroring.
create unique index if not exists waitlist_email_role_idx on waitlist (lower(email), role);
create index if not exists waitlist_status_idx on waitlist (status, created_at desc);

alter table waitlist enable row level security;

-- Public inserts happen via the service-role API route (which bypasses RLS),
-- so no anon insert policy is needed. Lock reads/writes to admins only so the
-- list of leads is never exposed through the anon key.
drop policy if exists "Admins manage waitlist" on waitlist;
create policy "Admins manage waitlist"
  on waitlist
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
