export type Role = "admin" | "creator" | "brand" | "freelancer";
export type DealStage = "lead" | "contacted" | "negotiating" | "funded" | "live" | "delivered" | "approved" | "paid" | "disputed" | "closed";
export type PaymentStatus = "unpaid" | "pending" | "funded" | "release_ready" | "released" | "refunded" | "disputed";
export type RiskLevel = "safe" | "caution" | "high_risk";
export type VerificationStatus = "unverified" | "reviewing" | "verified" | "rejected";

export type Creator = {
  id: string;
  is_demo?: boolean;
  profile_id?: string | null;
  display_name: string;
  primary_niche: string;
  bio: string;
  country: string;
  us_audience_percent: number;
  india_audience_percent: number;
  home_city: string;
  languages: string[];
  top_indian_cities: string[];
  audience_age_range: string;
  content_style: string;
  prior_sponsor_categories: string[];
  monetization_score: number;
  valuation_score: number;
  image_url?: string | null;
  verification_status?: VerificationStatus | string;
  verification_tier?: string;
  completed_deal_count?: number;
  // Creator-side preferences for two-sided matching (migration 031).
  // Optional — absent/empty means "no preference stated" and ranking
  // behaves exactly as before.
  preferred_categories?: string[];
  excluded_categories?: string[];
  min_deal_cents?: number | null;
  open_to_offers?: boolean;
};

export type CreatorPlatform = {
  id: string;
  creator_id: string;
  platform: string;
  handle: string;
  url: string;
  followers: number;
  avg_views: number;
  engagement_rate: number;
  posting_frequency: string;
  metric_source?: "self_reported" | "mock_api" | "provider_api" | string;
  data_confidence?: number;
  india_audience_percent?: number;
  bangalore_audience_percent?: number;
  synced_at?: string;
};

export type Brand = {
  id: string;
  is_demo?: boolean;
  profile_id?: string | null;
  name: string;
  website: string;
  industry: string;
  contact_email: string;
  status: string;
  image_url?: string | null;
  verification_status?: VerificationStatus | string;
  verification_tier?: string;
  completed_project_count?: number;
};

export type Freelancer = {
  id: string;
  is_demo?: boolean;
  profile_id: string | null;
  display_name: string;
  service_category: string;
  bio: string;
  home_city: string;
  service_regions: string[];
  languages: string[];
  skills: string[];
  starting_rate_cents: number;
  day_rate_cents: number;
  hourly_rate_cents: number;
  availability_status: string;
  rating_score: number;
  portfolio_score: number;
  image_url?: string | null;
  verification_status?: VerificationStatus | string;
  verification_tier?: string;
};

export type FreelancerServiceRate = {
  id: string;
  freelancer_id: string;
  service_name: string;
  description: string;
  rate_cents: number;
  pricing_unit: string;
};

export type PortfolioItem = {
  id: string;
  freelancer_id: string;
  title: string;
  url: string;
  media_type: string;
  category: string;
  brand_client: string;
  description: string;
};

export type Deal = {
  id: string;
  is_demo?: boolean;
  creator_id: string;
  brand_id: string;
  title: string;
  deliverables: string;
  amount_cents: number;
  currency: string;
  stage: DealStage;
  payment_status: PaymentStatus;
  deliverable_status: string;
  risk_score: number;
  start_date: string;
  due_date: string;
  notes: string;
  offer_status?: string;
  talent_response?: string | null;
  responded_at?: string | null;
  counter_status?: string | null;
  counter_amount_cents?: number | null;
  counter_deliverables?: string | null;
  counter_due_date?: string | null;
  counter_usage_rights?: string | null;
  counter_approval_terms?: string | null;
  counter_reason?: string | null;
  counter_created_at?: string | null;
  counter_responded_at?: string | null;
};

export type ContractFlag = {
  id: string;
  contract_id: string;
  flag_type: string;
  severity: "low" | "medium" | "high";
  excerpt: string;
  recommendation: string;
};

export type Contract = {
  id: string;
  deal_id: string;
  file_path: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  uploaded_by?: string | null;
  raw_text: string;
  scan_status: string;
  risk_level: RiskLevel;
  review_status?: "needs_review" | "safe_to_accept" | "needs_negotiation" | "blocked" | string | null;
  summary: string;
  flags: ContractFlag[];
};

export type Payment = {
  id: string;
  deal_id?: string | null;
  freelancer_project_id?: string | null;
  provider?: "stripe" | "razorpay" | "manual" | string | null;
  stripe_payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_link_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
  amount_cents: number;
  platform_fee_cents: number;
  creator_payout_cents: number;
  status: PaymentStatus;
  funded_at?: string | null;
  released_at?: string | null;
};

export type BrandMatch = {
  id: string;
  creator_id: string;
  brand_id: string;
  fit_score: number;
  match_reason: string;
  outreach_angle: string;
  suggested_intro: string;
  status: string;
};

export type AiValuation = {
  id: string;
  creator_id: string;
  platform: string;
  low_estimate_cents: number;
  base_estimate_cents: number;
  high_estimate_cents: number;
  confidence_score: number;
  rationale: string;
  package_recommendation: string;
};

export type Campaign = {
  id: string;
  is_demo?: boolean;
  brand_id: string | null;
  profile_id: string | null;
  title: string;
  campaign_goal: string;
  budget_cents: number;
  city_focus: string;
  region_focus: string;
  campaign_length: string;
  target_audience: string;
  platforms: string[];
  creator_categories: string[];
  freelancer_needs: string[];
  languages: string[];
  visibility: string;
  status: string;
};

export type CampaignInvite = {
  id: string;
  campaign_id: string;
  creator_id: string;
  status: string;
};

export type CampaignShortlist = {
  id: string;
  campaign_id: string;
  entity_type: "creator" | "freelancer";
  entity_id: string;
  fit_score: number;
  reason: string;
  status: string;
};

export type FreelancerProject = {
  id: string;
  campaign_id: string | null;
  freelancer_id: string;
  brand_id: string | null;
  title: string;
  scope: string;
  amount_cents: number;
  currency: string;
  due_date: string;
  usage_context: string;
  approval_terms: string;
  status: string;
  payment_status: string;
  deliverable_status?: string;
  talent_response?: string | null;
  responded_at?: string | null;
  counter_status?: string | null;
  counter_amount_cents?: number | null;
  counter_scope?: string | null;
  counter_due_date?: string | null;
  counter_usage_rights?: string | null;
  counter_approval_terms?: string | null;
  counter_reason?: string | null;
  counter_created_at?: string | null;
  counter_responded_at?: string | null;
  notes?: string | null;
};

export type Deliverable = {
  id: string;
  deal_id?: string | null;
  freelancer_project_id?: string | null;
  title?: string | null;
  platform: string;
  content_url: string;
  notes?: string | null;
  review_notes?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  status: "submitted" | "revision_requested" | "approved";
  created_at?: string;
};
