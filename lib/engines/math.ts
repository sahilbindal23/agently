export const engineWeights = {
  campaignRecommendation: [
    { key: "category_fit", label: "Category fit", weight: 0.24, description: "How closely niche, content style, or freelancer service maps to the campaign brief." },
    { key: "budget_fit", label: "Budget fit", weight: 0.14, description: "Whether the campaign budget is realistic for the expected work or reach." },
    { key: "audience_fit", label: "Audience fit", weight: 0.12, description: "70% Phyllo demographic match (India %, city overlap, age range) + 30% topic keyword overlap when snapshots exist; falls back to keyword-only when none. Deliberately capped low — follower demographics are the most botable signal." },
    { key: "platform_fit", label: "Platform fit", weight: 0.12, description: "Fit against requested creator channel or production format." },
    { key: "language_fit", label: "Language fit", weight: 0.12, description: "Overlap between campaign languages and talent languages. Higher weight reflects India-wide language diversity." },
    { key: "engagement_quality", label: "Engagement quality (anti-bot)", weight: 0.10, description: "Real-engagement signals harder to fake than audience numbers: engagement rate vs follower-tier sanity band, view-to-follower ratio, consistency variance across historical snapshots." },
    { key: "city_fit", label: "City fit", weight: 0.08, description: "Bangalore-specific local signals. Bangalore launch is a wedge, not a constraint." },
    { key: "data_confidence", label: "Data confidence", weight: 0.08, description: "How much Agently trusts the underlying profile, API, and performance data." }
  ],
  creatorValuation: [
    { label: "YouTube integration", formula: "avg_views x INR 0.38", description: "Starting rate for integration-style sponsorships." },
    { label: "YouTube dedicated", formula: "avg_views x INR 0.90 x 1.9", description: "Dedicated videos require a higher base because the whole asset serves the sponsor." },
    { label: "Instagram story", formula: "max(followers x 0.012 x engagement factor, avg_views x 0.28)", description: "Story packages are anchored to both follower scale and observed views." },
    { label: "Instagram Reel", formula: "max(avg_views x 0.65, followers x 0.18)", description: "Reels receive a higher view/value anchor than story frames." },
    { label: "Short-form video", formula: "max(avg_views x 0.45, followers x 0.035)", description: "Used for TikTok-like or shorts-style content, even though TikTok is not India focus." }
  ],
  valuationMultipliers: [
    { label: "India audience premium", value: "+18% if India audience >= 80%; -18% if below 45%", description: "India-first relevance matters for Bangalore launch campaigns." },
    { label: "Bangalore fit premium", value: "+12% if Bangalore fit >= 80%; -10% if below 45%", description: "Local creator proof has extra value for city launches." },
    { label: "High engagement", value: "+12% if engagement >= 5%; -14% if below 2%", description: "Engagement improves sponsor confidence." },
    { label: "Revisions", value: "+8% per extra revision, capped at +24%", description: "More revision rounds increase production burden." },
    { label: "Rush turnaround", value: "+18% if under 5 days", description: "Fast timelines should carry a premium." }
  ],
  engagementQuality: [
    { label: "ER vs follower-tier sanity", value: "weight 0.45-0.6 of score", description: "Engagement rate should fall in the expected band for that follower count: 0-10k → 6-12%, 10k-100k → 3-8%, 100k-1M → 1.5-5%, 1M+ → 0.5-3%. Too high suggests engagement pods or bought engagement; too low suggests inflated followers without real audience." },
    { label: "View-to-follower ratio", value: "weight 0.30-0.40", description: "avg_views_30d / followers. <3% strongly suggests bought followers, 10-35% is healthy for India IG/YT, 35%+ is exceptional viral performance." },
    { label: "Engagement consistency", value: "weight 0.25 when history available", description: "Coefficient of variation of engagement_rate_30d across snapshots. <0.15 = stable real audience, 0.35-0.6 = spiky (possible bot purchases or content luck), >0.6 = highly volatile and not yet trustworthy." },
    { label: "Default for new creators", value: "60 (neutral)", description: "Creators without synced metrics get a neutral score so they aren't penalized for not having connected accounts yet." }
  ],
  categoryDemand: [
    { label: "Fintech/finance", value: "1.28x", description: "Higher CAC-backed budgets." },
    { label: "Fashion/beauty", value: "1.15x", description: "Strong creator-commerce fit in Indian metros." },
    { label: "Gaming/tech", value: "1.12x", description: "Can pay well when purchase intent is clear." },
    { label: "Food/cafe/restaurant", value: "0.92x", description: "Often local and budget-sensitive." },
    { label: "Education/career", value: "1.08x", description: "Lead quality can support higher budgets." }
  ],
  trustAndBehavior: [
    { label: "Verified by Agently", value: "+10 data confidence", description: "Profile passed Agently verification (admin review and/or Phyllo Connect). Collapsed from prior performance/social/profile tiers — beta-stage simplification until we have enough closed deals to justify finer granularity." },
    { label: "Reviewing", value: "+3 data confidence", description: "Verification is in flight." },
    { label: "Rejected", value: "-18 data confidence", description: "Profile failed verification." },
    { label: "API-synced metrics", value: "+5 data confidence and +7 sort boost", description: "Social platform data (Phyllo) is more trustworthy than self-reported metrics." },
    { label: "Completed work", value: "+4 to +10 data confidence", description: "Past completed Agently work increases trust." },
    { label: "Shortlisted", value: "+3 to +5 ranking points", description: "Brand intent signal, stronger within the same campaign." },
    { label: "Accepted offer", value: "+8 ranking points", description: "Talent has shown willingness to close deals." },
    { label: "Declined offer", value: "-7 ranking points", description: "Recent mismatch or availability signal." },
    { label: "Approved delivery", value: "+7 ranking points", description: "Delivery quality signal." },
    { label: "Revision requested", value: "-3 ranking points", description: "Execution friction signal." },
    { label: "Released/final payment", value: "+8 ranking points", description: "Workflow reached successful payout stage." }
  ],
  auditSignals: [
    { label: "Bangalore/local signals", value: "Bangalore, Bengaluru, BLR, Indiranagar, Koramangala, HSR, Whitefield, Church Street, colleges, etc.", description: "Used to infer local creator/brand relevance." },
    { label: "Language signals", value: "Kannada, Hinglish, Hindi, English, Tamil, Telugu, Malayalam", description: "Used for India-first matching and campaign fit." },
    { label: "Category signals", value: "fashion, food, gaming, tech, fitness, beauty, events", description: "Used for creator style and brand archetype matching." }
  ],
  protection: [
    { label: "Platform fee", value: "1% of funded contract value", description: "Simple prototype assumption for protected payout workflows." },
    { label: "Eligibility", value: "Available for funded workflows", description: "No fee cap or estimated fee is shown to users in the product UI." }
  ]
};

export const enginePrinciples = [
  "API-synced and completed-work data should outrank self-reported data.",
  "The engine should reward realistic fit, not vanity follower counts.",
  "India audience should matter more than US audience. Bangalore launch is a wedge, not a constraint — most of the weight goes to category, audience, budget, language.",
  "Closed deals, payment outcomes, counter outcomes, and delivery outcomes should become the long-term moat.",
  "Every score must be explainable enough for an admin to defend and tune.",
  "User-facing screens should show enough reasoning to build trust, while admin screens can expose deeper math."
];
