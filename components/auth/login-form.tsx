"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(body.error ?? "Could not sign in.");
      return;
    }

    router.push(body.next_url ?? "/app");
    router.refresh();
  }

  function fillDemo(email: string) {
    const form = document.querySelector<HTMLFormElement>("[data-login-form]");
    if (!form) return;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    setInputValue(emailInput, email);
    setInputValue(passwordInput, "DemoPassword123!");
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
          <Input name="password" type="password" placeholder="Password" required />
          <div className="flex justify-end">
            <Link className="text-xs font-medium text-primary hover:underline" href="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <Button className="w-full" disabled={status === "loading"} type="submit">{status === "loading" ? "Signing in..." : "Continue"}</Button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
        <div className="mt-5 rounded-md border bg-muted p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Demo logins</p>
          <div className="grid gap-2">
            <button className="rounded-md border bg-white px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => fillDemo("creator@agently.demo")} type="button">
              Creator: creator@agently.demo
            </button>
            <button className="rounded-md border bg-white px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => fillDemo("brand@agently.demo")} type="button">
              Brand: brand@agently.demo
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Password for both: DemoPassword123!</p>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          New to Agently? <Link className="font-medium text-primary" href="/signup">Start intake</Link>
        </p>
        <AuthLegalFooter className="mt-5" />
      </Card>
      </div>
    </main>
  );
}

function setInputValue(input: HTMLInputElement | null, value: string) {
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
