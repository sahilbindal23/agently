-- ============================================================================
-- SEED DEMO ACCOUNTS — one per role for end-to-end UX walkthroughs
-- ============================================================================
--
-- Prereq: create three auth users in Supabase Dashboard with "Auto Confirm
-- User" ticked, then paste their UUIDs into the three :uuid_* placeholders
-- below before running.
--
-- After running this script you can sign in at /login with any of:
--   democreator@agently.in
--   demobrand@agently.in
--   demofreelancer@agently.in
-- (use the passwords you set when creating the auth users)
--
-- Each demo account gets:
--   - A profiles row with the right role + consent record
--   - The role-specific intake row (creator / brand / freelancer)
--   - Minimal but realistic data so the dashboard renders populated
--   - is_demo = false (so they show up to each other in the marketplace)
--   - account_status = 'active' (login won't be refused)
--
-- A tiny open campaign is also seeded against the demo brand so the demo
-- creator can test the /campaigns/discover and apply flow.

-- ----------------------------------------------------------------------------
-- REPLACE THESE THREE PLACEHOLDERS WITH THE UUIDS FROM SUPABASE DASHBOARD
-- ----------------------------------------------------------------------------
-- Hint: paste each UUID inside the single quotes. Do NOT include angle
-- brackets, do NOT include any extra spaces.
do $$
declare
  creator_profile_id    uuid := '<PASTE CREATOR UUID HERE>';
  brand_profile_id      uuid := '<PASTE BRAND UUID HERE>';
  freelancer_profile_id uuid := '<PASTE FREELANCER UUID HERE>';
  consent_blob jsonb := jsonb_build_object(
    'accepted', true,
    'accepted_at', now()::text,
    'privacy_version', 'demo-seed',
    'terms_version', 'demo-seed'
  );
  new_creator_id uuid;
  new_brand_id   uuid;
  new_freelancer_id uuid;
  new_campaign_id uuid;
begin
  -- ===== 1. profiles ========================================================
  insert into public.profiles (id, email, full_name, role, account_status, signup_consent)
  values
    (creator_profile_id,    'democreator@agently.in',    'Demo Creator',    'creator',    'active', consent_blob),
    (brand_profile_id,      'demobrand@agently.in',      'Demo Brand Lead', 'brand',      'active', consent_blob),
    (freelancer_profile_id, 'demofreelancer@agently.in', 'Demo Freelancer', 'freelancer', 'active', consent_blob)
  on conflict (id) do update set
    role = excluded.role,
    account_status = excluded.account_status,
    signup_consent = excluded.signup_consent;

  -- ===== 2. creators intake =================================================
  insert into public.creators (
    profile_id, display_name, primary_niche, bio, country, home_city,
    languages, top_indian_cities, audience_age_range, content_style,
    prior_sponsor_categories, india_audience_percent, monetization_score,
    valuation_score, is_demo
  )
  values (
    creator_profile_id, 'Demo Creator', 'Tech',
    'Reviews phones, laptops, and India-first tech. Hinglish + English.',
    'IN', 'Bengaluru',
    array['English', 'Hindi', 'Hinglish'],
    array['Bengaluru', 'Mumbai', 'Delhi'],
    '18-34', 'Long-form reviews',
    array['fintech', 'gaming/tech'],
    78, 78, 74, false
  )
  returning id into new_creator_id;

  -- One demo Instagram platform row so the marketplace card has metrics
  insert into public.creator_platforms (creator_id, platform, handle, url, followers, avg_views, engagement_rate, posting_frequency, metric_source)
  values (
    new_creator_id, 'Instagram', '@demo.creator', 'https://instagram.com/demo.creator',
    42000, 18500, 4.8, 'Three reels a week, one carousel', 'mock_api'
  );
  insert into public.creator_platforms (creator_id, platform, handle, url, followers, avg_views, engagement_rate, posting_frequency, metric_source)
  values (
    new_creator_id, 'YouTube', '@demo-creator', 'https://youtube.com/@demo-creator',
    28000, 12000, 3.2, 'Weekly long-form review', 'mock_api'
  );

  -- ===== 3. brands intake ===================================================
  insert into public.brands (
    name, website, industry, contact_email, status, is_demo
  )
  values (
    'Demo Brand Co.',
    'https://demobrand.example',
    'Consumer tech',
    'demobrand@agently.in',
    'active',
    false
  )
  returning id into new_brand_id;

  -- A minimal brand audit so the brand-home page renders the archetypes
  -- block. This is the same shape the AI audit produces, just hand-rolled.
  insert into public.brand_audits (brand_id, profile_id, input, result, source)
  values (
    new_brand_id, brand_profile_id,
    jsonb_build_object(
      'campaign_goal', 'Launch awareness for a new wireless earbuds line',
      'target_audience', '22-32 urban India, tech-curious, value-for-money',
      'category', 'Consumer tech',
      'city_focus', 'Bengaluru',
      'brand_notes', 'India-first launch, planning Mumbai + Delhi expansion within 60 days.'
    ),
    jsonb_build_object(
      'audit_type', 'demo_seed',
      'outreach_brief', 'Demo Brand Co. is launching wireless earbuds for 22-32 tech-curious metro India.',
      'ideal_creator_archetypes', array['Tech reviewer / unboxer', 'Productivity creator', 'Hinglish lifestyle'],
      'creator_size_band', '30k - 200k mid-tier creators',
      'bangalore_launch_fit_score', 72
    ),
    'demo_seed'
  );

  -- One OPEN campaign so /campaigns/discover has something to show the
  -- demo creator + freelancer.
  insert into public.campaigns (
    brand_id, profile_id, title, campaign_goal, budget_cents, city_focus,
    region_focus, campaign_length, target_audience, platforms,
    creator_categories, freelancer_needs, languages, visibility, status
  )
  values (
    new_brand_id, brand_profile_id,
    'Earbuds India launch — tech creators',
    'Launch awareness for mid-priced wireless earbuds across metro India',
    25000000, 'Bengaluru', 'India', '2-week burst',
    '22-32 urban India, tech-curious, value-for-money',
    array['Instagram', 'YouTube'],
    array['tech', 'gaming/tech', 'lifestyle'],
    array['video editing', 'short-form cuts'],
    array['English', 'Hindi', 'Hinglish'],
    'open',
    'brief'
  )
  returning id into new_campaign_id;

  -- ===== 4. freelancers intake ==============================================
  insert into public.freelancers (
    profile_id, display_name, service_category, bio, home_city,
    service_regions, languages, skills, hourly_rate_cents,
    availability_status, portfolio_score, is_demo
  )
  values (
    freelancer_profile_id, 'Demo Freelancer', 'Video editing',
    'Short-form video editor for India creators. Fast turnaround.',
    'Bengaluru', array['Bengaluru', 'Mumbai', 'Remote'],
    array['English', 'Hindi'],
    array['Reels editing', 'YouTube shorts', 'Color grade', 'Captions'],
    120000, 'available', 78, false
  )
  returning id into new_freelancer_id;

  insert into public.freelancer_service_rates (freelancer_id, service_name, description, rate_cents, pricing_unit)
  values
    (new_freelancer_id, 'Reel edit (30s)',     '30s reel edit, color, captions, transitions',  250000, 'per_reel'),
    (new_freelancer_id, 'YouTube short (60s)', '60s YouTube short, hook + retention edit',     400000, 'per_short'),
    (new_freelancer_id, 'Long-form (10min)',   '10-minute YouTube edit, B-roll + chapters',  3500000, 'per_video');

  -- ===== 5. sanity ==========================================================
  raise notice 'Demo accounts seeded:';
  raise notice '  creator_id    = %', new_creator_id;
  raise notice '  brand_id      = %', new_brand_id;
  raise notice '  freelancer_id = %', new_freelancer_id;
  raise notice '  campaign_id   = %', new_campaign_id;
end $$;

-- Verify
select id, email, role, account_status from public.profiles order by role;
