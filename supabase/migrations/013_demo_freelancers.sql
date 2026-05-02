insert into profiles (id, email, full_name, role) values
  ('00000000-0000-0000-0000-000000000004', 'riya@agently.demo', 'Riya Menon', 'freelancer'),
  ('00000000-0000-0000-0000-000000000005', 'arjun@agently.demo', 'Arjun Nair', 'freelancer'),
  ('00000000-0000-0000-0000-000000000006', 'nisha@agently.demo', 'Nisha Kapoor', 'freelancer')
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role;

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
  portfolio_score
) values
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000004',
    'Riya Menon Studio',
    'Video editor',
    'Bengaluru-based editor for reels, podcasts, founder content, and launch videos.',
    'Bengaluru',
    array['Bengaluru','Mumbai','Remote'],
    array['English','Hindi','Kannada'],
    array['reels editing','podcast clips','subtitles','motion graphics'],
    0,
    0,
    180000,
    'available',
    4.8,
    88
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000005',
    'Arjun Nair Films',
    'Videographer',
    'Shoots creator campaigns, cafe launches, D2C product videos, and event recap reels.',
    'Bengaluru',
    array['Bengaluru','Goa','Hyderabad'],
    array['English','Hindi','Malayalam'],
    array['shooting','lighting','product video','event reels'],
    0,
    0,
    250000,
    'booking_next_week',
    4.7,
    82
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000006',
    'Nisha Kapoor Design',
    'Graphic designer',
    'Designs creator media kits, thumbnails, campaign decks, and social launch assets.',
    'Bengaluru',
    array['Bengaluru','Delhi NCR','Remote'],
    array['English','Hindi'],
    array['thumbnails','brand decks','social posts','media kits'],
    0,
    0,
    150000,
    'available',
    4.9,
    91
  )
on conflict (id) do update set
  display_name = excluded.display_name,
  service_category = excluded.service_category,
  bio = excluded.bio,
  home_city = excluded.home_city,
  service_regions = excluded.service_regions,
  languages = excluded.languages,
  skills = excluded.skills,
  hourly_rate_cents = excluded.hourly_rate_cents,
  availability_status = excluded.availability_status,
  rating_score = excluded.rating_score,
  portfolio_score = excluded.portfolio_score;

insert into freelancer_service_rates (freelancer_id, service_name, description, rate_cents, pricing_unit) values
  ('40000000-0000-0000-0000-000000000001', 'Podcast clips pack', '10 short-form podcast clips with captions and hooks', 1200000, 'project'),
  ('40000000-0000-0000-0000-000000000001', 'Reel edit', 'Single reel edit with subtitles and basic motion graphics', 350000, 'project'),
  ('40000000-0000-0000-0000-000000000002', 'Half-day shoot', 'Four-hour shoot for reels, product shots, or launch content', 1800000, 'project'),
  ('40000000-0000-0000-0000-000000000002', 'Event recap reel', 'Shoot and edit one event recap reel', 2200000, 'project'),
  ('40000000-0000-0000-0000-000000000003', 'Thumbnail pack', 'Five YouTube thumbnails or campaign key visuals', 700000, 'project'),
  ('40000000-0000-0000-0000-000000000003', 'Media kit design', 'Creator or freelancer media kit deck', 950000, 'project')
on conflict do nothing;

insert into portfolio_items (freelancer_id, title, url, media_type, category, brand_client, description) values
  ('40000000-0000-0000-0000-000000000001', 'Podcast Shorts Reel', 'https://example.com/riya-podcast-clips', 'video', 'editing', 'Founder podcast', 'Captioned podcast clip pack for a founder-led content series.'),
  ('40000000-0000-0000-0000-000000000002', 'Cafe Launch Recap', 'https://example.com/arjun-cafe-launch', 'video', 'videography', 'Bengaluru cafe', 'Launch event recap and reel package.'),
  ('40000000-0000-0000-0000-000000000003', 'Creator Media Kit', 'https://example.com/nisha-media-kit', 'design', 'graphic design', 'Lifestyle creator', 'Media kit design for sponsorship outreach.')
on conflict do nothing;
