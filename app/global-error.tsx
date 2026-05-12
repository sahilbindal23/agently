"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
          <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agently</p>
            <h1 className="mt-3 text-2xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The team has been notified. You can retry this page or return to the app once the issue clears.
            </p>
            <button
              className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              onClick={reset}
              type="button"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
