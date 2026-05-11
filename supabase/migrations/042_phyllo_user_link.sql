-- Track the Phyllo user_id we create for each Agently profile so subsequent
-- SDK token requests can reuse the same Phyllo user (and accumulate connected
-- accounts under it).

alter table profiles
  add column if not exists phyllo_user_id text,
  add column if not exists phyllo_user_created_at timestamptz;

create index if not exists profiles_phyllo_user_idx on profiles(phyllo_user_id) where phyllo_user_id is not null;

-- Phyllo's account_id is the persistent identifier for a single connected
-- social account (Instagram handle, YouTube channel, etc.). We use it to
-- fetch fresh metrics and to disconnect.
alter table connected_social_accounts
  add column if not exists phyllo_account_id text,
  add column if not exists phyllo_work_platform_id text;

create index if not exists connected_social_accounts_phyllo_account_idx
  on connected_social_accounts(phyllo_account_id) where phyllo_account_id is not null;
