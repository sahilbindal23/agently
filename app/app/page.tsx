import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AppEntryPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).single();

  if (profile?.role === "creator") redirect("/creator-home");
  if (profile?.role === "brand") redirect("/brand-home");
  if (profile?.role === "freelancer") redirect("/freelancer-home");
  redirect("/dashboard");
}
