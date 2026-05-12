import { z } from "zod";

export const valuationInputSchema = z.object({
  platform: z.string(),
  avg_views: z.coerce.number().nonnegative(),
  followers: z.coerce.number().nonnegative(),
  engagement_rate: z.coerce.number().nonnegative(),
  us_audience_percent: z.coerce.number().min(0).max(100),
  niche: z.string()
});

export const dealInputSchema = z.object({
  creator_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  title: z.string().min(2),
  deliverables: z.string().min(2),
  amount_cents: z.coerce.number().int().positive(),
  due_date: z.string()
});
