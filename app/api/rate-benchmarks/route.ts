import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const benchmarkSchema = z.object({
  platform: z.string().trim().min(1).max(80),
  niche: z.string().trim().min(1).max(120),
  deliverable_type: z.string().trim().min(1).max(120),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  market: z.string().trim().max(80).optional().or(z.literal("")),
  follower_min: z.coerce.number().int().min(0).optional().nullable(),
  follower_max: z.coerce.number().int().min(0).optional().nullable(),
  avg_view_min: z.coerce.number().int().min(0).optional().nullable(),
  avg_view_max: z.coerce.number().int().min(0).optional().nullable(),
  low_inr: z.coerce.number().int().min(0),
  base_inr: z.coerce.number().int().min(0),
  high_inr: z.coerce.number().int().min(0),
  source_type: z.string().trim().max(80).optional().or(z.literal("")),
  source_label: z.string().trim().max(160).optional().or(z.literal("")),
  confidence_score: z.coerce.number().min(0).max(1).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const parsed = benchmarkSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid benchmark." }, { status: 400 });
  }
  const body = parsed.data;
  if (body.high_inr < body.base_inr || body.base_inr < body.low_inr) {
    return NextResponse.json({ error: "Rate band must be low <= base <= high." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("rate_benchmarks")
    .insert({
      platform: body.platform,
      niche: body.niche,
      deliverable_type: body.deliverable_type,
      city: body.city || "Bengaluru",
      market: body.market || "India",
      follower_min: body.follower_min || null,
      follower_max: body.follower_max || null,
      avg_view_min: body.avg_view_min || null,
      avg_view_max: body.avg_view_max || null,
      low_cents: body.low_inr * 100,
      base_cents: body.base_inr * 100,
      high_cents: body.high_inr * 100,
      source_type: body.source_type || "founder_research",
      source_label: body.source_label || null,
      confidence_score: body.confidence_score ?? 0.6,
      notes: body.notes || null,
      created_by: user.id
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
