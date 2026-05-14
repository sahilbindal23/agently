import type { Metadata } from "next";
import Link from "next/link";
import { HomeLogo } from "@/components/layout/home-logo";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Data Deletion | Agently",
  description: "How to request deletion of Agently account, profile, social, campaign, and workflow data."
};

const deletionSteps = [
  {
    title: "Email us",
    copy: "Send an email to support@agently.in with the subject line: Agently data deletion request."
  },
  {
    title: "Include account details",
    copy: "Include the email address used for your Agently account, your role, and any connected social handles or platforms you want removed."
  },
  {
    title: "Verification",
    copy: "We may ask for a brief confirmation from the account email before deleting data, so we do not remove the wrong account."
  },
  {
    title: "Processing",
    copy: "We aim to process deletion requests within 30 days unless a longer retention period is required for payment, security, legal, fraud prevention, or dispute-resolution reasons."
  }
];

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-4xl">
        <HomeLogo className="mb-8" />
        <Card className="space-y-7 p-6 sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agently</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">Data Deletion Instructions</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: May 12, 2026</p>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            You can request deletion of your Agently account data, profile data, messages, connected social account data, synced social metrics, portfolio assets, and related workflow records.
          </p>

          <section className="grid gap-3 sm:grid-cols-2">
            {deletionSteps.map((step) => (
              <div key={step.title} className="rounded-md border bg-background/70 p-4 dark:border-white/10">
                <h2 className="font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.copy}</p>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What We Delete Or Anonymize</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              We delete or anonymize account profile records, connected social account tokens, synced social metrics, saved handles, messages, portfolio references, and related workflow data where deletion is technically and legally possible.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">What May Be Retained</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Some information may be retained for payment records, security logs, fraud prevention, legal compliance, abuse investigations, or active dispute resolution. Where possible, we limit retained data to the minimum required.
            </p>
          </section>

          <section className="space-y-2 rounded-md border bg-muted/40 p-4 dark:border-white/10">
            <h2 className="text-lg font-semibold">Disconnecting Social Accounts</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              You can disconnect a connected social account inside Agently where available. You can also revoke Agently from the social provider&apos;s own account settings. After disconnection, Agently will stop syncing that account.
            </p>
          </section>

          <div className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/">Back to Agently</Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
