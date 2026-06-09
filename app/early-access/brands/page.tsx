import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  FileCheck2,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Wallet
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HomeLogo } from "@/components/layout/home-logo";
import { BrandEarlyAccessForm } from "@/components/waitlist/brand-early-access-form";

export const metadata: Metadata = {
  title: "Early access for brands",
  description:
    "Run creator campaigns in India with less risk. Agently matches you to vetted creators on fit, scans contracts, and protects payments from funding to release. Request early access.",
  alternates: { canonical: "/early-access/brands" },
  openGraph: {
    title: "Agently — early access for brands",
    description:
      "Get matched to vetted creators on fit, scan contracts, and run protected payments. Request early access.",
    url: "/early-access/brands"
  }
};

const benefits = [
  {
    title: "Matched on fit, not follower count",
    copy: "Brief your goal once. Agently ranks creators on category, city, language, audience, and budget — not vanity metrics.",
    icon: Target
  },
  {
    title: "Contracts scanned before you sign",
    copy: "Every agreement is checked for risky clauses, so usage rights, exclusivity, and deliverables are clear up front.",
    icon: FileCheck2
  },
  {
    title: "Pay only for work that ships",
    copy: "Funds are held and released against approved deliverables — protected payments, no upfront risk.",
    icon: Wallet
  },
  {
    title: "One workspace, end to end",
    copy: "Discovery, offers, contracts, deliverables, and payouts in one place — the workflow of an agency without the agency fee.",
    icon: ShieldCheck
  }
];

const steps = [
  {
    title: "Request your spot",
    copy: "Tell us about your brand and what you want to run. Takes about a minute."
  },
  {
    title: "We onboard you with a roster ready",
    copy: "Brands are invited alongside a vetted set of creators, so your first campaign has talent to match on day one."
  },
  {
    title: "Launch a protected campaign",
    copy: "Match, brief, sign, and pay — all tracked in one workspace, with funds released only on approved work."
  }
];

const faqs = [
  {
    q: "What does it cost?",
    a: "Early access is free. You only pay for the campaigns you run, with no agency retainer or platform lock-in during beta."
  },
  {
    q: "Do you have creators in my category?",
    a: "We onboard creators in batches across niches and cities. Tell us your industry on the form and we'll prioritise matching talent for you."
  },
  {
    q: "How are payments protected?",
    a: "Campaign funds are secured and only released against deliverables you approve — so you never pay for work that doesn't ship."
  }
];

export default function BrandEarlyAccessPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-[-10rem] top-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <HomeLogo />
        <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
          Already invited? Log in
        </Link>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-8 lg:pb-20 lg:pt-10">
        <div className="flex flex-col justify-center">
          <Badge tone="green" className="mb-5 flex w-fit items-center gap-1.5 px-3 py-1.5 text-[13px]">
            <Star className="h-3.5 w-3.5 fill-current" />
            For brands · India-first · Limited cohort
          </Badge>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Creator campaigns with{" "}
            <span className="bg-gradient-to-r from-primary via-teal-500 to-emerald-500 bg-clip-text text-transparent">
              less guesswork and less risk.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Get matched to vetted creators on real fit, scan contracts before you sign, and run protected
            payments — all in one workspace. Join the first brands on Agently before public launch.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {[
              { icon: Target, label: "Matched on fit" },
              { icon: ShieldCheck, label: "Protected payments" },
              { icon: BadgeCheck, label: "Free during beta" }
            ].map((chip) => {
              const Icon = chip.icon;
              return (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-white/70 px-3 py-1.5 text-sm font-medium text-foreground backdrop-blur dark:bg-card/70"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {chip.label}
                </span>
              );
            })}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="group rounded-xl border bg-white/80 p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg dark:bg-card/80"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-teal-600 text-primary-foreground shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold leading-tight">{b.title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{b.copy}</p>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Are you a creator?{" "}
            <Link href="/early-access" className="font-semibold text-primary hover:underline">
              Request creator access →
            </Link>
          </p>
        </div>

        {/* FORM CARD */}
        <div id="request" className="scroll-mt-8 lg:sticky lg:top-8 lg:self-start">
          <div className="overflow-hidden rounded-2xl border bg-white shadow-xl shadow-primary/5 dark:bg-card">
            <div className="border-b bg-gradient-to-br from-primary to-teal-700 px-6 py-5 text-primary-foreground">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <p className="text-lg font-bold">Request brand access</p>
              </div>
              <p className="mt-1 text-sm text-primary-foreground/85">
                Limited spots in this cohort. Takes about a minute.
              </p>
            </div>
            <div className="p-6">
              <BrandEarlyAccessForm />
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                No spam. We only email you about your invite.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y bg-white/50 py-16 backdrop-blur dark:bg-card/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <Badge tone="blue" className="mb-3">How it works</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">From brief to live campaign in three steps</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="relative rounded-xl border bg-white p-6 dark:bg-card">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {i + 1}
                </div>
                <p className="text-lg font-semibold">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <Badge tone="green" className="mb-3">Good to know</Badge>
          <h2 className="text-3xl font-bold tracking-tight">Quick questions</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl border bg-white p-5 dark:bg-card">
              <p className="flex items-start gap-2 font-semibold">
                <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {faq.q}
              </p>
              <p className="mt-2 pl-6 text-sm leading-6 text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-teal-700 px-6 py-12 text-center text-primary-foreground sm:px-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white blur-3xl" />
          </div>
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Run your first campaign with talent ready to match.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/90">
            Join the first brands on Agently and run creator campaigns with protection built in.
          </p>
          <Link
            href="#request"
            className="relative mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-base font-semibold text-primary shadow-lg transition hover:bg-white/90"
          >
            Request early access
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Agently — a creator talent marketplace with the workflow of a digital agency.</p>
          <div className="flex flex-wrap gap-4 font-semibold text-foreground">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
