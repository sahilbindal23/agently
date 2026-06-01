-- Creator-side preferences for two-sided matching.
--
-- Until now ranking was one-directional: rankCreators only asked "does this
-- creator fit the brief". A creator who would decline the offer anyway (wrong
-- category, budget below their floor, not currently taking work) still ranked
-- as a top recommendation, wasting brand outreach and creator goodwill.
--
-- These columns let a creator declare what THEY want, so the recommendation
-- engine can nudge mutual fit:
--   preferred_categories  niches/industries the creator actively wants  -> small boost
--   excluded_categories   categories the creator will not work with      -> strong penalty + watchout
--                         (e.g. alcohol, gambling, crypto, tobacco)
--   min_deal_cents        smallest deal the creator will consider        -> penalty + watchout when brief budget is below it
--   open_to_offers        whether the creator is taking new brand work    -> deprioritize when false
--
-- All optional. NULL / empty / default(true) means "no preference stated",
-- which keeps existing creators ranking exactly as before until they fill
-- these in.

alter table creators
  add column if not exists preferred_categories text[] default '{}',
  add column if not exists excluded_categories text[] default '{}',
  add column if not exists min_deal_cents integer,
  add column if not exists open_to_offers boolean not null default true;
