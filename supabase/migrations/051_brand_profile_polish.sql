-- Brand profile customization fields.
--
-- Adds two columns brands can set during intake / profile edit:
--   banner_url — full-width hero image rendered at the top of the brand's
--                public profile (/brands/[id]). Separate from image_url
--                (which acts as a square logo / thumbnail).
--   tagline   — short one-line description shown under brand name on the
--                profile and the marketplace card. ~80 char soft cap in UI.

alter table brands
  add column if not exists banner_url text,
  add column if not exists tagline text;
