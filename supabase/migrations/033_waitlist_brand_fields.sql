-- Brand-side columns for the waitlist table.
--
-- These were originally added inline to 032's `create table if not exists`,
-- which is a no-op on any database where the waitlist table already existed
-- (i.e. 032 had already been run in its creator-only form). This migration
-- adds them idempotently so every environment converges, regardless of which
-- version of 032 it ran first.
--
-- Safe to run anywhere: `add column if not exists` is a no-op when the column
-- is already present.

alter table waitlist
  add column if not exists company text,
  add column if not exists website text,
  add column if not exists industry text,
  add column if not exists budget_band text;
