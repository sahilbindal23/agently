alter table creators
  add column if not exists verification_status text default 'unverified',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references profiles(id) on delete set null,
  add column if not exists verification_notes text;

alter table freelancers
  add column if not exists verification_status text default 'unverified',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references profiles(id) on delete set null,
  add column if not exists verification_notes text;

alter table brands
  add column if not exists verification_status text default 'unverified',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references profiles(id) on delete set null,
  add column if not exists verification_notes text;

update creators
set verification_status = case
  when coalesce(monetization_score, 0) >= 75 and coalesce(india_audience_percent, 0) >= 50 then 'verified'
  when coalesce(monetization_score, 0) >= 55 then 'reviewing'
  else coalesce(verification_status, 'unverified')
end,
verified_at = case
  when coalesce(monetization_score, 0) >= 75 and coalesce(india_audience_percent, 0) >= 50 then coalesce(verified_at, now())
  else verified_at
end
where verification_status is null or verification_status = 'unverified';

update freelancers
set verification_status = case
  when coalesce(portfolio_score, 0) >= 80 then 'verified'
  when coalesce(portfolio_score, 0) >= 60 then 'reviewing'
  else coalesce(verification_status, 'unverified')
end,
verified_at = case
  when coalesce(portfolio_score, 0) >= 80 then coalesce(verified_at, now())
  else verified_at
end
where verification_status is null or verification_status = 'unverified';

update brands
set verification_status = case
  when status in ('active', 'enrolled') then 'verified'
  else coalesce(verification_status, 'unverified')
end,
verified_at = case
  when status in ('active', 'enrolled') then coalesce(verified_at, now())
  else verified_at
end
where verification_status is null or verification_status = 'unverified';
