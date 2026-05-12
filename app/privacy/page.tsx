import type { Metadata } from "next";
import Link from "next/link";
import { HomeLogo } from "@/components/layout/home-logo";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy | Agently",
  description: "How Agently collects, uses, and protects account, profile, campaign, social, contract, and payment workflow data."
};

const sections = [
  {
    title: "Information We Collect",
    body: [
      "Account information such as name, email address, role, login details, and support requests.",
      "Profile information for creators, freelancers, and brands, including bio, niche, location, portfolio links, service rates, social handles, audience and campaign preferences, and profile images.",
      "Workflow information such as campaign briefs, offers, messages, contracts or contract text, deliverables, disputes, payment status, payout readiness, and platform activity.",
      "Connected social account information, when you choose to connect an account, including permitted profile and performance metrics from providers such as YouTube, Instagram, Facebook, or third-party data partners.",
      "Technical information such as device, browser, IP address, usage logs, error reports, and security events."
    ]
  },
  {
    title: "How We Use Information",
    body: [
      "To create and manage accounts, profiles, campaign discovery, messaging, offers, deliverables, contract review, and payment workflow tracking.",
      "To help creators and freelancers understand their positioning, pricing, profile readiness, and campaign fit.",
      "To help brands discover relevant creators and freelancers, manage shortlists, send offers, and track campaign workflow.",
      "To verify connected account signals, reduce fraud, protect account security, improve recommendations, and troubleshoot issues.",
      "To send transactional emails, notifications, onboarding guidance, and service updates."
    ]
  },
  {
    title: "AI-Assisted Features",
    body: [
      "Agently may use AI systems to assist with valuation estimates, campaign matching, profile audits, contract risk summaries, negotiation support, and workflow recommendations.",
      "AI outputs are decision-support tools and may be incomplete or inaccurate. Users should review important commercial, legal, or payment decisions before acting."
    ]
  },
  {
    title: "Payments, Contracts, And Service Providers",
    body: [
      "Agently may use providers such as Supabase, Vercel, Resend, Sentry, OpenAI, Razorpay, Stripe, Phyllo, Google, Meta, and similar vendors to operate the platform.",
      "Payment providers process payment information directly. Agently stores payment workflow references, statuses, amounts, and payout readiness details, not full card or bank credentials.",
      "Contract and deliverable files may be stored in private storage and served through time-limited access links where supported."
    ]
  },
  {
    title: "Sharing Information",
    body: [
      "We do not sell personal information.",
      "We may share relevant profile, campaign, offer, message, contract, deliverable, and payment workflow information with the creator, freelancer, brand, or administrator involved in that workflow.",
      "We may share information with service providers, professional advisors, authorities, or platform partners when needed to operate Agently, comply with law, prevent abuse, or resolve disputes."
    ]
  },
  {
    title: "Retention And Deletion",
    body: [
      "We keep information for as long as needed to provide Agently, maintain records, resolve disputes, improve safety, comply with legal obligations, and support active workflows.",
      "You can request deletion of your account or connected social data through the data deletion instructions linked below. Some records may be retained where legally required or necessary for payment, security, fraud prevention, or dispute resolution."
    ]
  },
  {
    title: "Your Choices",
    body: [
      "You can update profile information, disconnect social accounts, manage notification preferences, or request account deletion.",
      "If you connected a social provider, you may also revoke Agently from that provider's account settings."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-4xl">
        <HomeLogo className="mb-8" />
        <Card className="space-y-7 p-6 sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agently</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: May 12, 2026</p>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            Agently is a creator, freelancer, and brand workflow platform built for discovery, offers, contract review, protected payout workflows, and campaign operations. This policy explains what data we collect, why we use it, and the choices users have.
          </p>

          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                {section.body.map((item) => (
                  <li key={item} className="rounded-md border bg-background/70 p-3 dark:border-white/10">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="space-y-2 rounded-md border bg-muted/40 p-4 dark:border-white/10">
            <h2 className="text-lg font-semibold">Contact</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              For privacy questions, corrections, or deletion requests, email{" "}
              <a className="font-semibold text-primary" href="mailto:support@agently.in">support@agently.in</a>.
            </p>
          </section>

          <div className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
            <Link href="/terms">Terms of Service</Link>
            <Link href="/data-deletion">Data deletion</Link>
            <Link href="/">Back to Agently</Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
