-- Allow 'twitter' as a connected_social_accounts provider value.
-- The original check constraint from migration 024 only permitted
-- instagram / facebook / youtube.

alter table connected_social_accounts
  drop constraint if exists connected_social_accounts_provider_check;

alter table connected_social_accounts
  add constraint connected_social_accounts_provider_check
  check (provider in ('instagram', 'facebook', 'youtube', 'twitter'));
