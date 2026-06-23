import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ClipboardCheck,
  FileCheck2,
  IndianRupee,
  Lock,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet
} from "lucide-react";
import { ContourArt } from "@/components/marketing/contour-art";
import { FloatingArt } from "@/components/motion/floating-art";
import { PressLink } from "@/components/motion/press-link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { getCurrentUser } from "@/lib/auth/session";

// Standalone dark marketing canvas, matching /early-access: every colour is
// explicit (white / slate / teal hex) so the page renders identically in the
// light and dark app themes. Motion is layered via the components/motion
// primitives — staggered hero entrance, scroll-reveal sections, pressable CTAs,
// ambient floating artwork — all reduced-motion-safe via the root MotionProvider.

const highlights = [
  {
    title: "For creators",
    copy: "Understand sponsorship value, find brands that fit your audience, negotiate better terms, and avoid risky contracts.",
    icon: Sparkles
  },
  {
    title: "For brands",
    copy: "Find creators and creative freelancers around campaign goals, audience fit, city relevance, category, language, and budget.",
    icon: Target
  },
  {
    title: "For freelancers",
    copy: "Showcase editing, shooting, design, and production services with portfolio links, hourly rates, and project-based pricing.",
    icon: ClipboardCheck
  }
];

const operatingSystem = [
  {
    title: "AI matching",
    copy: "India-first campaign matching across niche, city, language, audience, and budget.",
    icon: Target
  },
  {
    title: "INR rate bands",
    copy: "Creator valuation and pricing guidance grounded in the Indian market.",
    icon: IndianRupee
  },
  {
    title: "Contract scans",
    copy: "Risky clauses — usage rights, exclusivity, hidden revisions — flagged before work begins.",
    icon: FileCheck2
  },
  {
    title: "Protected payments",
    copy: "Funds secured up front and released against approved deliverables.",
    icon: Wallet
  }
];

const useCases = [
  {
    title: "Creators grow sponsor income",
    copy: "Use pricing guidance, offer negotiation, profile verification, and contract checks to avoid undercharging or giving away broad usage rights."
  },
  {
    title: "Brands build better campaigns",
    copy: "Create briefs, compare creators and freelancers, shortlist talent, message profiles, track sent offers, and review deliverables from one workspace."
  },
  {
    title: "Freelancers win production work",
    copy: "List editing, shooting, design, and production services with portfolio proof, service rates, availability, and protected project payouts."
  }
];

// The headline promise. Wording is escrow-truthful: the money is genuinely
// secured with Agently before work starts, so "guaranteed" is accurate without
// claiming insurance or covering brand defaults from our own funds.
const protectionSteps = [
  {
    title: "Brand funds upfront",
    copy: "The full fee is secured with Agently before you create a thing — so a brand can't ghost you after delivery.",
    icon: Lock
  },
  {
    title: "You create",
    copy: "Do the work knowing the money is already set aside for you. No upfront risk, no unpaid spec work.",
    icon: Sparkles
  },
  {
    title: "Paid on approval",
    copy: "Deliverable approved, payout released. You never chase an invoice or wait on a brand's accounts team.",
    icon: Wallet
  }
];

const navLinks = [
  { href: "#protection", label: "Protection" },
  { href: "#who", label: "Who it's for" },
  { href: "#use-cases", label: "Use cases" }
];

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b15] text-white">
      {/* Ambient glows */}
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
        <PressLink
          href={user ? "/app" : "/login"}
          className="inline-flex h-9 items-center rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 px-5 text-sm font-semibold text-[#070b15]"
        >
          {user ? "Go to app" : "Sign in"}
        </PressLink>
      </header>

      {/* HERO */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pt-16">
        <Stagger stagger={0.09} amount={0.1}>
          <StaggerItem>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
              <Sparkles className="h-3.5 w-3.5" />
              Bangalore &amp; India first
            </p>
          </StaggerItem>
          <StaggerItem>
            <h1 className="max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              A talent marketplace with{" "}
              <span className="bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                the workflow of a digital agency.
              </span>
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
              Agently connects creators, brands, and creative freelancers, then keeps the important work
              in one place: matching, pricing, contracts, payment status, deliverables, and negotiation
              support for the talent side.
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {user ? (
                <PressLink
                  href="/app"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 px-7 text-base font-semibold text-[#070b15] shadow-lg shadow-teal-500/20"
                >
                  Go to your workspace
                  <ArrowRight className="h-5 w-5" />
                </PressLink>
              ) : (
                <>
                  <PressLink
                    href="/early-access"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 px-7 text-base font-semibold text-[#070b15] shadow-lg shadow-teal-500/20"
                  >
                    Request early access
                    <ArrowRight className="h-5 w-5" />
                  </PressLink>
                  <PressLink
                    href="/signup"
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-7 text-base font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
                  >
                    Create account
                  </PressLink>
                </>
              )}
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {[
                { icon: ShieldCheck, label: "Guaranteed payouts" },
                { icon: FileCheck2, label: "Contract risk scans" },
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
          </StaggerItem>
        </Stagger>

        {/* Art + caption card */}
        <div className="relative hidden lg:block">
          <FloatingArt className="mx-auto w-full max-w-[34rem]">
            <ContourArt id="home-rings" className="w-full" />
          </FloatingArt>
          <Reveal delay={0.5} className="absolute bottom-10 left-1/2 w-72 -translate-x-1/2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-teal-400 to-emerald-500 text-[#070b15]">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <p className="font-bold text-white">The platform.</p>
              </div>
              <p className="mt-2.5 text-sm leading-6 text-slate-300">
                Not just discovery — deal workflow, protection, and better data for creators, brands, and freelancers.
              </p>
              <a href="#who" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-300 hover:text-teal-200">
                See who it&apos;s for
                <ArrowDown className="h-3.5 w-3.5" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PAYMENT PROTECTION — the headline promise, first thing after the hero */}
      <section id="protection" className="relative scroll-mt-10 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-teal-400/20 bg-gradient-to-br from-teal-500/[0.10] via-emerald-500/[0.05] to-transparent p-8 sm:p-12">
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
              <div className="relative grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
                <div>
                  <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Payment protection
                  </p>
                  <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
                    Get paid for approved work.{" "}
                    <span className="bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                      Guaranteed.
                    </span>
                  </h2>
                  <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
                    Brands fund the deal into Agently <span className="font-semibold text-white">before you create a thing</span>.
                    The money is secured upfront — so a brand can&apos;t disappear after you&apos;ve delivered, and
                    you never chase an invoice again.
                  </p>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
                    Deliver the work, get it approved, get paid. That&apos;s the whole promise — and it&apos;s why
                    creators can say yes to a brand they&apos;ve never worked with.
                  </p>
                </div>

                <Stagger className="space-y-3" stagger={0.09}>
                  {protectionSteps.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <StaggerItem
                        key={step.title}
                        className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-[#070b15] shadow-lg shadow-teal-500/20">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            <span className="mr-2 text-teal-300">{i + 1}.</span>
                            {step.title}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-400">{step.copy}</p>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </Stagger>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who" className="relative scroll-mt-10 border-t border-white/5 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Who Agently is for</p>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Three sides, one workspace</h2>
          </Reveal>
          <Stagger className="grid gap-4 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <StaggerItem
                  key={item.title}
                  className="group h-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-teal-400/40 hover:bg-white/[0.07]"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-[#070b15] shadow-lg shadow-teal-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.copy}</p>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* WHY IT MATTERS */}
      <section id="why" className="relative scroll-mt-10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Why it matters</p>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Not just discovery. Deal workflow, protection, and better data.
            </h2>
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.07}>
            {operatingSystem.map((item) => {
              const Icon = item.icon;
              return (
                <StaggerItem
                  key={item.title}
                  className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-teal-400/30"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-teal-400/40 bg-teal-400/10 text-teal-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.copy}</p>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* USE CASES */}
      <section id="use-cases" className="relative scroll-mt-10 border-t border-white/5 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">Use cases</p>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Built for the work around brand deals, not just browsing profiles.
            </h2>
          </Reveal>
          <Stagger className="grid gap-4 md:grid-cols-3">
            {useCases.map((item) => (
              <StaggerItem
                key={item.title}
                className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-teal-400/30"
              >
                <p className="text-lg font-semibold text-white">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">{item.copy}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-7xl" y={20}>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 px-6 py-14 text-center sm:px-12">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
              <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white blur-3xl" />
              <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-cyan-300 blur-3xl" />
            </div>
            <h2 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Be there before everyone else.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/90">
              Agently is onboarding founding creators and brands in small batches. Request your spot.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-4">
              <PressLink
                href="/early-access"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#070b15] px-7 text-base font-semibold text-white"
              >
                For creators
                <ArrowRight className="h-5 w-5" />
              </PressLink>
              <PressLink
                href="/early-access/brands"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 px-7 text-base font-semibold text-white transition hover:bg-white/10"
              >
                For brands
                <ArrowRight className="h-5 w-5" />
              </PressLink>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="relative border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Agently helps creators, freelancers, and brands manage campaign workflow with more trust.</p>
          <div className="flex flex-wrap gap-4 font-semibold text-slate-200">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/data-deletion" className="hover:text-white">Data deletion</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
