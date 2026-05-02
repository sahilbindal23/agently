alter table creators
  add column if not exists india_audience_percent numeric,
  add column if not exists home_city text,
  add column if not exists languages text[] default '{}',
  add column if not exists top_indian_cities text[] default '{}',
  add column if not exists audience_age_range text,
  add column if not exists content_style text,
  add column if not exists prior_sponsor_categories text[] default '{}';

update creators
set
  india_audience_percent = coalesce(india_audience_percent, case when lower(coalesce(country, '')) like '%in%' then 72 else 28 end),
  home_city = coalesce(home_city, case when lower(coalesce(country, '')) like '%in%' then 'Bengaluru' else '' end),
  languages = case when languages is null or cardinality(languages) = 0 then array['English', 'Hindi'] else languages end,
  top_indian_cities = case when top_indian_cities is null or cardinality(top_indian_cities) = 0 then array['Bengaluru', 'Mumbai', 'Delhi NCR'] else top_indian_cities end,
  audience_age_range = coalesce(audience_age_range, '18-30');
