-- Allow brands (and freelancers) to connect social accounts the same way
-- creators can. Reuses the connected_social_accounts table by adding
-- entity-specific FKs and relaxing the unique constraint.

alter table connected_social_accounts
  add column if not exists brand_id uuid references brands(id) on delete cascade,
  add column if not exists freelancer_id uuid references freelancers(id) on delete cascade;

-- Drop the old creator-only unique constraint and replace with a per-entity
-- index that lets exactly one of creator_id / brand_id / freelancer_id be set.
alter table connected_social_accounts
  drop constraint if exists connected_social_accounts_creator_id_provider_handle_key;

create unique index if not exists connected_social_accounts_creator_uniq
  on connected_social_accounts(creator_id, provider, handle)
  where creator_id is not null;
create unique index if not exists connected_social_accounts_brand_uniq
  on connected_social_accounts(brand_id, provider, handle)
  where brand_id is not null;
create unique index if not exists connected_social_accounts_freelancer_uniq
  on connected_social_accounts(freelancer_id, provider, handle)
  where freelancer_id is not null;

create index if not exists connected_social_accounts_brand_idx
  on connected_social_accounts(brand_id) where brand_id is not null;
create index if not exists connected_social_accounts_freelancer_idx
  on connected_social_accounts(freelancer_id) where freelancer_id is not null;
