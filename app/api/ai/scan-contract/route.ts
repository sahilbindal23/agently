import { NextResponse } from "next/server";
import { trackEvent, userEventBase } from "@/lib/analytics/track";
import { getOpenAI } from "@/lib/openai/client";
import { contractScanPrompt } from "@/prompts/contract-scan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { RiskLevel } from "@/types";

type ContractFlagPayload = {
  flag_type: string;
  severity: "low" | "medium" | "high";
  excerpt: string;
  recommendation: string;
};

type ContractScanPayload = {
  risk_level: RiskLevel;
  summary: string;
  flags: ContractFlagPayload[];
};

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.raw_text ?? body.text ?? "").trim();
  const dealId = String(body.deal_id ?? "").trim();

  if (!text) {
    return NextResponse.json({ error: "Contract text is required." }, { status: 400 });
  }

  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const fallback = scanFallback(text);
  const openai = getOpenAI();
  let scan: ContractScanPayload & { source?: string } = { ...fallback, source: "rules_fallback" };

  if (openai) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: contractScanPrompt },
        { role: "user", content: text }
      ]
    });

    scan = normalizeScan(JSON.parse(completion.choices[0]?.message.content ?? JSON.stringify(fallback)));
  }

  if (!dealId) return NextResponse.json(scan);

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json(scan);
  const allowed = await canScanDealContract(supabase, dealId, authData.user.id, authData.user.email ?? "");
  if (!allowed) return NextResponse.json({ error: "Not allowed to scan a contract for this deal." }, { status: 403 });

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .insert({
      deal_id: dealId,
      raw_text: text,
      scan_status: "complete",
      risk_level: scan.risk_level,
      summary: scan.summary
    })
    .select("*")
    .single();

  if (contractError) {
    return NextResponse.json({ error: contractError.message }, { status: 500 });
  }

  if (scan.flags.length) {
    const { error: flagsError } = await supabase.from("contract_flags").insert(
      scan.flags.map((flag) => ({
        contract_id: contract.id,
        flag_type: flag.flag_type,
        severity: flag.severity,
        excerpt: flag.excerpt,
        recommendation: flag.recommendation
      }))
    );

    if (flagsError) {
      return NextResponse.json({ error: flagsError.message }, { status: 500 });
    }
  }

  await supabase
    .from("deals")
    .update({ risk_score: riskScoreFor(scan.risk_level) })
    .eq("id", dealId);

  await trackEvent(supabase, {
    ...userEventBase(authData.user),
    eventName: "contract_scanned",
    entityType: "contract",
    entityId: contract.id,
    metadata: {
      deal_id: dealId,
      risk_level: scan.risk_level,
      flag_count: scan.flags.length,
      source: scan.source ?? "openai"
    }
  });

  return NextResponse.json({ ...scan, contract_id: contract.id, source: scan.source ?? "openai" });
}

function normalizeScan(scan: Partial<ContractScanPayload>): ContractScanPayload {
  const risk = scan.risk_level === "high_risk" || scan.risk_level === "caution" || scan.risk_level === "safe"
    ? scan.risk_level
    : "caution";
  const flags = Array.isArray(scan.flags) ? scan.flags : [];
  return {
    risk_level: risk,
    summary: String(scan.summary ?? "Contract scanned. Review the flagged terms before signature."),
    flags: flags.map((flag) => ({
      flag_type: String(flag.flag_type ?? "contract_term"),
      severity: flag.severity === "high" || flag.severity === "medium" || flag.severity === "low" ? flag.severity : "medium",
      excerpt: String(flag.excerpt ?? ""),
      recommendation: String(flag.recommendation ?? "Review this term before signing.")
    }))
  };
}

function scanFallback(text: string): ContractScanPayload {
  const flags: ContractFlagPayload[] = [];
  const lower = text.toLowerCase();
  if (lower.includes("perpetual")) flags.push({ flag_type: "usage_rights", severity: "high", excerpt: "perpetual", recommendation: "Limit usage duration and charge for extensions." });
  if (lower.includes("net 60") || lower.includes("net 45")) flags.push({ flag_type: "payment_terms", severity: "medium", excerpt: "delayed payment terms", recommendation: "Request funded payment or net 15 after approval." });
  if (lower.includes("exclusiv")) flags.push({ flag_type: "exclusivity", severity: "medium", excerpt: "exclusivity", recommendation: "Narrow category, geography, and duration." });
  if (lower.includes("whitelist") || lower.includes("boost") || lower.includes("paid usage")) flags.push({ flag_type: "whitelisting", severity: "high", excerpt: "paid usage or whitelisting", recommendation: "Require a clear paid usage window, spend cap, and extension fee." });
  if (lower.includes("unlimited revision")) flags.push({ flag_type: "revisions", severity: "medium", excerpt: "unlimited revisions", recommendation: "Cap revision rounds and define what counts as a revision." });
  return {
    risk_level: flags.some((flag) => flag.severity === "high") ? "high_risk" : flags.length ? "caution" : "safe",
    summary: flags.length ? "Review flagged terms before signature." : "No obvious high-risk creator sponsorship terms detected by fallback scan.",
    flags
  };
}

function riskScoreFor(risk: RiskLevel) {
  if (risk === "high_risk") return 82;
  if (risk === "caution") return 45;
  return 12;
}

async function canScanDealContract(admin: NonNullable<ReturnType<typeof createAdminClient>>, dealId: string, profileId: string, email: string) {
  const [{ data: profile }, { data: deal }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", profileId).maybeSingle(),
    admin.from("deals").select("creator_id, brand_id, campaign_id").eq("id", dealId).maybeSingle()
  ]);
  if (!deal) return false;
  if (profile?.role === "admin") return true;

  const { data: creator } = await admin.from("creators").select("profile_id").eq("id", deal.creator_id).maybeSingle();
  if (creator?.profile_id === profileId) return true;

  const [{ data: brand }, { data: audit }, { data: campaign }] = await Promise.all([
    admin.from("brands").select("contact_email").eq("id", deal.brand_id).maybeSingle(),
    admin.from("brand_audits").select("id").eq("profile_id", profileId).eq("brand_id", deal.brand_id).maybeSingle(),
    deal.campaign_id
      ? admin.from("campaigns").select("profile_id").eq("id", deal.campaign_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);
  return Boolean(
    brand?.contact_email && String(brand.contact_email).toLowerCase() === email.toLowerCase() ||
    audit ||
    campaign?.profile_id === profileId
  );
}
