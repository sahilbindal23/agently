"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { HomeLogo } from "@/components/layout/home-logo";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  // Surface success/failure messages routed in via query params:
  //   - ?password_reset=1   → green "your password was updated, log in"
  //   - ?verified=1         → green "email verified, log in"
  //   - ?error=<message>    → red banner explaining the failure
  useEffect(() => {
    if (params.get("password_reset")) {
      setBanner("Your password has been updated. Sign in with the new one.");
    } else if (params.get("verified")) {
      setBanner("Email verified. You can sign in now.");
    } else {
      const queryError = params.get("error");
      if (queryError) setError(queryError);
    }
  }, [params]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });
    } catch {
      // iOS Safari throws "TypeError: Load failed" on transient network
      // drops (wifi handoff, brief 4G dips). Catch it so the button resets
      // and Sentry doesn't see an unhandled rejection.
      setStatus("error");
      setError("Network problem. Check your connection and try again.");
      return;
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(body.error ?? "Could not sign in.");
      return;
    }

    router.push(body.next_url ?? "/app");
    router.refresh();
  }

  return (
    <main className="min-h-screen px-4 py-5">
      <div className="mx-auto flex max-w-6xl justify-start">
        <HomeLogo />
      </div>
      <div className="flex min-h-[calc(100vh-96px)] items-center justify-center">
      <Card className="w-full max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Agently</p>
        <h1 className="mt-3 text-2xl font-bold">Sign in</h1>
        {banner ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            {banner}
          </div>
        ) : null}
        <form className="mt-6 space-y-4" method="post" onSubmit={onSubmit} data-login-form>
          <Input name="email" type="email" placeholder="Email" required />
          <PasswordInput name="password" placeholder="Password" required />
          <div className="flex justify-end">
            <Link className="text-xs font-medium text-primary hover:underline" href="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <Button className="w-full" disabled={status === "loading"} type="submit">{status === "loading" ? "Signing in..." : "Continue"}</Button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
        <p className="mt-5 text-sm text-muted-foreground">
          New to Agently? <Link className="font-medium text-primary" href="/signup">Start intake</Link>
        </p>
        <AuthLegalFooter className="mt-5" />
      </Card>
      </div>
    </main>
  );
}
