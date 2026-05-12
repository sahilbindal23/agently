-- Admin emergency freeze for trust-and-safety incidents.
--
-- When we get a report of fraud, abuse, or a payment dispute that can't
-- wait for normal resolution, an admin should be able to freeze the
-- account in seconds. Frozen accounts:
--   - cannot log in (enforced server-side in /api/auth/login)
--   - existing sessions continue until cookie expiry (we don't currently
--     have an admin-triggered global signout, but the next refresh will
--     fail because Supabase still validates the user)
--   - all writes via API routes should be guarded by checking this flag
--     (next iteration — for now, blocking login is the high-leverage
--      defence)

alter table profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'frozen'));

alter table profiles
  add column if not exists frozen_at timestamptz;

alter table profiles
  add column if not exists frozen_reason text;

alter table profiles
  add column if not exists frozen_by_profile_id uuid references profiles(id) on delete set null;

-- Partial index because the overwhelming majority of rows are 'active' —
-- we only need fast lookups on the small frozen subset.
create index if not exists profiles_account_status_idx
  on profiles(account_status, frozen_at desc)
  where account_status != 'active';
