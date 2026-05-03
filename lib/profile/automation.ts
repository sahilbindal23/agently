export type AutomationDecision = {
  status: "discoverable" | "needs_correction" | "review";
  score: number;
  label: string;
  reasons: string[];
  nextActions: string[];
};

export function creatorAutomationDecision(input: {
  creator: Record<string, unknown>;
  platforms?: Array<Record<string, unknown>>;
}): AutomationDecision {
  const creator = input.creator;
  const platforms = input.platforms ?? [];
  const primary = platforms[0];
  const checks = [
    { passed: Boolean(creator.image_url), reason: "Add a profile image for marketplace trust." },
    { passed: platforms.length > 0, reason: "Connect at least one social platform." },
    { passed: Number(primary?.followers ?? 0) > 0, reason: "Follower count is required for matching." },
    { passed: Number(primary?.avg_views ?? 0) > 0, reason: "Average views are required for ROI projection." },
    { passed: Number(primary?.engagement_rate ?? 0) > 0, reason: "Engagement rate is required for campaign confidence." },
    { passed: Boolean(creator.primary_niche), reason: "Add a clear creator niche." },
    { passed: Boolean(creator.home_city) || Number(creator.india_audience_percent ?? 0) > 0, reason: "Add India/Bangalore audience or city signals." },
    { passed: Boolean(creator.content_style) || hasArrayValues(creator.prior_sponsor_categories), reason: "Add content style or sponsor categories." }
  ];
  const suspicious = creatorMetricFlags(primary);
  return decisionFromChecks(checks, suspicious, {
    discoverable: "Discoverable",
    needs: "Needs profile correction",
    review: "Needs Agently review"
  });
}

export function freelancerAutomationDecision(input: {
  freelancer: Record<string, unknown>;
  serviceRates?: Array<Record<string, unknown>>;
  portfolio?: Array<Record<string, unknown>>;
}): AutomationDecision {
  const freelancer = input.freelancer;
  const checks = [
    { passed: Boolean(freelancer.image_url), reason: "Add a profile image for marketplace trust." },
    { passed: Boolean(freelancer.service_category), reason: "Add a service category." },
    { passed: hasArrayValues(freelancer.skills), reason: "List the production skills brands can hire." },
    { passed: Number(freelancer.hourly_rate_cents ?? freelancer.day_rate_cents ?? 0) > 0, reason: "Add an hourly rate." },
    { passed: Boolean(input.serviceRates?.length), reason: "Add at least one project-specific service package." },
    { passed: Boolean(input.portfolio?.length) || Number(freelancer.portfolio_score ?? 0) > 0, reason: "Add portfolio proof or verified portfolio score." },
    { passed: Boolean(freelancer.availability_status), reason: "Set availability status." }
  ];
  return decisionFromChecks(checks, [], {
    discoverable: "Discoverable",
    needs: "Needs profile correction",
    review: "Needs portfolio review"
  });
}

export function brandAutomationDecision(input: {
  brand: Record<string, unknown>;
  campaigns?: Array<Record<string, unknown>>;
  audit?: Record<string, unknown> | null;
}): AutomationDecision {
  const brand = input.brand;
  const checks = [
    { passed: Boolean(brand.image_url), reason: "Add a brand image for marketplace cards." },
    { passed: Boolean(brand.industry), reason: "Add brand industry/category." },
    { passed: Boolean(brand.website), reason: "Add a website or public brand link." },
    { passed: Boolean(brand.contact_email), reason: "Add a contact email." }
  ];
  if ("audit" in input) checks.push({ passed: Boolean(input.audit), reason: "Complete brand intake/audit." });
  if ("campaigns" in input) checks.push({ passed: Boolean(input.campaigns?.length), reason: "Create at least one campaign brief." });
  return decisionFromChecks(checks, [], {
    discoverable: "Discoverable",
    needs: "Needs setup",
    review: "Needs brand review"
  });
}

export function isDiscoverable(decision: AutomationDecision) {
  return decision.status === "discoverable";
}

function decisionFromChecks(
  checks: Array<{ passed: boolean; reason: string }>,
  reviewFlags: string[],
  labels: { discoverable: string; needs: string; review: string }
): AutomationDecision {
  const passed = checks.filter((check) => check.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  const missing = checks.filter((check) => !check.passed).map((check) => check.reason);

  if (reviewFlags.length) {
    return {
      status: "review",
      score,
      label: labels.review,
      reasons: reviewFlags,
      nextActions: ["Agently will review the flagged profile signals before marketplace discovery."]
    };
  }

  if (score < 70) {
    return {
      status: "needs_correction",
      score,
      label: labels.needs,
      reasons: missing.slice(0, 4),
      nextActions: missing.slice(0, 3)
    };
  }

  return {
    status: "discoverable",
    score,
    label: labels.discoverable,
    reasons: ["Profile meets the minimum automated trust and discovery rules."],
    nextActions: ["Keep profile data fresh as niche, audience, portfolio, or campaign goals change."]
  };
}

function creatorMetricFlags(platform?: Record<string, unknown>) {
  if (!platform) return [];
  const followers = Number(platform.followers ?? 0);
  const avgViews = Number(platform.avg_views ?? 0);
  const engagement = Number(platform.engagement_rate ?? 0);
  const flags = [
    engagement > 25 ? "Engagement rate is unusually high and needs review." : "",
    followers > 0 && avgViews / followers > 3 ? "Average views are unusually high compared with followers." : "",
    followers > 100000 && avgViews < 1000 ? "Follower count is high but average views are very low." : ""
  ];
  return flags.filter(Boolean);
}

function hasArrayValues(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}
