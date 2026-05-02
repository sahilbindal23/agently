import { redirect } from "next/navigation";
import { EnrollmentSignup } from "@/components/auth/enrollment-signup";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function IntakePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/signup");
  const user = await getCurrentUser();

  return <EnrollmentSignup initialMode={user?.role === "brand" ? "brand" : user?.role === "freelancer" ? "freelancer" : "creator"} />;
}
