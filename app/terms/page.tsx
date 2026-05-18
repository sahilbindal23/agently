import type { Metadata } from "next";
import Link from "next/link";
import { HomeLogo } from "@/components/layout/home-logo";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms of Service | Agently",
  description: "The beta terms for using Agently as a creator, freelancer, brand, or administrator."
};

const terms = [
  {
    title: "1. What Agently Provides",
    body: "Agently helps creators, freelancers, and brands manage discovery, campaign briefs, offers, messages, contract review, deliverables, payment workflow tracking, and profile or campaign recommendations. Agently is a workflow and marketplace platform, not a regulated escrow, bank, insurer, law firm, or talent agency unless a separate written agreement says otherwise."
  },
  {
    title: "2. Accounts And Roles",
    body: "You are responsible for keeping your login secure and for providing accurate account, profile, campaign, social, portfolio, payment, and contact information. Users may act as creators, freelancers, brands, or administrators depending on their account role and permissions."
  },
  {
    title: "3. Profiles, Discovery, And Messaging",
    body: "Creators, freelancers, and brands can be discoverable to each other through profile cards, campaign recommendations, messages, shortlists, and offers. You must not misrepresent identity, audience, experience, availability, pricing, deliverables, ownership, or brand affiliation."
  },
  {
    title: "4. Offers, Projects, And Campaigns",
    body: "Brands may submit campaign offers or freelancer project requests. Creators and freelancers may accept, decline, or request changes. Work should not begin until scope, amount, due date, usage rights, approval terms, and payment status are clear inside the workflow."
  },
  {
    title: "5. Contract Review And Templates",
    body: "Agently may provide contract templates, contract scans, or risk summaries. These tools are not legal advice and may miss important terms. Users should review final commercial terms and obtain legal advice where appropriate before signing or relying on a contract."
  },
  {
    title: "6. Protected Payout Workflow",
    body: "Agently may offer a protected payout workflow that tracks whether a brand has funded an approved offer and whether deliverables have been submitted and reviewed. This workflow is intended to reduce payment confusion. It is not a bank guarantee, insurance policy, regulated escrow, or unconditional promise of payment."
  },
  {
    title: "7. Payments And Fees",
    body: "Payment processing may be handled by third-party providers such as Razorpay or Stripe. Agently charges a platform fee, currently positioned at 2 percent for protected payout workflows during this beta, which covers payment processing, protected escrow, dispute handling, and payout. Payment availability, refunds, chargebacks, taxes, KYC, settlement timing, and payout methods may depend on the relevant payment provider."
  },
  {
    title: "8. AI And Recommendation Tools",
    body: "Agently may use AI or scoring systems to provide estimates, rankings, audit notes, negotiation suggestions, contract risk summaries, and campaign fit recommendations. These outputs are informational and should be reviewed by users before any commercial decision."
  },
  {
    title: "9. Connected Social Accounts",
    body: "Connecting social accounts is optional, but connected data may improve verification, profile readiness, matching, and score accuracy. You must only connect accounts you are authorized to access. You can disconnect supported accounts or request deletion of stored social account data."
  },
  {
    title: "10. Acceptable Use",
    body: "You must not use Agently for spam, harassment, fraud, impersonation, fake metrics, misleading offers, illegal content, unauthorized scraping, credential sharing, payment abuse, or attempts to bypass platform security or workflow rules."
  },
  {
    title: "11. Content And Intellectual Property",
    body: "Users keep ownership of content they upload unless separately agreed in an offer, project, campaign, or contract. By uploading content to Agently, you give Agently the limited permission needed to host, display, process, and share that content for platform workflows."
  },
  {
    title: "12. Disputes",
    body: "If a dispute arises, users should keep communication, deliverable links, approvals, and evidence inside Agently where possible. Agently may review platform records and help coordinate a resolution, but final legal rights depend on the applicable agreement and law."
  },
  {
    title: "13. Availability And Beta Changes",
    body: "Agently is being prepared for beta use. Features may change, break, be removed, or be limited while the platform is improved. We may suspend accounts or workflows that create risk for users, payment providers, platform partners, or Agently."
  },
  {
    title: "14. Limitation Of Liability",
    body: "To the fullest extent permitted by law, Agently is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost revenue, lost data, campaign underperformance, user disputes, or third-party provider failures."
  },
  {
    title: "15. Updates And Contact",
    body: "We may update these terms as Agently evolves and adds new features. Continued use after updates means you accept the updated terms. Questions can be sent to support@agently.in."
  }
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-4xl">
        <HomeLogo className="mb-8" />
        <Card className="space-y-7 p-6 sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agently</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">Terms of Service</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: May 12, 2026</p>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            These terms govern use of Agently by creators, freelancers, brands, and administrators. They are written for beta readiness and should be reviewed by legal counsel before broad commercial launch.
          </p>

          <div className="space-y-4">
            {terms.map((term) => (
              <section key={term.title} className="rounded-md border bg-background/70 p-4 dark:border-white/10">
                <h2 className="font-semibold">{term.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{term.body}</p>
              </section>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/data-deletion">Data deletion</Link>
            <Link href="/">Back to Agently</Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
