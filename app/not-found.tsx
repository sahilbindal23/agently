import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <SearchX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
        This page doesn&apos;t exist or you don&apos;t have access to it. If you followed a link, it may be outdated.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Go to dashboard
        </Link>
        <Link
          href="javascript:history.back()"
          className="inline-flex h-10 items-center gap-2 rounded-md border bg-white px-4 text-sm font-semibold transition hover:bg-muted dark:border-white/10 dark:bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Link>
      </div>
    </div>
  );
}
