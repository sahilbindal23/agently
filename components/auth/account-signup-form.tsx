"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, UserPlus } from "lucide-react";
import { HomeLogo } from "@/components/layout/home-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Role = "creator" | "brand" | "freelancer";

const roleCopy = {
  creator: "You publish content on your own channels and bring audience attention.",
  brand: "You are looking for creators or production talent for campaigns.",
  freelancer: "You create, edit, shoot, design, or produce content without needing to post it."
};

export function AccountSignupForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("creator");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "verify_email">("idle");
  const [error, setError] = useState("");
  const [verifyEmail, setVerifyEmail] = useState<string>("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreedToTerms) {
      setError("Please agree to the Privacy Policy and Terms of Service to continue.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");

    const formData = new FormData(event.currentTarget);
    // Capture the explicit consent timestamp so we have a defensible record
    // of when the user agreed (required under India's DPDP Act 2023).
    const payload = {
      role,
      ...Object.fromEntries(formData.entries()),
      consent: {
        accepted: true,
        accepted_at: new Date().toISOString(),
        privacy_version: "2025-05-12",
        terms_version: "2025-05-12"
      }
    };
    const signup = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!signup.ok) {
      const body = await signup.json().catch(() => ({}));
      setStatus("error");
      setError(body.error ?? "Could not create account.");
      return;
    }

    const signupBody = await signup.json().catch(() => ({}));
    if (signupBody?.requires_email_verification) {
      // Don't auto-login - user must verify email first
      setStatus("verify_email");
      setVerifyEmail(String(formData.get("email") ?? ""));
      return;
    }

    const login = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.get("email"), password: formData.get("password") })
    });

    if (!login.ok) {
      router.push("/login");
      router.refresh();
      return;
    }

    router.push("/intake");
    router.refresh();
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-5xl justify-start">
        <HomeLogo />
      </div>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-center">
          <Badge tone="green" className="mb-4 w-fit">Create account</Badge>
          <h1 className="text-4xl font-bold tracking-normal">Start with a clean account, then build your intake profile.</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Signup stays simple. After this, Agently takes you through the right intake for creators, brands, or freelancers so matching, pricing, contracts, and payments have useful data from day one.
          </p>
          <div className="mt-5 rounded-md border bg-white p-4">
            <p className="text-sm font-semibold">{role.replace(/^./, (char) => char.toUpperCase())}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{roleCopy[role]}</p>
          </div>
        </section>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Create your Agently account</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">You can add another talent profile later from your workspace.</p>
            </div>
            <Badge tone="blue">{role}</Badge>
          </CardHeader>
          <div className="mb-5 grid gap-1 rounded-md border bg-white p-1 sm:grid-cols-3">
            {(["creator", "brand", "freelancer"] as Role[]).map((item) => (
              <button
                className={`rounded px-3 py-2 text-sm font-medium ${role === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                key={item}
                onClick={() => setRole(item)}
                type="button"
              >
                {item === "creator" ? "Creator" : item === "brand" ? "Brand" : "Freelancer"}
              </button>
            ))}
          </div>
          {status === "verify_email" ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">Check your email to verify</p>
              <p className="mt-2 leading-6 text-emerald-800 dark:text-emerald-300">
                We sent a verification link to <strong>{verifyEmail}</strong>. Click the link to confirm your address, then come back and log in.
              </p>
              <p className="mt-2 text-xs leading-5 text-emerald-700 dark:text-emerald-400">
                If the email doesn&apos;t arrive within a few minutes, check spam or try signing up again.
              </p>
              <Link href="/login" className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                Go to login <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <form className="grid gap-3" onSubmit={onSubmit}>
              <Input name="full_name" placeholder="Full name" required />
              <Input name="email" type="email" placeholder="Email" required />
              <Input name="password" type="password" placeholder="Password (min 8 characters)" minLength={8} required />
              <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-white p-3 text-sm leading-5 dark:bg-card dark:border-white/10">
                <input
                  checked={agreedToTerms}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  name="consent_terms_privacy"
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  required
                  type="checkbox"
                />
                <span className="text-muted-foreground">
                  I agree to the{" "}
                  <Link className="font-medium text-primary underline" href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
                  {" "}and{" "}
                  <Link className="font-medium text-primary underline" href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>
                  . I understand my data is processed per India&apos;s DPDP Act 2023.
                </span>
              </label>
              <Button disabled={status === "loading" || !agreedToTerms}>
                <UserPlus className="h-4 w-4" />
                {status === "loading" ? "Creating account..." : "Create account"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            </form>
          )}
          <p className="mt-5 text-sm text-muted-foreground">
            Already have an account? <Link className="font-medium text-primary" href="/login">Sign in</Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
