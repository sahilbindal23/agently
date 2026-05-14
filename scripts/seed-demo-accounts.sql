-- ============================================================================
-- SEED DEMO ACCOUNTS — fully automated, one SQL run
-- ============================================================================
--
-- Creates three demo accounts (creator / brand / freelancer) end-to-end:
--   - auth.users + auth.identities  (login credentials)
--   - public.profiles               (role + consent record)
--   - role-specific intake          (creator / brand / freelancer + sub-tables)
--   - one OPEN campaign             (so /campaigns/discover has data)
--
-- After this script runs you can immediately sign in at /login with:
--   democreator@agently.in
--   demobrand@agently.in
--   demofreelancer@agently.in
--
-- Password is set in the variable below — change it if you want.
--
-- Re-runnable: the script wipes any existing demo accounts at the top before
-- recreating them, so you can run this anytime to refresh state.

-- ----------------------------------------------------------------------------
-- 0. Set the shared password here. Change before running if you want.
-- ----------------------------------------------------------------------------
do $$
declare
  demo_password text := 'Agently2026!';

  creator_email    text := 'democreator@agently.in';
  brand_email      text := 'demobrand@agently.in';
  freelancer_email text := 'demofreelancer@agently.in';

  creator_profile_id    uuid := gen_random_uuid();
  brand_profile_id      uuid := gen_random_uuid();
  freelancer_profile_id uuid := gen_random_uuid();

  consent_blob jsonb := jsonb_build_object(
    'accepted', true,
    'accepted_at', now()::text,
    'privacy_version', 'demo-seed',
    'terms_version', 'demo-seed'
  );

  new_creator_id    uuid;
  new_brand_id      uuid;
  new_freelancer_id uuid;
  new_campaign_id   uuid;
begin
  -- ===== A. CLEANUP — drop any existing demo accounts before recreating =====
  -- Delete in dependency order so FKs don't complain.
  delete from public.campaign_invites where campaign_id in (
    select id from public.campaigns where profile_id in (
      select id from public.profiles where email in (creator_email, brand_email, freelancer_email)
    )
  );
  delete from public.campaigns where profile_id in (
    select id from public.profiles where email in (creator_email, brand_email, freelancer_email)
  );
  delete from public.brand_audits where profile_id in (
    select id from public.profiles where email in (creator_email, brand_email, freelancer_email)
  );
  delete from public.brands where contact_email in (creator_email, brand_email, freelancer_email);
  delete from public.creator_platforms where creator_id in (
    select id from public.creators where profile_id in (
      select id from public.profiles where email in (creator_email, brand_email, freelancer_email)
    )
  );
  delete from public.creators where profile_id in (
    select id from public.profiles where email in (creator_email, brand_email, freelancer_email)
  );
  delete from public.freelancer_service_rates where freelancer_id in (
    select id from public.freelancers where profile_id in (
      select id from public.profiles where email in (creator_email, brand_email, freelancer_email)
    )
  );
  delete from public.freelancers where profile_id in (
    select id from public.profiles where email in (creator_email, brand_email, freelancer_email)
  );
  delete from public.profiles where email in (creator_email, brand_email, freelancer_email);
  delete from auth.identities where provider_id in (creator_email, brand_email, freelancer_email);
  delete from auth.users where email in (creator_email, brand_email, freelancer_email);

  -- ===== B. CREATE auth.users (Supabase Auth records) =======================
  -- We bypass GoTrue's API and write directly to auth.users since SQL Editor
  -- runs as service_role. The columns we set mirror what GoTrue would write
  -- if a user signed up + verified email via the normal flow.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  )
  values
    (
      '00000000-0000-0000-0000-000000000000', creator_profile_id, 'authenticated', 'authenticated',
      creator_email, crypt(demo_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Demo Creator', 'role', 'creator'),
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', brand_profile_id, 'authenticated', 'authenticated',
      brand_email, crypt(demo_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Demo Brand Lead', 'role', 'brand'),
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', freelancer_profile_id, 'authenticated', 'authenticated',
      freelancer_email, crypt(demo_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Demo Freelancer', 'role', 'freelancer'),
      now(), now(), '', '', '', ''
    );

  -- ===== C. CREATE auth.identities (required for email/password login) ======
  -- GoTrue checks for a matching identity row when verifying credentials.
  -- identity_data MUST contain sub + email.
  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values
    (
      creator_email, creator_profile_id,
      jsonb_build_object('sub', creator_profile_id::text, 'email', creator_email, 'email_verified', true),
      'email', now(), now(), now()
    ),
    (
      brand_email, brand_profile_id,
      jsonb_build_object('sub', brand_profile_id::text, 'email', brand_email, 'email_verified', true),
      'email', now(), now(), now()
    ),
    (
      freelancer_email, freelancer_profile_id,
      jsonb_build_object('sub', freelancer_profile_id::text, 'email', freelancer_email, 'email_verified', true),
      'email', now(), now(), now()
    );

  -- ===== D. public.profiles =================================================
  insert into public.profiles (id, email, full_name, role, account_status, signup_consent)
  values
    (creator_profile_id,    creator_email,    'Demo Creator',    'creator',    'active', consent_blob),
    (brand_profile_id,      brand_email,      'Demo Brand Lead', 'brand',      'active', consent_blob),
    (freelancer_profile_id, freelancer_email, 'Demo Freelancer', 'freelancer', 'active', consent_blob);

  -- ===== E. creators intake + platforms =====================================
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

  insert into public.creator_platforms (creator_id, platform, handle, url, followers, avg_views, engagement_rate, posting_frequency, metric_source)
  values
    (new_creator_id, 'Instagram', '@demo.creator', 'https://instagram.com/demo.creator', 42000, 18500, 4.8, 'Three reels a week, one carousel', 'mock_api'),
    (new_creator_id, 'YouTube',   '@demo-creator', 'https://youtube.com/@demo-creator',  28000, 12000, 3.2, 'Weekly long-form review',          'mock_api');

  -- ===== F. brands intake + audit + one open campaign =======================
  insert into public.brands (name, website, industry, contact_email, status, is_demo)
  values (
    'Demo Brand Co.', 'https://demobrand.example', 'Consumer tech',
    brand_email, 'active', false
  )
  returning id into new_brand_id;

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
      'creator_size_band', '30k - 200k mid-tier creators'
    ),
    'demo_seed'
  );

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
    'open', 'brief'
  )
  returning id into new_campaign_id;

  -- ===== G. freelancers intake + service rates ==============================
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

  raise notice '✅ Demo accounts ready. Sign in at /login with password: %', demo_password;
  raise notice '   democreator@agently.in     → creator dashboard';
  raise notice '   demobrand@agently.in        → brand dashboard';
  raise notice '   demofreelancer@agently.in  → freelancer dashboard';
end $$;

-- Verify
select email, role, account_status from public.profiles
  where email in ('democreator@agently.in', 'demobrand@agently.in', 'demofreelancer@agently.in')
  order by role;
