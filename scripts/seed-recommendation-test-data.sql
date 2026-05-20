-- ============================================================================
-- SEED RECOMMENDATION TEST DATA
-- ============================================================================
--
-- Populates the marketplace with enough variety to exercise the graded
-- categoryFit ranker:
--   - 5 brand companies across distinct industries
--   - 20 creators across tech / food / fashion / beauty / fitness / gaming /
--     lifestyle / finance / parenting niches, with realistic platforms
--   - 20 freelancers across video / photo / design / copy / strategy
--   - 30+ freelancer service rates
--   - 10 campaigns spanning the brand industries
--
-- All rows are flagged is_demo:true so they only appear to demo accounts
-- (the canSeeDemoData filter in lib/db/demo-visibility.ts gates them).
--
-- Re-runnable: every insert uses ON CONFLICT (id) DO UPDATE so running
-- this twice just rewrites the same rows.
--
-- Run from: Supabase Dashboard → SQL editor → paste this file → Run.
-- ----------------------------------------------------------------------------

-- 0. Find the demo brand profile (created by scripts/seed-demo-accounts.sql).
--    All test campaigns get owned by this profile so demo-brand login sees them.
do $$
declare
  brand_profile uuid;
begin
  select id into brand_profile from profiles
    where lower(email) in ('demobrand@agently.in', 'brand.demo@agently.co.in')
    order by created_at asc
    limit 1;

  if brand_profile is null then
    raise exception 'No demo brand profile found. Run scripts/seed-demo-accounts.sql first.';
  end if;

  -- Stash for later use in this transaction.
  perform set_config('agently.demo_brand_profile', brand_profile::text, true);
end $$;

-- ----------------------------------------------------------------------------
-- 1. Brand companies (5)
-- ----------------------------------------------------------------------------
insert into brands (id, name, industry, website, contact_email, status, is_demo)
values
  ('a1d0b001-0000-4000-8000-000000000001', 'AudioFlex',       'consumer electronics', 'https://audioflex.example.in', 'partnerships@audioflex.example.in', 'active', true),
  ('a1d0b001-0000-4000-8000-000000000002', 'CrunchCo',        'fmcg',                 'https://crunchco.example.in',  'creators@crunchco.example.in',     'active', true),
  ('a1d0b001-0000-4000-8000-000000000003', 'EarthThread',     'apparel',              'https://earththread.example.in','partners@earththread.example.in', 'active', true),
  ('a1d0b001-0000-4000-8000-000000000004', 'DermaIndia',      'skincare',             'https://dermaindia.example.in','team@dermaindia.example.in',       'active', true),
  ('a1d0b001-0000-4000-8000-000000000005', 'VeerInvest',      'fintech',              'https://veerinvest.example.in','growth@veerinvest.example.in',     'active', true)
on conflict (id) do update set
  name = excluded.name,
  industry = excluded.industry,
  website = excluded.website,
  contact_email = excluded.contact_email,
  status = excluded.status,
  is_demo = excluded.is_demo;

-- ----------------------------------------------------------------------------
-- 2. Creators (20). Diverse niches so gradedCategoryFit has variety.
--    profile_id intentionally null — these are recommendation candidates,
--    not login accounts.
--    All marked verification_tier='verified' so the demo brand sees them
--    on the "Verified only" tab in the campaign recommendations.
-- ----------------------------------------------------------------------------
insert into creators (id, profile_id, display_name, primary_niche, bio, country, india_audience_percent, home_city, languages, top_indian_cities, audience_age_range, content_style, prior_sponsor_categories, monetization_score, valuation_score, is_demo)
values
  -- Tech cluster (4)
  ('a1d0c001-0000-4000-8000-000000000001', null, 'Aarav Sharma',          'tech',         'YouTube tech reviewer covering smartphones, earbuds, and laptops. India-first audience.',         'IN', 88, 'Bangalore',  array['Hindi','English'],          array['Bangalore','Mumbai','Delhi NCR'], '20-35', 'detailed, comparison-led, India-relevant', array['consumer electronics','audio','smartphones'], 84, 88, true),
  ('a1d0c001-0000-4000-8000-000000000002', null, 'Priya Tech',            'gadgets',      'Instagram gadget reviewer. Short-form unboxings and quick verdicts on India launches.',           'IN', 81, 'Mumbai',     array['English','Hindi'],          array['Mumbai','Bangalore','Pune'],     '22-32', 'punchy, unboxing, India-launch focus',     array['consumer electronics','audio'],                75, 79, true),
  ('a1d0c001-0000-4000-8000-000000000003', null, 'CodeWithRohan',         'productivity', 'Productivity + SaaS reviewer on YouTube. Notion, AI tools, founder workflows.',                  'IN', 72, 'Bangalore',  array['English','Hindi'],          array['Bangalore','Mumbai','Hyderabad'],'24-38', 'long-form, educational, founder-friendly', array['saas','productivity','ai'],                    79, 82, true),
  ('a1d0c001-0000-4000-8000-000000000004', null, 'AI Diaries by Neha',    'ai',           'AI/ML explainer creator. Breaks down model launches and AI tools for Indian devs.',              'IN', 76, 'Bangalore',  array['English','Hindi'],          array['Bangalore','Hyderabad','Pune'],  '22-34', 'educational, accessible, dev-focused',     array['ai','saas','ed-tech'],                         72, 76, true),

  -- Food cluster (4)
  ('a1d0c001-0000-4000-8000-000000000005', null, 'Spice & Soul',          'cooking',      'Hindi-first home-cooking creator. North Indian classics with modern shortcuts.',                'IN', 93, 'Delhi',      array['Hindi','English'],          array['Delhi NCR','Lucknow','Jaipur'],  '25-45', 'warm, family-led, traditional flavours',   array['fmcg','kitchenware','groceries'],              82, 86, true),
  ('a1d0c001-0000-4000-8000-000000000006', null, 'Bangalore Bites',       'restaurant-review','Bangalore restaurant + cloud-kitchen reviewer. Cafes, biryani spots, hidden gems.',           'IN', 95, 'Bangalore',  array['English','Kannada'],         array['Bangalore'],                     '20-32', 'casual, exploratory, city-native',         array['restaurants','food and beverage'],             71, 76, true),
  ('a1d0c001-0000-4000-8000-000000000007', null, 'Bake With Aanya',       'baking',       'YouTube + IG baker. Eggless desserts, festival sweets, beginner-friendly tutorials.',           'IN', 87, 'Mumbai',     array['English','Hindi'],          array['Mumbai','Pune','Ahmedabad'],     '24-40', 'step-by-step, beginner-friendly, festive', array['baking supplies','fmcg','kitchenware'],        77, 81, true),
  ('a1d0c001-0000-4000-8000-000000000008', null, 'Healthy Tiffin',        'nutrition',    'Meal-prep + macros creator. High-protein Indian tiffins for working professionals.',             'IN', 89, 'Pune',       array['English','Hindi'],          array['Pune','Mumbai','Bangalore'],     '24-35', 'practical, macro-focused, India-friendly', array['supplements','wellness','fmcg'],               70, 74, true),

  -- Fashion + beauty cluster (5)
  ('a1d0c001-0000-4000-8000-000000000009', null, 'Streetwear Saurabh',    'streetwear',   'Delhi streetwear creator. Indian sneaker drops, brand collabs, OOTDs.',                          'IN', 82, 'Delhi',      array['Hindi','English'],          array['Delhi NCR','Mumbai','Bangalore'],'18-28', 'street-credible, hype-led, drop-focused',  array['apparel','footwear','accessories'],            72, 77, true),
  ('a1d0c001-0000-4000-8000-000000000010', null, 'Threadful',             'sustainable-fashion','Sustainable + slow-fashion creator. Indian artisan brands, conscious styling.',             'IN', 86, 'Bangalore',  array['English'],                  array['Bangalore','Mumbai','Delhi NCR'],'24-36', 'thoughtful, story-led, ethical-first',     array['apparel','fashion','ethical brands'],          66, 71, true),
  ('a1d0c001-0000-4000-8000-000000000011', null, 'Saree Stories',         'fashion',      'Traditional + fusion saree styling on IG + YouTube. Festive looks, drape tutorials.',           'IN', 91, 'Mumbai',     array['Hindi','English'],          array['Mumbai','Delhi NCR','Bangalore'],'25-45', 'aspirational, festive, traditional',       array['apparel','fashion','jewelry'],                 80, 84, true),
  ('a1d0c001-0000-4000-8000-000000000012', null, 'GlowByMeera',           'skincare',     'Skincare creator focused on Indian skin types. Routine breakdowns, product layering.',           'IN', 84, 'Bangalore',  array['English','Hindi'],          array['Bangalore','Mumbai','Chennai'],  '22-32', 'science-led, routine-focused, India-skin', array['skincare','cosmetics','wellness'],             74, 78, true),
  ('a1d0c001-0000-4000-8000-000000000013', null, 'Makeup with Tara',      'makeup',       'YouTube makeup creator. Bridal, festive, everyday tutorials in Hindi + English.',               'IN', 90, 'Mumbai',     array['Hindi','English'],          array['Mumbai','Delhi NCR','Bangalore'],'20-32', 'tutorial-led, festive, bridal-strong',     array['cosmetics','beauty'],                          81, 85, true),

  -- Fitness + wellness cluster (2)
  ('a1d0c001-0000-4000-8000-000000000014', null, 'FitCoachVikram',        'fitness',      'Strength + body-recomposition coach. Indian-diet macros, home + gym workouts.',                 'IN', 87, 'Mumbai',     array['Hindi','English'],          array['Mumbai','Delhi NCR','Bangalore'],'22-38', 'no-nonsense, evidence-based, India-diet',  array['supplements','sportswear','fitness apps'],     76, 80, true),
  ('a1d0c001-0000-4000-8000-000000000015', null, 'YogaWithKavya',         'yoga',         'Yoga + breathwork creator. Beginner sequences, sleep + anxiety series.',                         'IN', 84, 'Bangalore',  array['English'],                  array['Bangalore','Chennai','Pune'],    '24-40', 'calm, accessible, beginner-first',         array['wellness','sportswear','mental health'],       65, 70, true),

  -- Gaming cluster (2)
  ('a1d0c001-0000-4000-8000-000000000016', null, 'MobiSamurai',           'gaming',       'Mobile gaming + BGMI creator on YouTube. Tournament watchparties, peripheral reviews.',          'IN', 95, 'Hyderabad',  array['Hindi'],                    array['Hyderabad','Delhi NCR','Bangalore'],'16-26','high-energy, gameplay-led, hype-driven',  array['gaming hardware','energy drinks','gaming'],    83, 86, true),
  ('a1d0c001-0000-4000-8000-000000000017', null, 'PCDeshi',               'gaming',       'PC gaming + setup reviewer. Builds, peripherals, India-priced parts.',                            'IN', 89, 'Delhi',      array['Hindi','English'],          array['Delhi NCR','Mumbai','Bangalore'],'18-30', 'build-focused, value-led, hardware-deep',  array['gaming hardware','consumer electronics'],      77, 81, true),

  -- Lifestyle / travel / parenting / finance (4)
  ('a1d0c001-0000-4000-8000-000000000018', null, 'Bengaluru Diaries',     'lifestyle',    'Bangalore city-lifestyle vlogger. Cafes, weekend trips, hidden city moments.',                  'IN', 92, 'Bangalore',  array['English','Kannada'],         array['Bangalore'],                     '22-32', 'casual, city-native, weekend-vibes',       array['food and beverage','lifestyle','travel'],      68, 73, true),
  ('a1d0c001-0000-4000-8000-000000000019', null, 'MoneyByRahul',          'finance',      'Personal finance YouTube creator. Mutual funds, tax, salary advice in Hindi + English.',         'IN', 94, 'Mumbai',     array['Hindi','English'],          array['Mumbai','Bangalore','Delhi NCR'],'24-40', 'educational, jargon-free, India-tax',      array['fintech','banking','investing'],               86, 89, true),
  ('a1d0c001-0000-4000-8000-000000000020', null, 'MomLifeKiran',          'parenting',    'IG + YouTube parenting creator. Newborn care, baby products, working-mom reality.',              'IN', 88, 'Chennai',    array['English','Tamil'],          array['Chennai','Bangalore','Hyderabad'],'28-38', 'real, relatable, working-mom-led',         array['baby products','kids','fmcg'],                 70, 75, true)
on conflict (id) do update set
  display_name = excluded.display_name,
  primary_niche = excluded.primary_niche,
  bio = excluded.bio,
  country = excluded.country,
  india_audience_percent = excluded.india_audience_percent,
  home_city = excluded.home_city,
  languages = excluded.languages,
  top_indian_cities = excluded.top_indian_cities,
  audience_age_range = excluded.audience_age_range,
  content_style = excluded.content_style,
  prior_sponsor_categories = excluded.prior_sponsor_categories,
  monetization_score = excluded.monetization_score,
  valuation_score = excluded.valuation_score,
  is_demo = excluded.is_demo;

-- Mark all seeded creators verified. Done as a separate UPDATE so the
-- INSERT row list stays readable (no inline verification_tier per row).
-- isVerifiedTier() in lib/campaigns/recommendations.ts treats any tier
-- other than 'unverified' / 'rejected' / 'reviewing' as verified.
update creators
set verification_tier = 'verified',
    verification_status = 'verified'
where id::text like 'a1d0c001-0000%';

-- ----------------------------------------------------------------------------
-- 3. Creator platforms (25). At least one per creator, two for the bigger ones.
-- ----------------------------------------------------------------------------
insert into creator_platforms (id, creator_id, platform, handle, url, followers, avg_views, engagement_rate, posting_frequency)
values
  -- Tech
  ('a1d0c001-0001-4000-8000-000000000001', 'a1d0c001-0000-4000-8000-000000000001', 'YouTube',   '@AaravTech',       'https://youtube.com/@aaravtech',     250000, 95000, 5.8, '3x weekly'),
  ('a1d0c001-0001-4000-8000-000000000002', 'a1d0c001-0000-4000-8000-000000000001', 'Instagram', '@aaravtech',       'https://instagram.com/aaravtech',     85000, 28000, 6.2, 'Daily'),
  ('a1d0c001-0001-4000-8000-000000000003', 'a1d0c001-0000-4000-8000-000000000002', 'Instagram', '@priyatech',       'https://instagram.com/priyatech',     80000, 32000, 7.1, 'Daily'),
  ('a1d0c001-0001-4000-8000-000000000004', 'a1d0c001-0000-4000-8000-000000000003', 'YouTube',   '@CodeWithRohan',   'https://youtube.com/@codewithrohan',  120000, 38000, 4.9, '2x weekly'),
  ('a1d0c001-0001-4000-8000-000000000005', 'a1d0c001-0000-4000-8000-000000000004', 'Instagram', '@aidiariesbyneha', 'https://instagram.com/aidiariesbyneha', 45000, 14000, 6.4, '4x weekly'),

  -- Food
  ('a1d0c001-0001-4000-8000-000000000006', 'a1d0c001-0000-4000-8000-000000000005', 'Instagram', '@spiceandsoul',    'https://instagram.com/spiceandsoul',  320000, 110000, 5.4, 'Daily'),
  ('a1d0c001-0001-4000-8000-000000000007', 'a1d0c001-0000-4000-8000-000000000006', 'Instagram', '@bangalorebites',  'https://instagram.com/bangalorebites',  95000, 42000, 7.8, 'Daily'),
  ('a1d0c001-0001-4000-8000-000000000008', 'a1d0c001-0000-4000-8000-000000000007', 'YouTube',   '@BakeWithAanya',   'https://youtube.com/@bakewithaanya',  180000, 68000, 5.2, 'Weekly'),
  ('a1d0c001-0001-4000-8000-000000000009', 'a1d0c001-0000-4000-8000-000000000007', 'Instagram', '@bakewithaanya',   'https://instagram.com/bakewithaanya',  90000, 28000, 4.6, '5x weekly'),
  ('a1d0c001-0001-4000-8000-000000000010', 'a1d0c001-0000-4000-8000-000000000008', 'Instagram', '@healthytiffin',   'https://instagram.com/healthytiffin',  60000, 22000, 5.9, 'Daily'),

  -- Fashion + beauty
  ('a1d0c001-0001-4000-8000-000000000011', 'a1d0c001-0000-4000-8000-000000000009', 'Instagram', '@streetwearsaurabh','https://instagram.com/streetwearsaurabh', 150000, 55000, 6.7, 'Daily'),
  ('a1d0c001-0001-4000-8000-000000000012', 'a1d0c001-0000-4000-8000-000000000010', 'Instagram', '@threadful',       'https://instagram.com/threadful',      40000, 12000, 4.8, '4x weekly'),
  ('a1d0c001-0001-4000-8000-000000000013', 'a1d0c001-0000-4000-8000-000000000011', 'Instagram', '@sareestories',    'https://instagram.com/sareestories',   220000, 78000, 5.1, 'Daily'),
  ('a1d0c001-0001-4000-8000-000000000014', 'a1d0c001-0000-4000-8000-000000000011', 'YouTube',   '@SareeStories',    'https://youtube.com/@sareestories',     70000, 24000, 4.4, 'Weekly'),
  ('a1d0c001-0001-4000-8000-000000000015', 'a1d0c001-0000-4000-8000-000000000012', 'Instagram', '@glowbymeera',     'https://instagram.com/glowbymeera',    110000, 38000, 6.0, 'Daily'),
  ('a1d0c001-0001-4000-8000-000000000016', 'a1d0c001-0000-4000-8000-000000000013', 'YouTube',   '@MakeupWithTara',  'https://youtube.com/@makeupwithtara',  280000, 92000, 5.7, '3x weekly'),

  -- Fitness
  ('a1d0c001-0001-4000-8000-000000000017', 'a1d0c001-0000-4000-8000-000000000014', 'Instagram', '@fitcoachvikram',  'https://instagram.com/fitcoachvikram', 130000, 46000, 6.3, 'Daily'),
  ('a1d0c001-0001-4000-8000-000000000018', 'a1d0c001-0000-4000-8000-000000000014', 'YouTube',   '@FitCoachVikram',  'https://youtube.com/@fitcoachvikram',   65000, 28000, 4.7, 'Weekly'),
  ('a1d0c001-0001-4000-8000-000000000019', 'a1d0c001-0000-4000-8000-000000000015', 'Instagram', '@yogawithkavya',   'https://instagram.com/yogawithkavya',   75000, 24000, 5.5, '5x weekly'),

  -- Gaming
  ('a1d0c001-0001-4000-8000-000000000020', 'a1d0c001-0000-4000-8000-000000000016', 'YouTube',   '@MobiSamurai',     'https://youtube.com/@mobisamurai',     450000, 180000, 7.2, '4x weekly'),
  ('a1d0c001-0001-4000-8000-000000000021', 'a1d0c001-0000-4000-8000-000000000017', 'YouTube',   '@PCDeshi',         'https://youtube.com/@pcdeshi',         200000,  82000, 5.6, '2x weekly'),

  -- Lifestyle / finance / parenting
  ('a1d0c001-0001-4000-8000-000000000022', 'a1d0c001-0000-4000-8000-000000000018', 'Instagram', '@bengalurudiaries','https://instagram.com/bengalurudiaries', 90000, 30000, 6.5, 'Daily'),
  ('a1d0c001-0001-4000-8000-000000000023', 'a1d0c001-0000-4000-8000-000000000019', 'YouTube',   '@MoneyByRahul',    'https://youtube.com/@moneybyrahul',    350000, 125000, 5.0, '2x weekly'),
  ('a1d0c001-0001-4000-8000-000000000024', 'a1d0c001-0000-4000-8000-000000000020', 'Instagram', '@momlifekiran',    'https://instagram.com/momlifekiran',    65000, 22000, 6.8, '5x weekly'),
  ('a1d0c001-0001-4000-8000-000000000025', 'a1d0c001-0000-4000-8000-000000000020', 'YouTube',   '@MomLifeKiran',    'https://youtube.com/@momlifekiran',     35000, 14000, 5.2, 'Weekly')
on conflict (id) do update set
  platform = excluded.platform,
  handle = excluded.handle,
  url = excluded.url,
  followers = excluded.followers,
  avg_views = excluded.avg_views,
  engagement_rate = excluded.engagement_rate,
  posting_frequency = excluded.posting_frequency;

-- ----------------------------------------------------------------------------
-- 4. Freelancers (20). Production and creative services.
-- ----------------------------------------------------------------------------
insert into freelancers (id, profile_id, display_name, service_category, bio, home_city, service_regions, languages, skills, hourly_rate_cents, day_rate_cents, availability_status, portfolio_score, is_demo)
values
  -- Video editing (5)
  ('a1d0f001-0000-4000-8000-000000000001', null, 'VedEdits',              'Video editing',    'Long-form YouTube editor. 5 years editing finance and tech channels.',                'Bangalore', array['India','Remote'],  array['English','Hindi'],          array['premiere','davinci resolve','color grading','youtube'],         180000, 1500000, 'available', 82, true),
  ('a1d0f001-0000-4000-8000-000000000002', null, 'ReelPro Bangalore',     'Video editing',    'Short-form vertical editor for Reels, Shorts, TikTok. India-first creators.',         'Bangalore', array['Bangalore','Remote'], array['English','Kannada'],     array['vertical video','reels','shorts','captioning'],                  120000, 1000000, 'available', 76, true),
  ('a1d0f001-0000-4000-8000-000000000003', null, 'StoryCutter',           'Video editing',    'Narrative documentary + brand-film editor. Storytelling-first.',                       'Mumbai',    array['India','Remote'],   array['English','Hindi'],          array['premiere','documentary','narrative','color'],                    220000, 1800000, 'available', 88, true),
  ('a1d0f001-0000-4000-8000-000000000004', null, 'AdPostProduction',      'Video editing',    'Performance-ad cuts and product promo edits. A/B versioning specialist.',             'Delhi',     array['India','Remote'],   array['English','Hindi'],          array['after effects','premiere','performance ads','a/b versions'],     160000, 1300000, 'available', 79, true),
  ('a1d0f001-0000-4000-8000-000000000005', null, 'ProductPromoCuts',      'Video editing',    'D2C product promo + e-commerce video editor.',                                         'Mumbai',    array['India','Remote'],   array['English','Hindi'],          array['e-commerce','product video','premiere','captioning'],            140000, 1100000, 'available', 74, true),

  -- Photography (4)
  ('a1d0f001-0000-4000-8000-000000000006', null, 'ProductLensMumbai',     'Photography',      'E-commerce product photographer. White-background and lifestyle shoots.',             'Mumbai',    array['Mumbai','Delhi NCR','Bangalore'], array['English','Hindi'], array['product photography','e-commerce','studio lighting'],           250000, 2000000, 'available', 84, true),
  ('a1d0f001-0000-4000-8000-000000000007', null, 'LifestylePhotoBLR',     'Photography',      'Lifestyle + brand campaign photography. Bangalore-based natural-light specialist.',    'Bangalore', array['Bangalore','Chennai','Hyderabad'], array['English','Kannada'], array['lifestyle','natural light','brand campaign'],                  200000, 1600000, 'available', 80, true),
  ('a1d0f001-0000-4000-8000-000000000008', null, 'FoodPhotographerDel',   'Photography',      'Food and restaurant menu photographer. Cloud-kitchen + dine-in shoots.',                'Delhi',     array['Delhi NCR','Mumbai'], array['English','Hindi'],         array['food photography','menu shoots','studio'],                       180000, 1500000, 'available', 77, true),
  ('a1d0f001-0000-4000-8000-000000000009', null, 'WeddingMomentsHyd',     'Photography',      'Wedding + event photographer covering South Indian weddings.',                         'Hyderabad', array['Hyderabad','Chennai','Bangalore'], array['English','Telugu','Tamil'], array['wedding','event','natural light'],                          250000, 2500000, 'available', 78, true),

  -- Design + motion (4)
  ('a1d0f001-0000-4000-8000-000000000010', null, 'BrandIdentityBLR',      'Graphic design',   'Brand identity + visual systems designer. D2C startups specialty.',                    'Bangalore', array['India','Remote'],   array['English'],                  array['logo','brand identity','d2c','figma'],                           200000, 1700000, 'available', 86, true),
  ('a1d0f001-0000-4000-8000-000000000011', null, 'LogoSquadIN',           'Graphic design',   'Logo and small-batch identity work. Fast turnaround for startups.',                    'Pune',      array['India','Remote'],   array['English','Hindi'],          array['logo','identity','print','illustrator'],                         120000, 1000000, 'available', 71, true),
  ('a1d0f001-0000-4000-8000-000000000012', null, 'MotionGraphicsByAmit',  'Motion graphics',  'Motion-graphics artist for explainers, social ads, and product launches.',             'Mumbai',    array['India','Remote'],   array['English','Hindi'],          array['after effects','motion','explainer','product launch'],            220000, 1800000, 'available', 83, true),
  ('a1d0f001-0000-4000-8000-000000000013', null, 'PackagingDesignerMumbai','Graphic design',  'D2C packaging designer. FMCG, cosmetics, food labels.',                                'Mumbai',    array['India'],            array['English','Hindi'],          array['packaging','print','d2c','dieline'],                              210000, 1700000, 'available', 81, true),

  -- Copywriting (3)
  ('a1d0f001-0000-4000-8000-000000000014', null, 'BrandStoryBLR',         'Copywriting',      'Long-form brand storytelling, About pages, founder narratives.',                       'Bangalore', array['India','Remote'],   array['English'],                  array['long-form','brand voice','about','narrative'],                   150000, 1200000, 'available', 78, true),
  ('a1d0f001-0000-4000-8000-000000000015', null, 'AdCopyHindi',           'Copywriting',      'Hindi + Hinglish ad copy. Performance-ad and meta-creative specialist.',               'Delhi',     array['India','Remote'],   array['Hindi','English'],          array['hindi copy','performance ads','hinglish','meta'],                140000, 1100000, 'available', 75, true),
  ('a1d0f001-0000-4000-8000-000000000016', null, 'ProductCopyAanya',      'Copywriting',      'D2C product page + landing-page copywriter. Skincare and FMCG focus.',                 'Mumbai',    array['India','Remote'],   array['English','Hindi'],          array['product page','landing page','d2c','conversion'],                160000, 1300000, 'available', 80, true),

  -- Strategy + other (4)
  ('a1d0f001-0000-4000-8000-000000000017', null, 'IndianCreatorStrategy', 'Marketing strategy','Creator-marketing strategist. Influencer briefs, brief audits, campaign architecture.', 'Bangalore', array['India','Remote'],   array['English','Hindi'],          array['creator marketing','briefs','strategy','audits'],                280000, 2200000, 'available', 87, true),
  ('a1d0f001-0000-4000-8000-000000000018', null, 'SocialMediaPlanner',    'Marketing strategy','Social media content calendar and channel strategist for D2C brands.',                 'Mumbai',    array['India','Remote'],   array['English','Hindi'],          array['content planning','d2c','instagram','content calendar'],         180000, 1500000, 'available', 76, true),
  ('a1d0f001-0000-4000-8000-000000000019', null, 'VoiceoverArtistMulti',  'Voiceover',        'Multilingual voiceover artist. Hindi, English, Tamil, Telugu, Kannada.',               'Chennai',   array['India','Remote'],   array['English','Hindi','Tamil','Telugu','Kannada'], array['voiceover','dubbing','narration'],         130000, 1100000, 'available', 79, true),
  ('a1d0f001-0000-4000-8000-000000000020', null, 'TranslationMultilang',  'Localization',     'Brand content localization Hindi / Tamil / Kannada / Telugu / Malayalam.',             'Bangalore', array['India','Remote'],   array['English','Hindi','Tamil','Kannada','Telugu','Malayalam'], array['translation','localization','transcreation'], 100000, 800000, 'available', 73, true)
on conflict (id) do update set
  display_name = excluded.display_name,
  service_category = excluded.service_category,
  bio = excluded.bio,
  home_city = excluded.home_city,
  service_regions = excluded.service_regions,
  languages = excluded.languages,
  skills = excluded.skills,
  hourly_rate_cents = excluded.hourly_rate_cents,
  day_rate_cents = excluded.day_rate_cents,
  availability_status = excluded.availability_status,
  portfolio_score = excluded.portfolio_score,
  is_demo = excluded.is_demo;

-- Mark all seeded freelancers verified too, so brand-side talent
-- listings show the Agently-verified badge.
update freelancers
set verification_tier = 'verified',
    verification_status = 'verified'
where id::text like 'a1d0f001-0000%';

-- ----------------------------------------------------------------------------
-- 5. Service rates (one or two per freelancer for the most common services)
-- ----------------------------------------------------------------------------
insert into freelancer_service_rates (id, freelancer_id, service_name, description, rate_cents, pricing_unit)
values
  ('a1d0f001-0001-4000-8000-000000000001', 'a1d0f001-0000-4000-8000-000000000001', 'Long-form YouTube edit', '8-15 min finished edit, color graded, mixed', 1200000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000002', 'a1d0f001-0000-4000-8000-000000000002', 'Reel / Short edit',      '60-90 sec vertical with captions',           250000,  'project'),
  ('a1d0f001-0001-4000-8000-000000000003', 'a1d0f001-0000-4000-8000-000000000003', 'Brand film edit',        '2-4 min finished narrative film',          2500000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000004', 'a1d0f001-0000-4000-8000-000000000004', 'Ad creative pack',       '3-5 variations of a performance ad',       1500000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000005', 'a1d0f001-0000-4000-8000-000000000005', 'Product promo edit',     '30-60 sec promo with motion + captions',    400000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000006', 'a1d0f001-0000-4000-8000-000000000006', 'Product shoot day',      'Studio shoot, 30-50 SKUs, white + lifestyle', 2500000, 'day'),
  ('a1d0f001-0001-4000-8000-000000000007', 'a1d0f001-0000-4000-8000-000000000007', 'Brand campaign shoot',   'Half-day lifestyle shoot for D2C campaign', 1600000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000008', 'a1d0f001-0000-4000-8000-000000000008', 'Menu photography',       '20-30 dish shoot at venue',                1500000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000010', 'a1d0f001-0000-4000-8000-000000000010', 'Brand identity package', 'Logo, palette, type system, basic guidelines', 4500000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000011', 'a1d0f001-0000-4000-8000-000000000011', 'Logo design',            'Logo with 2 revisions',                     300000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000012', 'a1d0f001-0000-4000-8000-000000000012', 'Motion explainer',       '30-60 sec animated explainer',             1800000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000013', 'a1d0f001-0000-4000-8000-000000000013', 'Packaging design',       'Front + back + dieline for one SKU',        800000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000014', 'a1d0f001-0000-4000-8000-000000000014', 'About / brand-story page','Long-form brand narrative + revisions',    400000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000015', 'a1d0f001-0000-4000-8000-000000000015', 'Hindi performance ads',  'Pack of 8 ad variations',                   350000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000016', 'a1d0f001-0000-4000-8000-000000000016', 'Product page copy',      'Full PDP rewrite with conversion structure',300000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000017', 'a1d0f001-0000-4000-8000-000000000017', 'Creator brief audit',    'Audit + rewrite of a creator campaign brief', 600000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000018', 'a1d0f001-0000-4000-8000-000000000018', 'Monthly content calendar','D2C content + creator plan for one month',  900000, 'month'),
  ('a1d0f001-0001-4000-8000-000000000019', 'a1d0f001-0000-4000-8000-000000000019', 'Voiceover (Hindi/English)','1 min finished VO with edits',             250000, 'project'),
  ('a1d0f001-0001-4000-8000-000000000020', 'a1d0f001-0000-4000-8000-000000000020', 'Hindi/Tamil/Kannada localization','Per language, up to 1500 words',     200000, 'project')
on conflict (id) do update set
  service_name = excluded.service_name,
  description = excluded.description,
  rate_cents = excluded.rate_cents,
  pricing_unit = excluded.pricing_unit;

-- ----------------------------------------------------------------------------
-- 6. Campaigns (10). One brand per industry, varied budgets and platforms.
-- ----------------------------------------------------------------------------
insert into campaigns (id, brand_id, profile_id, title, campaign_goal, budget_cents, city_focus, region_focus, campaign_length, target_audience, platforms, creator_categories, freelancer_needs, languages, is_demo)
values
  ('a1d0a001-0000-4000-8000-000000000001',
    'a1d0b001-0000-4000-8000-000000000001',
    current_setting('agently.demo_brand_profile')::uuid,
    'Earbuds India launch — tech creators',
    'Launch awareness for mid-priced wireless earbuds across metro India. Need tech reviewers to do honest comparison videos vs. existing players.',
    25000000, 'Bangalore', 'India', '2-week burst',
    'Tech-curious Gen Z and millennials in metro India who shortlist by spec + creator review',
    array['YouTube','Instagram'], array['tech','gadgets','gaming'], array['Video editing'], array['English','Hindi'], true),

  ('a1d0a001-0000-4000-8000-000000000002',
    'a1d0b001-0000-4000-8000-000000000002',
    current_setting('agently.demo_brand_profile')::uuid,
    'Snack launch Bangalore',
    'Bangalore-first launch for a new namkeen brand. Want food creators with Bangalore audience to drive tasting events + delivery orders.',
    18000000, 'Bangalore', 'Bangalore', '3-week sequence',
    'Bangalore office-goers and students 22-35 who order snacks via quick commerce',
    array['Instagram'], array['food','cooking','restaurant-review','lifestyle'], array['Photography','Copywriting'], array['English','Kannada'], true),

  ('a1d0a001-0000-4000-8000-000000000003',
    'a1d0b001-0000-4000-8000-000000000003',
    current_setting('agently.demo_brand_profile')::uuid,
    'Sustainable fashion drop',
    'D2C launch for a sustainable apparel capsule. Need creators who can communicate fabric provenance + ethical sourcing without preachiness.',
    30000000, 'Mumbai', 'India', '1-month',
    'Women 24-36 in metros who shop conscious brands and care about supply-chain transparency',
    array['Instagram'], array['fashion','sustainable-fashion','lifestyle'], array['Photography','Graphic design'], array['English'], true),

  ('a1d0a001-0000-4000-8000-000000000004',
    'a1d0b001-0000-4000-8000-000000000004',
    current_setting('agently.demo_brand_profile')::uuid,
    'Skincare for Indian skin',
    'Hero SKU relaunch with claims tailored to Indian skin types. Need creators who explain ingredient + routine, not just unboxings.',
    22000000, 'Mumbai', 'India', '3-week sequence',
    'Women 22-32 in metros who research before buying skincare and follow ingredient-led creators',
    array['Instagram','YouTube'], array['beauty','skincare','wellness'], array['Photography','Copywriting'], array['English','Hindi'], true),

  ('a1d0a001-0000-4000-8000-000000000005',
    'a1d0b001-0000-4000-8000-000000000003',
    current_setting('agently.demo_brand_profile')::uuid,
    'Protein powder relaunch',
    'New formulation launch for whey protein. Want fitness creators with strength + body-recomp audiences, not generic gym-influencer reach.',
    15000000, null, 'India', '2-week burst',
    'Indian men and women 22-38 actively training 3+ times a week',
    array['Instagram','YouTube'], array['fitness','nutrition','wellness'], array['Video editing'], array['English','Hindi'], true),

  ('a1d0a001-0000-4000-8000-000000000006',
    'a1d0b001-0000-4000-8000-000000000005',
    current_setting('agently.demo_brand_profile')::uuid,
    'Investment app for first-time investors',
    'Educational push for a mutual-fund + SIP app. Hindi-first creators with finance audiences preferred.',
    40000000, 'Mumbai', 'India', '1-month',
    'Indian salaried professionals 24-40 with first salary credit and limited investing experience',
    array['YouTube'], array['finance','business','education'], array['Video editing','Motion graphics'], array['Hindi','English'], true),

  ('a1d0a001-0000-4000-8000-000000000007',
    'a1d0b001-0000-4000-8000-000000000001',
    current_setting('agently.demo_brand_profile')::uuid,
    'Gaming mouse Indian launch',
    'Launch a mid-priced gaming mouse for Indian gamers. Need creators with PC/mobile gaming audiences, not generic tech.',
    20000000, null, 'India', '2-week burst',
    'Indian gamers 16-30, mostly tier-1 metros',
    array['YouTube','Instagram'], array['gaming','tech','gadgets'], array['Video editing'], array['Hindi','English'], true),

  ('a1d0a001-0000-4000-8000-000000000008',
    'a1d0b001-0000-4000-8000-000000000002',
    current_setting('agently.demo_brand_profile')::uuid,
    'Cloud kitchen launch — Indian comfort food',
    'New cloud kitchen brand for ghar-ka-khaana style meals. Bangalore-only launch. Need food creators with delivery-app audience.',
    12000000, 'Bangalore', 'Bangalore', '2-week sequence',
    'Bangalore working professionals 24-40 who order home-style meals 3-5x a week',
    array['Instagram'], array['food','restaurant-review','lifestyle'], array['Photography'], array['English','Kannada'], true),

  ('a1d0a001-0000-4000-8000-000000000009',
    'a1d0b001-0000-4000-8000-000000000004',
    current_setting('agently.demo_brand_profile')::uuid,
    'Baby sleep monitor launch',
    'New connected baby monitor for Indian families. Need parenting creators (especially first-time-mom audiences) to demo and review.',
    18000000, null, 'India', '3-week sequence',
    'New and expecting parents 26-36 across metros',
    array['Instagram','YouTube'], array['parenting','lifestyle','wellness'], array['Video editing'], array['English','Hindi','Tamil'], true),

  ('a1d0a001-0000-4000-8000-000000000010',
    'a1d0b001-0000-4000-8000-000000000005',
    current_setting('agently.demo_brand_profile')::uuid,
    'AI productivity tool launch',
    'New AI-powered note-taking tool for Indian founders + knowledge workers. Need creators who can demo workflow, not just hype.',
    35000000, null, 'India', '1-month',
    'Indian founders, freelancers, and knowledge workers 24-40',
    array['YouTube','Instagram'], array['ai','productivity','tech','business'], array['Motion graphics','Copywriting'], array['English'], true)
on conflict (id) do update set
  brand_id = excluded.brand_id,
  profile_id = excluded.profile_id,
  title = excluded.title,
  campaign_goal = excluded.campaign_goal,
  budget_cents = excluded.budget_cents,
  city_focus = excluded.city_focus,
  region_focus = excluded.region_focus,
  campaign_length = excluded.campaign_length,
  target_audience = excluded.target_audience,
  platforms = excluded.platforms,
  creator_categories = excluded.creator_categories,
  freelancer_needs = excluded.freelancer_needs,
  languages = excluded.languages,
  is_demo = excluded.is_demo;

-- ----------------------------------------------------------------------------
-- 7. Confirm
-- ----------------------------------------------------------------------------
do $$
declare
  brand_count int;
  creator_count int;
  platform_count int;
  freelancer_count int;
  rate_count int;
  campaign_count int;
begin
  -- ::text cast required: Postgres has no `uuid LIKE text` operator
  select count(*) into brand_count from brands where id::text like 'a1d0b001%';
  select count(*) into creator_count from creators where id::text like 'a1d0c001-0000%';
  select count(*) into platform_count from creator_platforms where id::text like 'a1d0c001-0001%';
  select count(*) into freelancer_count from freelancers where id::text like 'a1d0f001-0000%';
  select count(*) into rate_count from freelancer_service_rates where id::text like 'a1d0f001-0001%';
  select count(*) into campaign_count from campaigns where id::text like 'a1d0a001%';

  raise notice '✅ Recommendation test data seeded:';
  raise notice '   brands:                %', brand_count;
  raise notice '   creators:              %', creator_count;
  raise notice '   creator_platforms:     %', platform_count;
  raise notice '   freelancers:           %', freelancer_count;
  raise notice '   service_rates:         %', rate_count;
  raise notice '   campaigns:             %', campaign_count;
  raise notice '   Sign in as demobrand@agently.in to see them in /campaigns.';
end $$;
