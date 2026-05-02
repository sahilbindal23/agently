alter table creators
  add column if not exists verification_tier text default 'unverified',
  add column if not exists verification_checks jsonb default '{}';

alter table freelancers
  add column if not exists verification_tier text default 'unverified',
  add column if not exists verification_checks jsonb default '{}';

alter table brands
  add column if not exists verification_tier text default 'unverified',
  add column if not exists verification_checks jsonb default '{}';

update creators
set verification_tier = case
  when verification_status = 'verified' then 'profile'
  when verification_status = 'reviewing' then 'reviewing'
  when verification_status = 'rejected' then 'rejected'
  else coalesce(verification_tier, 'unverified')
end
where verification_tier is null or verification_tier = 'unverified';

update freelancers
set verification_tier = case
  when verification_status = 'verified' then 'profile'
  when verification_status = 'reviewing' then 'reviewing'
  when verification_status = 'rejected' then 'rejected'
  else coalesce(verification_tier, 'unverified')
end
where verification_tier is null or verification_tier = 'unverified';

update brands
set verification_tier = case
  when verification_status = 'verified' then 'profile'
  when verification_status = 'reviewing' then 'reviewing'
  when verification_status = 'rejected' then 'rejected'
  else coalesce(verification_tier, 'unverified')
end
where verification_tier is null or verification_tier = 'unverified';
