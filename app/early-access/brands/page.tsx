import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  FileCheck2,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet
} from "lucide-react";
import { ContourArt } from "@/components/marketing/contour-art";
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

// Standalone dark marketing canvas — explicit colours, theme-independent.
// Mirrors /early-access so the cross-linked pages feel like one campaign.

const about = [
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

const navLinks = [
  { href: "#about", label: "About" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" }
];

export default function BrandEarlyAccessPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b15] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-teal-500/15 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* NAV */}
      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 text-[#070b15]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">Agently</p>
            <p className="text-xs text-slate-400">Talent agency OS</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 px-5 text-sm font-semibold text-[#070b15] transition hover:opacity-90"
        >
          Sign in
        </Link>
      </header>

      {/* HERO — Welcome */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-16">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
            <Sparkles className="h-3.5 w-3.5" />
            For brands · Limited cohort
          </p>
          <h1 className="text-7xl font-extrabold leading-none tracking-tight text-white sm:text-8xl">
            Welcome.
          </h1>
          <p className="mt-5 max-w-xl bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300 bg-clip-text text-2xl font-bold leading-snug text-transparent sm:text-3xl">
            Creator campaigns with less guesswork and less risk.
          </p>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
            Get matched to vetted creators on real fit, scan contracts before you sign, and run
            protected payments — all in one workspace. We&apos;re opening to a small group of brands
            before public launch.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#request"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 px-7 text-base font-semibold text-[#070b15] shadow-lg shadow-teal-500/20 transition hover:opacity-90"
            >
              Request early access
              <ArrowRight className="h-5 w-5" />
            </a>
            <Link
              href="/early-access"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-7 text-base font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
            >
              I&apos;m a creator
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2.5">
            {[
              { icon: Target, label: "Matched on fit" },
              { icon: ShieldCheck, label: "Protected payments" },
              { icon: BadgeCheck, label: "Free during beta" }
            ].map((chip) => {
              const Icon = chip.icon;
              return (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 backdrop-blur"
                >
                  <Icon className="h-4 w-4 text-teal-300" />
                  {chip.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Art + caption card */}
        <div className="relative hidden lg:block">
          <ContourArt id="hero-rings" className="mx-auto w-full max-w-[34rem]" />
          <div className="absolute bottom-10 left-1/2 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-teal-400 to-emerald-500 text-[#070b15]">
                <BarChart3 className="h-4 w-4" />
              </div>
              <p className="font-bold text-white">The platform.</p>
            </div>
            <p className="mt-2.5 text-sm leading-6 text-slate-300">
              One workspace for matching, briefs, contracts, and protected payouts — built India-first.
            </p>
            <a href="#about" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-300 hover:text-teal-200">
              About Agently
              <ArrowDown className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ABOUT THE PLATFORM */}
      <section id="about" className="relative scroll-mt-10 border-t border-white/5 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">About the platform</p>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">What is Agently?</h2>
            <p className="mt-4 text-base leading-7 text-slate-400">
              The deal workflow of a professional talent agency — discovery, negotiation, contracts,
              and payments — in one workspace. Here&apos;s what that means for your campaigns.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {about.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:-translate-y-1 hover:border-teal-400/40 hover:bg-white/[0.07]"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-[#070b15] shadow-lg shadow-teal-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold leading-tight text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.copy}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative scroll-mt-10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">How it works</p>
            <h2 className="text-4xl font-bold tracking-tight text-white">From brief to live campaign in three steps</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-teal-400/40 bg-teal-400/10 text-lg font-bold text-teal-300">
                  {i + 1}
                </div>
                <p className="text-lg font-semibold text-white">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REQUEST FORM */}
      <section id="request" className="relative scroll-mt-10 border-t border-white/5 bg-white/[0.02] py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative hidden lg:block">
            <ContourArt id="form-rings" className="mx-auto w-full max-w-md opacity-70" />
          </div>
          <div className="mx-auto w-full max-w-xl">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-teal-500/10">
              <div className="border-b bg-gradient-to-br from-teal-500 to-emerald-600 px-6 py-5 text-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <p className="text-lg font-bold">Request brand access</p>
                </div>
                <p className="mt-1 text-sm text-white/85">Limited spots in this cohort. Takes about a minute.</p>
              </div>
              <div className="p-6">
                <BrandEarlyAccessForm />
                <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  No spam. We only email you about your invite.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative scroll-mt-10 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Good to know</p>
            <h2 className="text-4xl font-bold tracking-tight text-white">Quick questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="flex items-start gap-2 font-semibold text-white">
                  <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                  {faq.q}
                </p>
                <p className="mt-2 pl-6 text-sm leading-6 text-slate-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 px-6 py-14 text-center sm:px-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-cyan-300 blur-3xl" />
          </div>
          <h2 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Run your first campaign with talent ready to match.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/90">
            Join the first brands on Agently and run creator campaigns with protection built in.
          </p>
          <a
            href="#request"
            className="relative mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#070b15] px-7 text-base font-semibold text-white transition hover:bg-[#070b15]/85"
          >
            Request early access
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      <footer className="relative border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Agently — a creator talent marketplace with the workflow of a digital agency.</p>
          <div className="flex flex-wrap gap-4 font-semibold text-slate-200">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
