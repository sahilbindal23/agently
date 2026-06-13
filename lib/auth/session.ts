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
    // Service role key missing = misconfiguration. Fail CLOSED to the least-
    // privileged role rather than open to admin, so a broken deploy can never
    // hand every visitor admin access. (Was previously "admin".)
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      full_name: data.user.user_metadata?.full_name ?? "Agently user",
      role: "creator"
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
    // Role is authoritative ONLY from the profiles table. If the row is missing
    // we fail closed to a non-privileged role — never admin, and never the
    // client-writable user_metadata.role (which a user can rewrite themselves).
    role: profile?.role ?? "creator"
  };
});
