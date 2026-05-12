"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";
import { HomeLogo } from "@/components/layout/home-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(body.error ?? "Could not send reset link. Try again in a moment.");
      return;
    }

    setSubmittedEmail(email);
    setStatus("sent");
  }

  return (
    <main className="min-h-screen px-4 py-5">
      <div className="mx-auto flex max-w-6xl justify-start">
        <HomeLogo />
      </div>
      <div className="flex min-h-[calc(100vh-96px)] items-center justify-center">
        <Card className="w-full max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Agently</p>
          <h1 className="mt-3 text-2xl font-bold">Reset your password</h1>
          {status === "sent" ? (
            <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
                <Mail className="h-4 w-4" /> Check your email
              </p>
              <p className="mt-2 leading-6 text-emerald-800 dark:text-emerald-300">
                If an account exists for <strong>{submittedEmail}</strong>, a password reset link is on its way. The link expires in 1 hour.
              </p>
              <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
                Don&apos;t see it? Check spam, then try again. We won&apos;t tell you whether the email is registered for security reasons.
              </p>
              <Link href="/login" className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                Back to login <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Enter the email you used to sign up. We&apos;ll send a link to set a new password.
              </p>
              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <Input name="email" type="email" placeholder="Email" required autoFocus />
                <Button className="w-full" disabled={status === "loading"} type="submit">
                  <KeyRound className="h-4 w-4" />
                  {status === "loading" ? "Sending..." : "Send reset link"}
                </Button>
                {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
              </form>
            </>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            Remembered it? <Link className="font-medium text-primary" href="/login">Sign in</Link>
          </p>
          <AuthLegalFooter className="mt-5" />
        </Card>
      </div>
    </main>
  );
}
