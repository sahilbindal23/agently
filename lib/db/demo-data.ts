import type { AiValuation, Brand, BrandMatch, Contract, Creator, CreatorPlatform, Deal, Payment } from "@/types";

export const creators: Creator[] = [
  {
    id: "c1",
    display_name: "Maya Chen",
    primary_niche: "Sustainable fashion",
    bio: "Short-form styling creator known for thrift transformations and ethical brand reviews.",
    country: "US",
    us_audience_percent: 68,
    india_audience_percent: 38,
    home_city: "Bengaluru",
    languages: ["English", "Hindi", "Hinglish"],
    top_indian_cities: ["Bengaluru", "Mumbai", "Delhi NCR"],
    audience_age_range: "18-28",
    content_style: "premium, relatable, sustainability-led",
    prior_sponsor_categories: ["fashion", "beauty", "marketplaces"],
    monetization_score: 86,
    valuation_score: 91
  },
  {
    id: "c2",
    display_name: "Jordan Miles",
    primary_niche: "Gaming hardware",
    bio: "Twitch streamer and YouTube reviewer focused on creator desk setups and peripherals.",
    country: "US",
    us_audience_percent: 54,
    india_audience_percent: 44,
    home_city: "Bengaluru",
    languages: ["English", "Hindi", "Kannada"],
    top_indian_cities: ["Bengaluru", "Hyderabad", "Pune"],
    audience_age_range: "18-30",
    content_style: "technical, high-trust, gaming-native",
    prior_sponsor_categories: ["gaming", "tech", "audio"],
    monetization_score: 79,
    valuation_score: 83
  },
  {
    id: "c3",
    display_name: "Aisha Rao",
    primary_niche: "Fitness and wellness",
    bio: "Instagram and TikTok creator with high-retention workout series for busy professionals.",
    country: "IN",
    us_audience_percent: 31,
    india_audience_percent: 82,
    home_city: "Bengaluru",
    languages: ["English", "Hindi", "Kannada"],
    top_indian_cities: ["Bengaluru", "Chennai", "Mumbai"],
    audience_age_range: "22-34",
    content_style: "practical, aspirational, wellness-first",
    prior_sponsor_categories: ["fitness", "wellness", "wearables"],
    monetization_score: 74,
    valuation_score: 78
  }
];

export const creatorPlatforms: CreatorPlatform[] = [
  { id: "p1", creator_id: "c1", platform: "TikTok", handle: "@mayastyles", url: "https://tiktok.com/@mayastyles", followers: 420000, avg_views: 185000, engagement_rate: 6.8, posting_frequency: "5x weekly" },
  { id: "p2", creator_id: "c1", platform: "Instagram", handle: "@mayachen", url: "https://instagram.com/mayachen", followers: 210000, avg_views: 92000, engagement_rate: 4.4, posting_frequency: "Daily stories" },
  { id: "p3", creator_id: "c2", platform: "YouTube", handle: "Jordan Builds", url: "https://youtube.com/@jordanbuilds", followers: 310000, avg_views: 145000, engagement_rate: 5.1, posting_frequency: "2x weekly" },
  { id: "p4", creator_id: "c2", platform: "Twitch", handle: "jordanmileslive", url: "https://twitch.tv/jordanmileslive", followers: 78000, avg_views: 18000, engagement_rate: 7.2, posting_frequency: "4 streams weekly" },
  { id: "p5", creator_id: "c3", platform: "Instagram", handle: "@aishamoves", url: "https://instagram.com/aishamoves", followers: 380000, avg_views: 110000, engagement_rate: 3.7, posting_frequency: "Daily" }
];

export const brands: Brand[] = [
  { id: "b1", name: "Everlane", website: "https://everlane.com", industry: "Apparel", contact_email: "partnerships@everlane.example", status: "target" },
  { id: "b2", name: "Logitech G", website: "https://logitechg.com", industry: "Gaming hardware", contact_email: "creators@logitech.example", status: "active" },
  { id: "b3", name: "WHOOP", website: "https://whoop.com", industry: "Wearables", contact_email: "influencers@whoop.example", status: "target" },
  { id: "b4", name: "Notion", website: "https://notion.so", industry: "Productivity", contact_email: "creators@notion.example", status: "target" }
];

export const deals: Deal[] = [
  { id: "d1", creator_id: "c1", brand_id: "b1", title: "Capsule wardrobe TikTok launch", deliverables: "2 TikTok posts, 3 IG story frames, 30-day usage", amount_cents: 1850000, currency: "inr", stage: "negotiating", payment_status: "pending", deliverable_status: "not_started", risk_score: 36, start_date: "2026-04-10", due_date: "2026-05-07", notes: "Push back on perpetual usage clause." },
  { id: "d2", creator_id: "c2", brand_id: "b2", title: "Creator desk setup YouTube integration", deliverables: "90-second YouTube integration, Twitch panel, pinned comment", amount_cents: 1225000, currency: "inr", stage: "funded", payment_status: "funded", deliverable_status: "draft_due", risk_score: 18, start_date: "2026-04-18", due_date: "2026-05-03", notes: "Payment funded. Awaiting draft URL." },
  { id: "d3", creator_id: "c3", brand_id: "b3", title: "Recovery routine Reel package", deliverables: "1 Reel, 5 story frames, link sticker, 14-day usage", amount_cents: 680000, currency: "inr", stage: "delivered", payment_status: "release_ready", deliverable_status: "submitted", risk_score: 22, start_date: "2026-04-01", due_date: "2026-04-26", notes: "Ready for admin approval." },
  { id: "d4", creator_id: "c1", brand_id: "b4", title: "Creator planning workflow", deliverables: "1 TikTok, 1 carousel, newsletter mention", amount_cents: 940000, currency: "inr", stage: "lead", payment_status: "unpaid", deliverable_status: "not_started", risk_score: 12, start_date: "2026-05-01", due_date: "2026-05-22", notes: "Strong audience overlap with creator business tools." }
];

export const payments: Payment[] = [
  { id: "pay1", deal_id: "d1", amount_cents: 1850000, platform_fee_cents: 185000, creator_payout_cents: 1665000, status: "pending" },
  { id: "pay2", deal_id: "d2", stripe_checkout_session_id: "cs_demo_funded", amount_cents: 1225000, platform_fee_cents: 122500, creator_payout_cents: 1102500, status: "funded", funded_at: "2026-04-20T16:00:00Z" },
  { id: "pay3", deal_id: "d3", stripe_checkout_session_id: "cs_demo_ready", amount_cents: 680000, platform_fee_cents: 68000, creator_payout_cents: 612000, status: "release_ready", funded_at: "2026-04-03T16:00:00Z" }
];

export const brandMatches: BrandMatch[] = [
  { id: "m1", creator_id: "c1", brand_id: "b1", fit_score: 94, match_reason: "Audience strongly indexes toward ethical fashion and capsule wardrobes.", outreach_angle: "Position Maya as a launch partner for transparent sourcing stories.", suggested_intro: "Maya can turn Everlane's supply-chain story into a high-retention thrift-to-capsule series.", status: "recommended" },
  { id: "m2", creator_id: "c2", brand_id: "b2", fit_score: 91, match_reason: "Hardware buying intent is visible in chat questions and YouTube comments.", outreach_angle: "Lead with measurable desk setup conversion moments.", suggested_intro: "Jordan's audience asks for peripheral recommendations during live setup builds.", status: "active" },
  { id: "m3", creator_id: "c3", brand_id: "b3", fit_score: 87, match_reason: "Recovery and quantified wellness content maps to WHOOP positioning.", outreach_angle: "Frame a recovery challenge with trackable habit checkpoints.", suggested_intro: "Aisha can make recovery metrics feel approachable for time-constrained professionals.", status: "recommended" }
];

export const contracts: Contract[] = [
  {
    id: "ct1",
    deal_id: "d1",
    file_path: null,
    raw_text: "Brand requests perpetual paid usage, two rounds of revisions, payment net 60 after approval.",
    scan_status: "complete",
    risk_level: "caution",
    summary: "The deal is commercially viable, but usage and payment timing need tighter limits before signature.",
    flags: [
      { id: "f1", contract_id: "ct1", flag_type: "usage_rights", severity: "high", excerpt: "perpetual paid usage", recommendation: "Limit paid usage to 30-90 days and price extensions separately." },
      { id: "f2", contract_id: "ct1", flag_type: "payment_terms", severity: "medium", excerpt: "net 60 after approval", recommendation: "Ask for payment on funding or net 15 from delivery approval." }
    ]
  }
];

export const aiValuations: AiValuation[] = [
  { id: "v1", creator_id: "c1", platform: "TikTok", low_estimate_cents: 220000, base_estimate_cents: 277500, high_estimate_cents: 360750, confidence_score: 0.76, package_recommendation: "Two TikToks plus three IG story frames with 30-day organic usage.", rationale: "Strong US audience, sustainable fashion niche, and repeatable series format support a premium band." },
  { id: "v2", creator_id: "c2", platform: "YouTube", low_estimate_cents: 435000, base_estimate_cents: 580000, high_estimate_cents: 812000, confidence_score: 0.81, package_recommendation: "90-second integration with Twitch mention and pinned shopping link.", rationale: "YouTube views and high purchase intent make integrations more valuable than short social mentions." }
];

export function getCreatorBundle(id: string) {
  const creator = creators.find((item) => item.id === id);
  return {
    creator,
    platforms: creatorPlatforms.filter((item) => item.creator_id === id),
    deals: deals.filter((item) => item.creator_id === id),
    matches: brandMatches.filter((item) => item.creator_id === id),
    valuations: aiValuations.filter((item) => item.creator_id === id)
  };
}

export function getDealBundle(id: string) {
  const deal = deals.find((item) => item.id === id);
  return {
    deal,
    creator: creators.find((item) => item.id === deal?.creator_id),
    brand: brands.find((item) => item.id === deal?.brand_id),
    payment: payments.find((item) => item.deal_id === id),
    contract: contracts.find((item) => item.deal_id === id)
  };
}
