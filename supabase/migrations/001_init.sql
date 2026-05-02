create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  role text check (role in ('admin', 'creator', 'brand')) not null default 'creator',
  created_at timestamptz default now()
);

create table creators (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  display_name text not null,
  primary_niche text,
  bio text,
  country text,
  us_audience_percent numeric,
  india_audience_percent numeric,
  home_city text,
  languages text[] default '{}',
  top_indian_cities text[] default '{}',
  audience_age_range text,
  content_style text,
  prior_sponsor_categories text[] default '{}',
  monetization_score numeric,
  valuation_score numeric,
  created_at timestamptz default now()
);

create table creator_platforms (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  platform text,
  handle text,
  url text,
  followers integer,
  avg_views integer,
  engagement_rate numeric,
  posting_frequency text,
  created_at timestamptz default now()
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  contact_email text,
  status text,
  created_at timestamptz default now()
);

create table brand_matches (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  fit_score numeric,
  match_reason text,
  outreach_angle text,
  suggested_intro text,
  status text,
  created_at timestamptz default now()
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  title text,
  deliverables text,
  amount_cents integer,
  currency text default 'inr',
  stage text check (stage in ('lead', 'contacted', 'negotiating', 'funded', 'live', 'delivered', 'approved', 'paid', 'disputed', 'closed')) default 'lead',
  payment_status text check (payment_status in ('unpaid', 'pending', 'funded', 'release_ready', 'released', 'refunded', 'disputed')) default 'unpaid',
  deliverable_status text,
  risk_score numeric,
  start_date date,
  due_date date,
  notes text,
  created_at timestamptz default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  file_path text,
  raw_text text,
  scan_status text,
  risk_level text check (risk_level in ('safe', 'caution', 'high_risk')),
  summary text,
  created_at timestamptz default now()
);

create table contract_flags (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade,
  flag_type text,
  severity text check (severity in ('low', 'medium', 'high')),
  excerpt text,
  recommendation text,
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_payment_link_id text,
  amount_cents integer,
  platform_fee_cents integer,
  creator_payout_cents integer,
  status text check (status in ('unpaid', 'pending', 'funded', 'release_ready', 'released', 'refunded', 'disputed')) default 'unpaid',
  funded_at timestamptz,
  released_at timestamptz,
  created_at timestamptz default now()
);

create table deliverables (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  platform text,
  content_url text,
  submitted_at timestamptz,
  approved_at timestamptz,
  status text,
  created_at timestamptz default now()
);

create table ai_valuations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  platform text,
  low_estimate_cents integer,
  base_estimate_cents integer,
  high_estimate_cents integer,
  confidence_score numeric,
  rationale text,
  package_recommendation text,
  created_at timestamptz default now()
);

create table outreach_messages (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  subject text,
  body text,
  status text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table creators enable row level security;
alter table creator_platforms enable row level security;
alter table brands enable row level security;
alter table brand_matches enable row level security;
alter table deals enable row level security;
alter table contracts enable row level security;
alter table contract_flags enable row level security;
alter table payments enable row level security;
alter table deliverables enable row level security;
alter table ai_valuations enable row level security;
alter table outreach_messages enable row level security;

create policy "profiles own or admin" on profiles for select using (auth.uid() = id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admins manage creators" on creators for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "creators read own profile" on creators for select using (profile_id = auth.uid());
create policy "admins manage brands" on brands for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admins manage deals" on deals for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "creators read own deals" on deals for select using (exists (select 1 from creators c where c.id = deals.creator_id and c.profile_id = auth.uid()));
create policy "admins manage payments" on payments for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admins manage contracts" on contracts for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
