type CompletionItem = {
  label: string;
  done: boolean;
  reason: string;
  href?: string;
};

export type ProfileCompleteness = {
  score: number;
  label: string;
  items: CompletionItem[];
  nextAction: CompletionItem | null;
};

export function creatorCompleteness(input: {
  creator: Record<string, unknown>;
  platforms?: unknown[];
  deals?: unknown[];
  hasAudit?: boolean;
}) {
  return buildCompleteness([
    {
      label: "Add a profile image",
      done: Boolean(input.creator.image_url),
      reason: "Marketplace cards perform better when brands can recognize the creator quickly."
    },
    {
      label: "Connect at least one social platform",
      done: Boolean(input.platforms?.length),
      reason: "Matching and valuation need follower, view, and engagement context."
    },
    {
      label: "Capture India/Bangalore audience data",
      done: Number(input.creator.india_audience_percent ?? 0) > 0 || Boolean(input.creator.home_city),
      reason: "Agently is India-first, so city and audience signals drive campaign fit."
    },
    {
      label: "Add content style and sponsor categories",
      done: Boolean(input.creator.content_style) || hasArrayValues(input.creator.prior_sponsor_categories),
      reason: "Brand matching improves when the AI knows what you make and what categories fit."
    },
    {
      label: "Run or refresh AI profile audit",
      done: Boolean(input.hasAudit),
      reason: "The audit turns social/profile signals into sponsor readiness and positioning."
    },
    {
      label: "Review deal workflow",
      done: Boolean(input.deals?.length),
      reason: "Once offers arrive, contract scan, deliverables, and payment protection activate.",
      href: "/offers"
    }
  ]);
}

export function freelancerCompleteness(input: {
  freelancer: Record<string, unknown>;
  serviceRates?: unknown[];
  portfolio?: unknown[];
  projects?: unknown[];
}) {
  return buildCompleteness([
    {
      label: "Add a profile image",
      done: Boolean(input.freelancer.image_url),
      reason: "Brands need a credible card before shortlisting production talent."
    },
    {
      label: "List skills and service category",
      done: Boolean(input.freelancer.service_category) && hasArrayValues(input.freelancer.skills),
      reason: "Freelancer recommendations depend on scope, category, and production skills."
    },
    {
      label: "Add project-specific service rates",
      done: Boolean(input.serviceRates?.length),
      reason: "Brands compare real service packages like podcast edit, shoot day, thumbnail, or reel cut."
    },
    {
      label: "Upload portfolio links",
      done: Boolean(input.portfolio?.length),
      reason: "Portfolio links increase trust and improve the production fit score."
    },
    {
      label: "Set hourly rate and availability",
      done: Number(input.freelancer.hourly_rate_cents ?? 0) > 0 && Boolean(input.freelancer.availability_status),
      reason: "Hourly rate and availability help brands decide whether to send a project."
    },
    {
      label: "Review project offers",
      done: Boolean(input.projects?.length),
      reason: "Accepted projects unlock deliverable submission and protected payout workflow.",
      href: "/offers"
    }
  ]);
}

export function brandCompleteness(input: {
  brand?: Record<string, unknown> | null;
  audit?: Record<string, unknown> | null;
  campaigns?: unknown[];
  deals?: unknown[];
  projects?: unknown[];
  connectedAccounts?: unknown[];
}) {
  return buildCompleteness([
    {
      label: "Add a brand profile image",
      done: Boolean(input.brand?.image_url),
      reason: "Creators and freelancers should recognize the brand on marketplace cards."
    },
    {
      label: "Complete brand intake/audit",
      done: Boolean(input.audit),
      reason: "The audit turns brand goals into creator archetypes and campaign positioning."
    },
    {
      label: "Connect a social account",
      done: Boolean(input.connectedAccounts?.length),
      reason: "Connected Instagram / Facebook / YouTube proves the brand is real and lifts your trust score with creators evaluating your offers.",
      href: "/profile"
    },
    {
      label: "Create first campaign brief",
      done: Boolean(input.campaigns?.length),
      reason: "Campaign briefs are the source of realistic creator and freelancer matching.",
      href: "/campaigns"
    },
    {
      label: "Send a creator offer",
      done: Boolean(input.deals?.length),
      reason: "Creator offers test the sponsorship workflow, contract scan, and payment protection."
    },
    {
      label: "Send a freelancer project",
      done: Boolean(input.projects?.length),
      reason: "Freelancer projects cover production needs like editing, shooting, and design."
    },
    {
      label: "Review campaign insights",
      done: Boolean(input.campaigns?.length && (input.deals?.length || input.projects?.length)),
      reason: "Insights become useful once campaigns have recommendations, offers, or delivery activity.",
      href: "/brand-insights"
    }
  ]);
}

function buildCompleteness(items: CompletionItem[]): ProfileCompleteness {
  const completed = items.filter((item) => item.done).length;
  const score = Math.round((completed / items.length) * 100);
  return {
    score,
    label: score >= 84 ? "Ready for matching" : score >= 50 ? "Needs a few upgrades" : "Incomplete",
    items,
    nextAction: items.find((item) => !item.done) ?? null
  };
}

function hasArrayValues(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}
