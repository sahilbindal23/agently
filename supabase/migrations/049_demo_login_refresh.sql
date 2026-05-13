-- Refresh public beta/demo login emails to the agently.co.in domain.
-- Passwords are stored in Supabase Auth, not Postgres; update those in
-- Authentication > Users or create the users with the password documented in
-- docs/remote-testing.md.

update profiles
set email = 'admin.demo@agently.co.in'
where lower(email) = 'admin@agently.demo'
  and not exists (select 1 from profiles where lower(email) = 'admin.demo@agently.co.in');

update profiles
set email = 'creator.demo@agently.co.in'
where lower(email) = 'creator@agently.demo'
  and not exists (select 1 from profiles where lower(email) = 'creator.demo@agently.co.in');

update profiles
set email = 'brand.demo@agently.co.in'
where lower(email) = 'brand@agently.demo'
  and not exists (select 1 from profiles where lower(email) = 'brand.demo@agently.co.in');

update profiles
set email = 'freelancer.demo@agently.co.in'
where lower(email) = 'freelancer@agently.demo'
  and not exists (select 1 from profiles where lower(email) = 'freelancer.demo@agently.co.in');

update brands
set contact_email = 'brand.demo@agently.co.in'
where lower(contact_email) = 'brand@agently.demo';

update profiles
set is_demo = true
where lower(email) in (
  'admin.demo@agently.co.in',
  'creator.demo@agently.co.in',
  'brand.demo@agently.co.in',
  'freelancer.demo@agently.co.in'
);

update creators
set is_demo = true
where profile_id in (select id from profiles where lower(email) like '%.demo@agently.co.in');

update freelancers
set is_demo = true
where profile_id in (select id from profiles where lower(email) like '%.demo@agently.co.in');

update brands
set is_demo = true
where lower(contact_email) like '%.demo@agently.co.in';
