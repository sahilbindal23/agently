"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { HomeLogo } from "@/components/layout/home-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password.length < 8) {
      setStatus("error");
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setError("Passwords do not match.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(body.error ?? "Could not update password. Try requesting a fresh link.");
      return;
    }

    setStatus("done");
    // Brief celebration moment then push them to login. We log them out of
    // the recovery session deliberately so they sign in with the new pw.
    setTimeout(() => {
      router.push("/login?password_reset=1");
      router.refresh();
    }, 1500);
  }

  return (
    <main className="min-h-screen px-4 py-5">
      <div className="mx-auto flex max-w-6xl justify-start">
        <HomeLogo />
      </div>
      <div className="flex min-h-[calc(100vh-96px)] items-center justify-center">
        <Card className="w-full max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Agently</p>
          <h1 className="mt-3 text-2xl font-bold">Choose a new password</h1>
          {userEmail ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Setting a new password for <strong className="text-foreground">{userEmail}</strong>.
            </p>
          ) : null}
          {status === "done" ? (
            <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> Password updated
              </p>
              <p className="mt-2 leading-6 text-emerald-800 dark:text-emerald-300">
                Taking you to the login page...
              </p>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <Input name="password" type="password" placeholder="New password (min 8 characters)" minLength={8} required autoFocus />
              <Input name="confirm" type="password" placeholder="Confirm new password" minLength={8} required />
              <Button className="w-full" disabled={status === "loading"} type="submit">
                <KeyRound className="h-4 w-4" />
                {status === "loading" ? "Updating..." : "Update password"}
              </Button>
              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
              <p className="flex items-start gap-2 rounded-md border bg-muted p-3 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                After updating, you&apos;ll be logged out of this recovery session and asked to sign in again with the new password.
              </p>
            </form>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            Changed your mind? <Link className="font-medium text-primary" href="/login">Back to login</Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
