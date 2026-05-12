import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Reset password - Agently"
};

// Server-protected: only renders the form if Supabase has set a session
// via the /auth/callback handler (which exchanged the recovery code). If
// someone hits this URL directly without a valid recovery session, bounce
// them to /forgot-password.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/forgot-password?expired=1");
  }
  return <ResetPasswordForm userEmail={data.user.email ?? ""} />;
}
