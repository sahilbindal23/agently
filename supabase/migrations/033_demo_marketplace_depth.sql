-- Expands the prototype marketplace so discovery, profile cards, and campaign matching
-- can be tested with realistic density across creators, freelancers, and brands.

insert into creators (
  id,
  profile_id,
  display_name,
  primary_niche,
  bio,
  country,
  us_audience_percent,
  india_audience_percent,
  home_city,
  languages,
  top_indian_cities,
  audience_age_range,
  content_style,
  prior_sponsor_categories,
  monetization_score,
  valuation_score,
  image_url,
  verification_status,
  verification_tier,
  verification_checks
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Maya Chen', 'Sustainable fashion', 'Short-form styling creator known for thrift transformations and ethical brand reviews.', 'IN', 0, 76, 'Bengaluru', array['English','Hindi','Kannada'], array['Bengaluru','Mumbai','Delhi NCR'], '18-28', 'premium, relatable, sustainability-led', array['fashion','beauty','marketplaces'], 86, 91, 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true,"social_connected":false}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Jordan Miles', 'Gaming hardware', 'Twitch streamer and YouTube reviewer focused on creator desk setups and peripherals.', 'IN', 0, 68, 'Bengaluru', array['English','Hindi','Kannada'], array['Bengaluru','Hyderabad','Pune'], '18-30', 'technical, high-trust, gaming-native', array['gaming','tech','audio'], 79, 83, 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true,"social_connected":false}'::jsonb),
  ('10000000-0000-0000-0000-000000000003', null, 'Aanya Rao', 'Bengaluru food and lifestyle', 'Explores cafes, neighborhood launches, styling finds, and founder-led consumer brands across Bengaluru.', 'IN', 0, 82, 'Bengaluru', array['English','Hindi','Kannada'], array['Bengaluru','Mumbai','Chennai'], '20-32', 'warm, local, review-led, founder-friendly', array['cafes','fashion','beauty','apps'], 88, 90, 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80', 'verified', 'performance', '{"profile_review":true,"social_connected":true,"completed_deals":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000004', null, 'Kabir Sethi', 'Fitness and endurance', 'HYROX, running clubs, gym gear, recovery routines, and high-discipline urban fitness content.', 'IN', 0, 74, 'Bengaluru', array['English','Hindi'], array['Bengaluru','Delhi NCR','Pune'], '18-35', 'performance-led, disciplined, aspirational', array['fitness','sportswear','nutrition'], 81, 84, 'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=900&q=80', 'reviewing', 'social', '{"profile_review":true,"social_connected":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000005', null, 'Isha Kulkarni', 'Beauty and skincare', 'Skincare routines, budget-to-premium beauty comparisons, and GRWM content for Indian skin types.', 'IN', 0, 79, 'Mumbai', array['English','Hindi','Marathi'], array['Mumbai','Bengaluru','Delhi NCR'], '18-30', 'polished, educational, conversion-friendly', array['beauty','skincare','wellness'], 84, 87, 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80', 'verified', 'social', '{"profile_review":true,"social_connected":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000006', null, 'Dev Malhotra', 'Consumer tech', 'Reviews phones, creator tools, AI apps, productivity setups, and student-friendly gadgets.', 'IN', 0, 72, 'Delhi NCR', array['English','Hindi'], array['Delhi NCR','Bengaluru','Hyderabad'], '18-34', 'analytical, practical, high-retention', array['tech','apps','education'], 80, 85, 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80', 'reviewing', 'social', '{"profile_review":true,"social_connected":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000007', null, 'Meera Iyer', 'Parenting and home', 'Modern Indian parenting, home organization, family meals, school routines, and trusted household picks.', 'IN', 0, 88, 'Chennai', array['English','Tamil','Hindi'], array['Chennai','Bengaluru','Mumbai'], '25-42', 'trust-led, practical, family-safe', array['home','kids','food','health'], 78, 82, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000008', null, 'Rohan Bhat', 'Finance for young professionals', 'Explains saving, credit cards, side income, and creator finance for early-career Indians.', 'IN', 0, 83, 'Bengaluru', array['English','Hindi'], array['Bengaluru','Mumbai','Delhi NCR'], '21-35', 'clear, trustworthy, education-first', array['fintech','education','productivity'], 77, 80, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000009', null, 'Tara Dsouza', 'Music and nightlife', 'Covers indie music, nightlife, festival fits, local venues, and youth culture in Indian metros.', 'IN', 0, 69, 'Bengaluru', array['English','Hindi','Konkani'], array['Bengaluru','Goa','Mumbai'], '18-28', 'high-energy, culture-led, event-native', array['events','fashion','beverages'], 73, 78, 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80', 'unverified', 'profile', '{"profile_review":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000010', null, 'Neel Shah', 'Travel and cafes', 'Weekend trips, cafes, co-working spaces, boutique stays, and city guides for young Indian professionals.', 'IN', 0, 71, 'Pune', array['English','Hindi','Gujarati'], array['Pune','Bengaluru','Mumbai'], '20-34', 'visual, itinerary-led, save-worthy', array['travel','cafes','hospitality'], 76, 81, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80', 'reviewing', 'social', '{"profile_review":true,"social_connected":true}'::jsonb)
on conflict (id) do update set
  display_name = excluded.display_name,
  primary_niche = excluded.primary_niche,
  bio = excluded.bio,
  country = excluded.country,
  us_audience_percent = excluded.us_audience_percent,
  india_audience_percent = excluded.india_audience_percent,
  home_city = excluded.home_city,
  languages = excluded.languages,
  top_indian_cities = excluded.top_indian_cities,
  audience_age_range = excluded.audience_age_range,
  content_style = excluded.content_style,
  prior_sponsor_categories = excluded.prior_sponsor_categories,
  monetization_score = excluded.monetization_score,
  valuation_score = excluded.valuation_score,
  image_url = coalesce(creators.image_url, excluded.image_url),
  verification_status = excluded.verification_status,
  verification_tier = excluded.verification_tier,
  verification_checks = excluded.verification_checks;

insert into creator_platforms (id, creator_id, platform, handle, url, followers, avg_views, engagement_rate, posting_frequency) values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Instagram', '@mayachen', 'https://instagram.com/mayachen', 210000, 92000, 4.4, 'Daily stories'),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'YouTube', 'Jordan Builds', 'https://youtube.com/@jordanbuilds', 310000, 145000, 5.1, '2x weekly'),
  ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Instagram', '@aanyarao', 'https://instagram.com/aanyarao', 128000, 64000, 5.7, '4x weekly'),
  ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'Instagram', '@kabirtrains', 'https://instagram.com/kabirtrains', 89000, 52000, 6.2, '5x weekly'),
  ('11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'Instagram', '@ishaskin', 'https://instagram.com/ishaskin', 174000, 81000, 4.9, 'Daily'),
  ('11000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'YouTube', 'Dev Tests', 'https://youtube.com/@devtests', 246000, 98000, 4.2, '3x weekly'),
  ('11000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', 'Instagram', '@meerahome', 'https://instagram.com/meerahome', 112000, 43000, 5.4, '4x weekly'),
  ('11000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000008', 'YouTube', 'Rohan Money', 'https://youtube.com/@rohanmoney', 155000, 72000, 4.7, '2x weekly'),
  ('11000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009', 'Instagram', '@taralive', 'https://instagram.com/taralive', 68000, 39000, 7.1, 'Event weekends'),
  ('11000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000010', 'Instagram', '@neelweekends', 'https://instagram.com/neelweekends', 97000, 47000, 5.8, '3x weekly')
on conflict (id) do update set
  platform = excluded.platform,
  handle = excluded.handle,
  url = excluded.url,
  followers = excluded.followers,
  avg_views = excluded.avg_views,
  engagement_rate = excluded.engagement_rate,
  posting_frequency = excluded.posting_frequency;

insert into brands (id, name, website, industry, contact_email, status, image_url, verification_status, verification_tier, verification_checks) values
  ('20000000-0000-0000-0000-000000000001', 'Everlane India Test', 'https://everlane.example', 'Apparel', 'partnerships@everlane.example', 'target', 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000002', 'Logitech G India', 'https://logitechg.example', 'Gaming hardware', 'creators@logitech.example', 'active', 'https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000003', 'Namma Coffee', 'https://example.com/namma-coffee', 'Cafe and beverage', 'collabs@namma.example', 'demo_active', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000004', 'Hyrox Invitational', 'https://hyrox.example', 'Fitness events', 'partnerships@hyrox.example', 'active', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000005', 'Plum & Patch', 'https://plumpatch.example', 'Beauty and skincare', 'creators@plumpatch.example', 'target', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000006', 'Finwise', 'https://finwise.example', 'Fintech', 'growth@finwise.example', 'target', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000007', 'Koramangala Run Club', 'https://krc.example', 'Community fitness', 'collabs@krc.example', 'active', 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000008', 'IndieDeck', 'https://indiedeck.example', 'Creator tools', 'hello@indiedeck.example', 'target', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000009', 'The Local Edit', 'https://localedit.example', 'Fashion streetwear', 'collabs@localedit.example', 'enrolled', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('20000000-0000-0000-0000-000000000010', 'StayVista Lite', 'https://stayvista.example', 'Travel and hospitality', 'influencers@stayvista.example', 'target', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  website = excluded.website,
  industry = excluded.industry,
  contact_email = excluded.contact_email,
  status = excluded.status,
  image_url = coalesce(brands.image_url, excluded.image_url),
  verification_status = excluded.verification_status,
  verification_tier = excluded.verification_tier,
  verification_checks = excluded.verification_checks;

insert into freelancers (
  id,
  profile_id,
  display_name,
  service_category,
  bio,
  home_city,
  service_regions,
  languages,
  skills,
  starting_rate_cents,
  day_rate_cents,
  hourly_rate_cents,
  availability_status,
  rating_score,
  portfolio_score,
  image_url,
  verification_status,
  verification_tier,
  verification_checks
) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'Riya Menon Studio', 'Video editor', 'Bengaluru-based editor for reels, podcasts, founder content, and launch videos.', 'Bengaluru', array['Bengaluru','Mumbai','Remote'], array['English','Hindi','Kannada'], array['reels editing','podcast clips','subtitles','motion graphics'], 0, 0, 180000, 'available', 4.8, 88, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'Arjun Nair Films', 'Videographer', 'Shoots creator campaigns, cafe launches, D2C product videos, and event recap reels.', 'Bengaluru', array['Bengaluru','Goa','Hyderabad'], array['English','Hindi','Malayalam'], array['shooting','lighting','product video','event reels'], 0, 0, 250000, 'booking_next_week', 4.7, 82, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006', 'Nisha Kapoor Design', 'Graphic designer', 'Designs creator media kits, thumbnails, campaign decks, and social launch assets.', 'Bengaluru', array['Bengaluru','Delhi NCR','Remote'], array['English','Hindi'], array['thumbnails','brand decks','social posts','media kits'], 0, 0, 150000, 'available', 4.9, 91, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('40000000-0000-0000-0000-000000000004', null, 'Ankit Frames', 'Product photographer', 'Shoots clean product, food, and lifestyle stills for D2C launches and cafe menus.', 'Bengaluru', array['Bengaluru','Mysuru','Remote retouching'], array['English','Hindi','Kannada'], array['product photography','food photography','retouching','lighting'], 0, 0, 220000, 'available', 4.6, 84, 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('40000000-0000-0000-0000-000000000005', null, 'Sana Motion Lab', 'Motion designer', 'Creates launch animations, logo stings, lower thirds, explainers, and paid ad motion packs.', 'Mumbai', array['Mumbai','Bengaluru','Remote'], array['English','Hindi'], array['motion graphics','after effects','launch videos','ads'], 0, 0, 210000, 'available', 4.8, 89, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('40000000-0000-0000-0000-000000000006', null, 'Pranav Soundworks', 'Audio engineer', 'Podcast cleanup, voiceover mixing, music edits, and location sound for creator productions.', 'Bengaluru', array['Bengaluru','Remote'], array['English','Hindi','Kannada'], array['audio cleanup','podcast mixing','voiceover','location sound'], 0, 0, 130000, 'available', 4.7, 80, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('40000000-0000-0000-0000-000000000007', null, 'Kavya Copy Desk', 'Copywriter', 'Writes hooks, captions, scripts, founder posts, and campaign landing copy for creator-led brands.', 'Bengaluru', array['Bengaluru','Remote'], array['English','Hindi'], array['copywriting','hooks','scripts','brand voice'], 0, 0, 160000, 'available', 4.8, 86, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('40000000-0000-0000-0000-000000000008', null, 'Manu Drone Co', 'Drone operator', 'Aerial footage, event drone coverage, real estate reels, and travel campaign visuals.', 'Goa', array['Goa','Bengaluru','Mumbai'], array['English','Hindi','Konkani'], array['drone','travel video','event coverage','real estate'], 0, 0, 280000, 'booking_next_week', 4.5, 78, 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb),
  ('40000000-0000-0000-0000-000000000009', null, 'Leah Production Ops', 'Production manager', 'Handles shoot planning, creator schedules, vendors, call sheets, and brand approvals.', 'Bengaluru', array['Bengaluru','Hyderabad','Remote'], array['English','Hindi','Kannada'], array['production planning','vendor coordination','call sheets','budgets'], 0, 0, 190000, 'available', 4.9, 87, 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80', 'verified', 'profile', '{"profile_review":true}'::jsonb),
  ('40000000-0000-0000-0000-000000000010', null, 'Omkar Edit House', 'YouTube editor', 'Long-form YouTube edits, retention cuts, thumbnails coordination, and episode packaging.', 'Pune', array['Pune','Bengaluru','Remote'], array['English','Hindi','Marathi'], array['youtube editing','retention editing','color','sound sync'], 0, 0, 175000, 'available', 4.6, 83, 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=900&q=80', 'reviewing', 'profile', '{"profile_review":true}'::jsonb)
on conflict (id) do update set
  display_name = excluded.display_name,
  service_category = excluded.service_category,
  bio = excluded.bio,
  home_city = excluded.home_city,
  service_regions = excluded.service_regions,
  languages = excluded.languages,
  skills = excluded.skills,
  starting_rate_cents = excluded.starting_rate_cents,
  day_rate_cents = excluded.day_rate_cents,
  hourly_rate_cents = excluded.hourly_rate_cents,
  availability_status = excluded.availability_status,
  rating_score = excluded.rating_score,
  portfolio_score = excluded.portfolio_score,
  image_url = coalesce(freelancers.image_url, excluded.image_url),
  verification_status = excluded.verification_status,
  verification_tier = excluded.verification_tier,
  verification_checks = excluded.verification_checks;

insert into freelancer_service_rates (id, freelancer_id, service_name, description, rate_cents, pricing_unit) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'Product stills pack', '20 edited product stills for marketplace and social use', 1400000, 'project'),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000005', 'Motion ad pack', 'Three 10-15 second motion ads for launch campaigns', 1800000, 'project'),
  ('41000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000006', 'Podcast cleanup', 'Clean and mix one podcast episode up to 60 minutes', 650000, 'project'),
  ('41000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000007', 'Script pack', 'Ten short-form hooks and scripts for creator ads', 900000, 'project'),
  ('41000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000008', 'Drone half-day', 'Half-day drone shoot with edited selects', 2400000, 'project'),
  ('41000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000009', 'Shoot production day', 'Production planning and on-ground coordination for one shoot day', 1600000, 'project'),
  ('41000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000010', 'YouTube episode edit', 'One long-form edit up to 15 minutes with retention cuts', 1500000, 'project')
on conflict (id) do update set
  service_name = excluded.service_name,
  description = excluded.description,
  rate_cents = excluded.rate_cents,
  pricing_unit = excluded.pricing_unit;

insert into brand_matches (id, creator_id, brand_id, fit_score, match_reason, outreach_angle, suggested_intro, status) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 97, 'Aanya is highly local to Bengaluru and strong for cafe discovery.', 'Invite Aanya for a neighborhood launch tasting and reels package.', 'Aanya can turn Namma Coffee into a save-worthy Bengaluru weekend plan.', 'recommended'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 94, 'Kabir matches endurance and urban fitness audiences.', 'Build a race-prep content arc around training and recovery.', 'Kabir can make the event feel achievable for Bengaluru fitness communities.', 'recommended'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 91, 'Isha has strong beauty trust and India skin-type education.', 'Pitch skincare education with before/after routine structure.', 'Isha can explain the product through practical Indian skin routines.', 'recommended'),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000008', 89, 'Dev aligns with productivity tools and tech decision-making.', 'Frame IndieDeck as a creator workflow upgrade.', 'Dev can turn the product into a practical creator stack review.', 'recommended'),
  ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', 88, 'Neel is strong for weekend travel and hospitality discovery.', 'Pitch city escape itineraries with clear booking CTA.', 'Neel can make the property feel like an easy weekend plan.', 'recommended')
on conflict (id) do update set
  fit_score = excluded.fit_score,
  match_reason = excluded.match_reason,
  outreach_angle = excluded.outreach_angle,
  suggested_intro = excluded.suggested_intro,
  status = excluded.status;
