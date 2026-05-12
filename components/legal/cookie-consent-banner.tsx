"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";

// DPDP Act 2023 + general consumer-protection good practice.
//
// We collect basic analytics (page views via Vercel Analytics) and
// error telemetry (Sentry) on every visit. Both are minimum-data
// reasonable-purpose under DPDP, but the user should still know it's
// happening and be able to opt out.
//
// What this banner does NOT do (intentional scope for beta):
//   - Granular per-category consent (analytics vs marketing vs functional)
//   - Block analytics scripts from running before consent. Vercel
//     Analytics and Sentry both initialise on first paint; a hard
//     opt-in gate would require a deeper refactor. For beta we go with
//     "notice + easy opt-out via /privacy" which matches the practical
//     pattern at LinkedIn/X/most India consumer apps.
//
// localStorage key: agently.cookie-consent
//   "accepted"  → user dismissed via Accept
//   "declined"  → user dismissed via Decline (no functional effect yet,
//                  but we'll honor it when granular gating ships)
//   missing     → first visit, show banner

const STORAGE_KEY = "agently.cookie-consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage blocked (private mode, strict cookies) — show the
      // banner each visit, since we can't remember the choice anyway.
      setVisible(true);
    }
  }, []);

  function persist(value: "accepted" | "declined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore — banner will show again next visit
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      aria-label="Cookie consent notice"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto max-w-3xl rounded-lg border bg-white p-4 shadow-lg dark:border-white/10 dark:bg-card sm:inset-x-4 sm:bottom-4"
      role="dialog"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-shrink-0 rounded-md bg-primary/10 p-2 text-primary">
          <Cookie aria-hidden className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">We use cookies and analytics</span> to keep Agently working,
            understand how it&apos;s used, and catch errors. Read our{" "}
            <Link className="font-medium text-primary underline" href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
            {" "}for the details, including how to delete your data under India&apos;s DPDP Act 2023.
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2 self-stretch sm:self-start">
          <button
            className="flex-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted dark:border-white/10 sm:flex-none"
            onClick={() => persist("declined")}
            type="button"
          >
            Decline
          </button>
          <button
            className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:flex-none"
            onClick={() => persist("accepted")}
            type="button"
          >
            Accept
          </button>
          <button
            aria-label="Dismiss cookie notice"
            className="hidden text-muted-foreground hover:text-foreground sm:block"
            onClick={() => persist("declined")}
            type="button"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
