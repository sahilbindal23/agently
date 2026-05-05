import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "creator" | "brand" | "freelancer";
} | null;

export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const admin = createAdminClient();
  if (!admin) {
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      full_name: data.user.user_metadata?.full_name ?? "Agently user",
      role: "admin"
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", data.user.id)
    .single();

  return {
    id: data.user.id,
    email: profile?.email ?? data.user.email ?? "",
    full_name: profile?.full_name ?? data.user.user_metadata?.full_name ?? "Agently user",
    role: profile?.role ?? "admin"
  };
});
