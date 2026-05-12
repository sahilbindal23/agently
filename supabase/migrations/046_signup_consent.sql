-- DPDP Act 2023 (India's GDPR equivalent) requires a defensible record of
-- when and to what version of Privacy/Terms the user consented. We persist
-- this as a JSONB blob on the profile rather than a separate table because
-- the data is small (1 row per profile), tightly coupled to signup, and we
-- never query across users by consent state.
--
-- Shape:
--   {
--     "accepted": true,
--     "accepted_at": "2025-05-12T15:23:00.000Z",
--     "privacy_version": "2025-05-12",
--     "terms_version": "2025-05-12",
--     "ip_address": "203.0.113.42",   -- captured server-side
--     "user_agent": "Mozilla/..."     -- captured server-side
--   }

alter table profiles
  add column if not exists signup_consent jsonb;

create index if not exists profiles_signup_consent_accepted_idx
  on profiles ((signup_consent->>'accepted_at'))
  where signup_consent is not null;
