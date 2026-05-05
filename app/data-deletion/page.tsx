import Link from "next/link";
import { HomeLogo } from "@/components/layout/home-logo";
import { Card } from "@/components/ui/card";

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">
        <HomeLogo className="mb-8" />
        <Card className="space-y-5 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agently</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">Data Deletion Instructions</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: May 5, 2026</p>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            Agently users can request deletion of their account data, profile data, messages, connected social account data, and synced social metrics.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">How To Request Deletion</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Email <a className="font-semibold text-primary" href="mailto:sahilbindal23@gmail.com">sahilbindal23@gmail.com</a> with the subject line “Agently data deletion request.” Include the email address used for your Agently account and any connected social account handles you want removed.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What We Delete</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              We will delete or anonymize account profile records, connected social account tokens, synced social metrics, and related prototype workflow data unless retention is required for legal, security, or dispute-resolution reasons.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Timing</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              We aim to process deletion requests within 30 days. During the prototype period, deletion requests are handled manually by the Agently team.
            </p>
          </section>

          <Link className="inline-flex text-sm font-semibold text-primary" href="/">Back to Agently</Link>
        </Card>
      </div>
    </main>
  );
}
