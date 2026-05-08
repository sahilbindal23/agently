// Single source of truth for all enumerable form fields. Keeping these in
// one module prevents drift between the enrollment form, the profile edit
// form, the marketplace filters, and the engine taxonomy in
// lib/benchmarks/extract.ts.
//
// All values are canonical strings that match what the engines expect. Labels
// are user-facing.

export type Option = { value: string; label: string };

export const NICHES: Option[] = [
  { value: "fashion",     label: "Fashion & apparel" },
  { value: "beauty",      label: "Beauty & skincare" },
  { value: "food",        label: "Food, restaurants & cooking" },
  { value: "tech",        label: "Tech & gadgets" },
  { value: "fitness",     label: "Fitness & wellness" },
  { value: "finance",     label: "Finance & investing" },
  { value: "gaming",      label: "Gaming & esports" },
  { value: "travel",      label: "Travel & hospitality" },
  { value: "parenting",   label: "Parenting & family" },
  { value: "comedy",      label: "Comedy & entertainment" },
  { value: "education",   label: "Education & learning" },
  { value: "lifestyle",   label: "Lifestyle & vlogs" },
  { value: "home_decor",  label: "Home & interiors" },
  { value: "automobile",  label: "Auto & mobility" },
  { value: "music",       label: "Music & audio" },
  { value: "art",         label: "Art & design" },
  { value: "sports",      label: "Sports & athletes" },
  { value: "other",       label: "Other (specify in bio)" }
];

export const PLATFORMS: Option[] = [
  { value: "Instagram", label: "Instagram" },
  { value: "YouTube",   label: "YouTube" },
  { value: "Twitter",   label: "Twitter / X" },
  { value: "LinkedIn",  label: "LinkedIn" },
  { value: "TikTok",    label: "TikTok" },
  { value: "Regional",  label: "Regional (Moj / Josh / ShareChat)" }
];

export const INDIAN_CITIES: Option[] = [
  { value: "Bengaluru",  label: "Bengaluru" },
  { value: "Mumbai",     label: "Mumbai" },
  { value: "Delhi NCR",  label: "Delhi NCR" },
  { value: "Hyderabad",  label: "Hyderabad" },
  { value: "Chennai",    label: "Chennai" },
  { value: "Pune",       label: "Pune" },
  { value: "Kolkata",    label: "Kolkata" },
  { value: "Ahmedabad",  label: "Ahmedabad" },
  { value: "Jaipur",     label: "Jaipur" },
  { value: "Kochi",      label: "Kochi" },
  { value: "Lucknow",    label: "Lucknow" },
  { value: "Indore",     label: "Indore" },
  { value: "Chandigarh", label: "Chandigarh" },
  { value: "Bhubaneswar", label: "Bhubaneswar" },
  { value: "Goa",        label: "Goa" },
  { value: "Other",      label: "Other / Tier-2-3" }
];

export const LANGUAGES: Option[] = [
  { value: "english",   label: "English" },
  { value: "hindi",     label: "Hindi" },
  { value: "tamil",     label: "Tamil" },
  { value: "telugu",    label: "Telugu" },
  { value: "kannada",   label: "Kannada" },
  { value: "marathi",   label: "Marathi" },
  { value: "bengali",   label: "Bengali" },
  { value: "malayalam", label: "Malayalam" },
  { value: "gujarati",  label: "Gujarati" },
  { value: "punjabi",   label: "Punjabi" },
  { value: "urdu",      label: "Urdu" }
];

export const AUDIENCE_AGE_RANGES: Option[] = [
  { value: "13-17",   label: "13–17 (Gen Z teen)" },
  { value: "18-24",   label: "18–24 (Gen Z / college)" },
  { value: "25-34",   label: "25–34 (millennial / early career)" },
  { value: "35-44",   label: "35–44 (millennial / family)" },
  { value: "45+",     label: "45+ (Gen X / boomer)" },
  { value: "mixed",   label: "Mixed across ages" }
];

export const CONTENT_STYLES: Option[] = [
  { value: "vlog",          label: "Vlog / day-in-the-life" },
  { value: "talking_head",  label: "Talking head / opinion" },
  { value: "tutorial",      label: "Tutorial / how-to" },
  { value: "review",        label: "Review / unboxing" },
  { value: "comedy",        label: "Comedy / sketch" },
  { value: "lifestyle",     label: "Lifestyle / aesthetic" },
  { value: "documentary",   label: "Documentary / storytelling" },
  { value: "live_stream",   label: "Live streaming" },
  { value: "interview",     label: "Interview / podcast" }
];

export const SPONSOR_CATEGORIES: Option[] = [
  { value: "fashion",       label: "Fashion / apparel" },
  { value: "beauty",        label: "Beauty / skincare" },
  { value: "fmcg_food",     label: "FMCG / food" },
  { value: "fmcg_personal", label: "FMCG / personal care" },
  { value: "tech",          label: "Tech / electronics" },
  { value: "telecom",       label: "Telecom" },
  { value: "fintech",       label: "Fintech / payments" },
  { value: "edtech",        label: "Edtech" },
  { value: "gaming",        label: "Gaming / esports" },
  { value: "auto",          label: "Auto / mobility" },
  { value: "travel",        label: "Travel / hospitality" },
  { value: "ott",           label: "OTT / streaming" },
  { value: "qsr",           label: "QSR / food delivery" },
  { value: "d2c",           label: "D2C brand" },
  { value: "luxury",        label: "Luxury" },
  { value: "real_estate",   label: "Real estate" }
];

export const FREELANCER_SERVICES: Option[] = [
  { value: "videography",   label: "Videography" },
  { value: "editing",       label: "Video editing" },
  { value: "photography",   label: "Photography" },
  { value: "design",        label: "Graphic design" },
  { value: "motion",        label: "Motion graphics / VFX" },
  { value: "podcast",       label: "Podcast production" },
  { value: "audio",         label: "Audio / sound design" },
  { value: "writing",       label: "Copywriting / scripting" },
  { value: "production",    label: "Full production / studio" },
  { value: "other",         label: "Other creative service" }
];

export const FREELANCER_SKILLS: Option[] = [
  { value: "reels",          label: "Reels / shorts editing" },
  { value: "long_form",      label: "Long-form video editing" },
  { value: "motion",         label: "Motion graphics" },
  { value: "color",          label: "Colour grading" },
  { value: "sound",          label: "Sound mixing" },
  { value: "shoot_outdoor",  label: "Outdoor / on-location shoots" },
  { value: "shoot_studio",   label: "Studio shoots" },
  { value: "drone",          label: "Drone / aerial" },
  { value: "interview",      label: "Interview / podcast filming" },
  { value: "event",          label: "Event coverage" },
  { value: "ad_films",       label: "Ad films / TVC" },
  { value: "branding",       label: "Brand identity / logo" }
];

export const AVAILABILITY_STATUSES: Option[] = [
  { value: "available",     label: "Available now" },
  { value: "limited",       label: "Limited availability" },
  { value: "booked",        label: "Booked, taking only urgent work" },
  { value: "on_break",      label: "On break / not taking work" }
];

export const BRAND_INDUSTRIES: Option[] = [
  { value: "fashion",       label: "Fashion / apparel" },
  { value: "beauty",        label: "Beauty / personal care" },
  { value: "fmcg",          label: "FMCG / consumer goods" },
  { value: "food_beverage", label: "Food & beverage" },
  { value: "tech",          label: "Tech / SaaS" },
  { value: "consumer_electronics", label: "Consumer electronics" },
  { value: "fintech",       label: "Fintech / financial services" },
  { value: "edtech",        label: "Edtech / education" },
  { value: "healthtech",    label: "Healthtech / pharma" },
  { value: "auto",          label: "Auto / mobility" },
  { value: "travel",        label: "Travel / hospitality" },
  { value: "ecommerce",     label: "E-commerce / D2C" },
  { value: "gaming",        label: "Gaming / esports" },
  { value: "ott",           label: "OTT / streaming" },
  { value: "real_estate",   label: "Real estate" },
  { value: "professional_services", label: "Professional services" },
  { value: "other",         label: "Other" }
];

export const CREATOR_SIZE_BANDS: Option[] = [
  { value: "nano",  label: "Nano (1K–10K followers)" },
  { value: "micro", label: "Micro (10K–100K)" },
  { value: "mid",   label: "Mid (100K–500K)" },
  { value: "macro", label: "Macro (500K–1M)" },
  { value: "mega",  label: "Mega (1M+)" },
  { value: "mixed", label: "Mixed tiers" }
];

export const CAMPAIGN_LENGTHS: Option[] = [
  { value: "1_week",    label: "1 week burst" },
  { value: "2_4_weeks", label: "2–4 weeks" },
  { value: "1_3_months", label: "1–3 months" },
  { value: "3_6_months", label: "3–6 months" },
  { value: "always_on", label: "Always-on / ongoing" }
];

export const PRICE_POINTS: Option[] = [
  { value: "under_500",     label: "Under ₹500" },
  { value: "500_2000",      label: "₹500–₹2,000" },
  { value: "2000_10000",    label: "₹2,000–₹10,000" },
  { value: "10000_50000",   label: "₹10,000–₹50,000" },
  { value: "50000_plus",    label: "₹50,000+" },
  { value: "subscription",  label: "Subscription / SaaS pricing" },
  { value: "service",       label: "Service / B2B pricing" }
];

export const COUNTRIES: Option[] = [
  { value: "IN",  label: "India" },
  { value: "US",  label: "United States" },
  { value: "GB",  label: "United Kingdom" },
  { value: "AE",  label: "UAE" },
  { value: "SG",  label: "Singapore" },
  { value: "CA",  label: "Canada" },
  { value: "AU",  label: "Australia" },
  { value: "OTHER", label: "Other" }
];
