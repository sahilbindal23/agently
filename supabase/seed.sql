insert into profiles (id, email, full_name, role) values
  ('00000000-0000-0000-0000-000000000001', 'admin@agently.demo', 'Agently Admin', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'maya@agently.demo', 'Maya Chen', 'creator'),
  ('00000000-0000-0000-0000-000000000003', 'jordan@agently.demo', 'Jordan Miles', 'creator');

insert into creators (id, profile_id, display_name, primary_niche, bio, country, us_audience_percent, india_audience_percent, home_city, languages, top_indian_cities, audience_age_range, content_style, prior_sponsor_categories, monetization_score, valuation_score) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Maya Chen', 'Sustainable fashion', 'Short-form styling creator known for thrift transformations and ethical brand reviews.', 'IN', 0, 76, 'Bengaluru', array['English','Hindi','Kannada'], array['Bengaluru','Mumbai','Delhi NCR'], '18-28', 'premium, relatable, sustainability-led', array['fashion','beauty','marketplaces'], 86, 91),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Jordan Miles', 'Gaming hardware', 'Twitch streamer and YouTube reviewer focused on creator desk setups and peripherals.', 'IN', 0, 68, 'Bengaluru', array['English','Hindi','Kannada'], array['Bengaluru','Hyderabad','Pune'], '18-30', 'technical, high-trust, gaming-native', array['gaming','tech','audio'], 79, 83);

insert into creator_platforms (creator_id, platform, handle, url, followers, avg_views, engagement_rate, posting_frequency) values
  ('10000000-0000-0000-0000-000000000001', 'TikTok', '@mayastyles', 'https://tiktok.com/@mayastyles', 420000, 185000, 6.8, '5x weekly'),
  ('10000000-0000-0000-0000-000000000001', 'Instagram', '@mayachen', 'https://instagram.com/mayachen', 210000, 92000, 4.4, 'Daily stories'),
  ('10000000-0000-0000-0000-000000000002', 'YouTube', 'Jordan Builds', 'https://youtube.com/@jordanbuilds', 310000, 145000, 5.1, '2x weekly');

insert into brands (id, name, website, industry, contact_email, status) values
  ('20000000-0000-0000-0000-000000000001', 'Everlane', 'https://everlane.com', 'Apparel', 'partnerships@everlane.example', 'target'),
  ('20000000-0000-0000-0000-000000000002', 'Logitech G', 'https://logitechg.com', 'Gaming hardware', 'creators@logitech.example', 'active');

insert into deals (id, creator_id, brand_id, title, deliverables, amount_cents, stage, payment_status, deliverable_status, risk_score, start_date, due_date, notes) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Capsule wardrobe TikTok launch', '2 TikTok posts, 3 IG story frames, 30-day usage', 1850000, 'negotiating', 'pending', 'not_started', 36, '2026-04-10', '2026-05-07', 'Push back on perpetual usage clause.'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Creator desk setup YouTube integration', '90-second YouTube integration, Twitch panel, pinned comment', 1225000, 'funded', 'funded', 'draft_due', 18, '2026-04-18', '2026-05-03', 'Payment funded. Awaiting draft URL.');
