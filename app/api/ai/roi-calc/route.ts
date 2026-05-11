import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { projectROI } from "@/lib/benchmarks/roi";
import { gateRateLimit } from "@/lib/security/rate-limit-gate";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  platform: z.string().trim().min(1).max(40),
  niche: z.string().trim().min(1).max(60),
  deliverable_type: z.string().trim().max(40).optional(),
  follower_count: z.coerce.number().int().min(0).max(1_000_000_000),
  deliverable_count: z.coerce.number().int().min(1).max(50).optional().default(1),
  fixed_cost_inr: z.coerce.number().int().min(0).optional(),
  brand_aov_inr: z.coerce.number().int().min(0).optional(),
  reach_ratio: z.coerce.number().min(0.01).max(2).optional()
});

export async function POST(request: Request) {
  const gate = await gateRateLimit(request, "ai:roi-calc");
  if (gate) return gate;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const projection = await projectROI(admin, parsed.data);
  return NextResponse.json(projection);
}
