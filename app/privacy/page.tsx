import Link from "next/link";
import { HomeLogo } from "@/components/layout/home-logo";
import { Card } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">
        <HomeLogo className="mb-8" />
        <Card className="space-y-5 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agently</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: May 5, 2026</p>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            Agently is a prototype creator, freelancer, and brand workflow platform. We collect account, profile, campaign, offer, message, payment workflow, and connected social account data only to operate and improve the platform experience.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Information We Use</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Users may provide profile details, portfolio links, campaign briefs, messages, offer responses, and payment workflow information. If a creator connects a social account, Agently may request permitted profile and performance metrics from that provider to support verification and matching.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">How We Use Information</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              We use information to power profile discovery, campaign recommendations, offer workflows, protected payout tracking, notifications, and account support. We do not sell user personal information.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Social Account Data</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Social account access is optional. Users can disconnect accounts or request deletion of stored social account data. Agently stores only the access needed to sync permitted metrics for the connected account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              For privacy questions or deletion requests, contact <a className="font-semibold text-primary" href="mailto:sahilbindal23@gmail.com">sahilbindal23@gmail.com</a>.
            </p>
          </section>

          <Link className="inline-flex text-sm font-semibold text-primary" href="/">Back to Agently</Link>
        </Card>
      </div>
    </main>
  );
}
