import { NextResponse } from "next/server";
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

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const auth = await createClient();
    const { data } = await auth.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

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
