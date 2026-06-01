import { describe, expect, it } from "vitest";
import { rankCreators } from "@/lib/campaigns/recommendations";
import type { Brand, Campaign, Creator, CreatorPlatform } from "@/types";

// ---- fixtures -------------------------------------------------------------

function makeCreator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: "creator-1",
    display_name: "Test Creator",
    primary_niche: "tech",
    bio: "I review gadgets and consumer electronics.",
    country: "IN",
    us_audience_percent: 8,
    india_audience_percent: 82,
    home_city: "Bengaluru",
    languages: ["English", "Hindi"],
    top_indian_cities: ["Bengaluru", "Mumbai"],
    audience_age_range: "25-34",
    content_style: "long-form reviews",
    prior_sponsor_categories: ["tech"],
    monetization_score: 70,
    valuation_score: 70,
    ...overrides
  };
}

function makePlatform(creatorId: string, overrides: Partial<CreatorPlatform> = {}): CreatorPlatform {
  return {
    id: `${creatorId}-ig`,
    creator_id: creatorId,
    platform: "instagram",
    handle: "@creator",
    url: "https://instagram.com/creator",
    followers: 120_000,
    avg_views: 50_000,
    engagement_rate: 3.1,
    posting_frequency: "weekly",
    ...overrides
  };
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "campaign-1",
    is_demo: true,
    brand_id: "brand-1",
    profile_id: "profile-1",
    title: "Wireless earbuds launch",
    campaign_goal: "awareness",
    budget_cents: 5_000_000, // ₹50,000
    city_focus: "Bengaluru",
    region_focus: "South India",
    campaign_length: "2 weeks",
    target_audience: "urban tech buyers 25-34",
    platforms: ["instagram"],
    creator_categories: ["tech"],
    freelancer_needs: [],
    languages: ["English"],
    visibility: "private",
    status: "active",
    ...overrides
  };
}

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: "brand-1",
    name: "Earbuds Co",
    website: "https://earbuds.example",
    industry: "consumer electronics",
    contact_email: "brand@earbuds.example",
    status: "enrolled",
    ...overrides
  };
}

function byId(recs: ReturnType<typeof rankCreators>, id: string) {
  const found = recs.find((r) => r.id === id);
  if (!found) throw new Error(`recommendation ${id} not found`);
  return found;
}

// ---- the original motivating bug -----------------------------------------

describe("rankCreators — category relevance", () => {
  it("ranks a tech creator above a food/lifestyle creator on a tech earbuds brief", () => {
    const campaign = makeCampaign();
    const brand = makeBrand();
    const tech = makeCreator({ id: "tech", primary_niche: "tech", content_style: "long-form reviews" });
    const food = makeCreator({ id: "food", primary_niche: "food", content_style: "recipes", bio: "I cook regional food." });
    const platforms = [makePlatform("tech"), makePlatform("food")];

    const recs = rankCreators(campaign, [food, tech], platforms, [], brand);

    expect(recs[0].id).toBe("tech");
    expect(byId(recs, "tech").score).toBeGreaterThan(byId(recs, "food").score);
    expect(byId(recs, "tech").score_breakdown.category_fit).toBeGreaterThan(
      byId(recs, "food").score_breakdown.category_fit
    );
  });
});

// ---- two-sided (creator preference) matching ------------------------------

describe("rankCreators — creator preferences (two-sided matching)", () => {
  const campaign = makeCampaign();
  const brand = makeBrand();

  it("does not change ranking when a creator has stated no preferences", () => {
    const plain = makeCreator({ id: "plain" });
    const recs = rankCreators(campaign, [plain], [makePlatform("plain")], [], brand);
    const rec = byId(recs, "plain");
    // No preference-driven watchouts should appear.
    expect(rec.watchouts.some((w) => /excluded|stated minimum|not currently taking/i.test(w))).toBe(false);
  });

  it("sinks a creator who has excluded the campaign's category and explains why", () => {
    const open = makeCreator({ id: "open" });
    const excluded = makeCreator({ id: "excluded", excluded_categories: ["tech"] });
    const platforms = [makePlatform("open"), makePlatform("excluded")];

    const recs = rankCreators(campaign, [open, excluded], platforms, [], brand);

    expect(byId(recs, "excluded").score).toBeLessThan(byId(recs, "open").score);
    expect(byId(recs, "excluded").watchouts.some((w) => /excluded this category/i.test(w))).toBe(true);
    expect(recs[recs.length - 1].id).toBe("excluded");
  });

  it("boosts and labels a creator actively seeking the category", () => {
    const neutral = makeCreator({ id: "neutral" });
    const seeking = makeCreator({ id: "seeking", preferred_categories: ["tech"] });
    const platforms = [makePlatform("neutral"), makePlatform("seeking")];

    const recs = rankCreators(campaign, [neutral, seeking], platforms, [], brand);

    expect(byId(recs, "seeking").score).toBeGreaterThanOrEqual(byId(recs, "neutral").score);
    expect(byId(recs, "seeking").proof_points.some((p) => /actively seeking/i.test(p))).toBe(true);
  });

  it("penalizes and flags a brief below the creator's minimum deal value", () => {
    const cheapCampaign = makeCampaign({ budget_cents: 500_000 }); // ₹5,000
    const noFloor = makeCreator({ id: "no-floor" });
    const highFloor = makeCreator({ id: "high-floor", min_deal_cents: 2_000_000 }); // ₹20,000 floor
    const platforms = [makePlatform("no-floor"), makePlatform("high-floor")];

    const recs = rankCreators(cheapCampaign, [noFloor, highFloor], platforms, [], brand);

    expect(byId(recs, "high-floor").score).toBeLessThan(byId(recs, "no-floor").score);
    expect(byId(recs, "high-floor").watchouts.some((w) => /below the creator's stated minimum/i.test(w))).toBe(true);
  });

  it("deprioritizes a creator not currently taking offers", () => {
    const taking = makeCreator({ id: "taking", open_to_offers: true });
    const paused = makeCreator({ id: "paused", open_to_offers: false });
    const platforms = [makePlatform("taking"), makePlatform("paused")];

    const recs = rankCreators(campaign, [taking, paused], platforms, [], brand);

    expect(byId(recs, "paused").score).toBeLessThan(byId(recs, "taking").score);
    expect(byId(recs, "paused").watchouts.some((w) => /not currently taking new brand offers/i.test(w))).toBe(true);
  });
});
