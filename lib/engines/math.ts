export const engineWeights = {
  campaignRecommendation: [
    { key: "category_fit", label: "Category fit", weight: 0.22, description: "How closely niche, content style, or freelancer service maps to the campaign brief." },
    { key: "audience_fit", label: "Audience fit", weight: 0.18, description: "How well the talent reaches the requested audience or campaign goal." },
    { key: "city_fit", label: "City fit", weight: 0.16, description: "Bangalore and India relevance, including local city signals." },
    { key: "budget_fit", label: "Budget fit", weight: 0.14, description: "Whether the campaign budget is realistic for the expected work or reach." },
    { key: "platform_fit", label: "Platform fit", weight: 0.12, description: "Fit against requested creator channel or production format." },
    { key: "language_fit", label: "Language fit", weight: 0.1, description: "Overlap between campaign languages and talent languages." },
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
    { label: "Usage rights", value: "Up to +60% for usage beyond 30 days", description: "Longer licensing should cost more." },
    { label: "Paid usage/whitelisting", value: "+35%", description: "Paid usage changes the economics and should be time-capped." },
    { label: "Exclusivity", value: "Up to +50% based on exclusivity days", description: "Category restrictions block future revenue." },
    { label: "Revisions", value: "+8% per extra revision, capped at +24%", description: "More revision rounds increase production burden." },
    { label: "Rush turnaround", value: "+18% if under 5 days", description: "Fast timelines should carry a premium." }
  ],
  categoryDemand: [
    { label: "Fintech/finance", value: "1.28x", description: "Higher CAC-backed budgets." },
    { label: "Fashion/beauty", value: "1.15x", description: "Strong creator-commerce fit in Indian metros." },
    { label: "Gaming/tech", value: "1.12x", description: "Can pay well when purchase intent is clear." },
    { label: "Food/cafe/restaurant", value: "0.92x", description: "Often local and budget-sensitive." },
    { label: "Education/career", value: "1.08x", description: "Lead quality can support higher budgets." }
  ],
  trustAndBehavior: [
    { label: "Performance trust tier", value: "+18 data confidence", description: "Strongest verification tier." },
    { label: "Social trust tier", value: "+12 data confidence", description: "Social/API-backed profile signals." },
    { label: "Profile verified", value: "+7 data confidence", description: "Manual/profile verification." },
    { label: "API-synced metrics", value: "+5 data confidence and +7 sort boost", description: "Social platform data is more trustworthy than self-reported metrics." },
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
  "Bangalore and India relevance should matter more than US audience for this launch phase.",
  "Closed deals, payment outcomes, counter outcomes, and delivery outcomes should become the long-term moat.",
  "Every score must be explainable enough for an admin to defend and tune.",
  "User-facing screens should show enough reasoning to build trust, while admin screens can expose deeper math."
];
