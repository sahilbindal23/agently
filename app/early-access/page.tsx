import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, IndianRupee, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { HomeLogo } from "@/components/layout/home-logo";
import { EarlyAccessForm } from "@/components/waitlist/early-access-form";

export const metadata: Metadata = {
  title: "Early access for creators",
  description:
    "Agently is onboarding founding creators in India. Request early access to get matched with brands, price your work with INR rate bands, scan contracts, and get paid through protected payments.",
  alternates: { canonical: "/early-access" },
  openGraph: {
    title: "Agently — early access for founding creators",
    description:
      "Join the first wave of creators on Agently. Brand matching, INR pricing guidance, contract scans, and protected payouts.",
    url: "/early-access"
  }
};

const perks = [
  {
    title: "Founding-creator pricing",
    copy: "0% platform fee on your first deals. Lock in early-member terms before public pricing goes live.",
    icon: IndianRupee
  },
  {
    title: "Get matched, not lost in a search",
    copy: "Tell us your niche and audience once. Brands are matched to you on fit — city, category, language, and budget.",
    icon: Sparkles
  },
  {
    title: "Protected from brief to payout",
    copy: "Contract risk scans before you sign, and protected payments so you're never chasing money after delivering.",
    icon: ShieldCheck
  }
];

export default function EarlyAccessPage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <HomeLogo />
        <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
          Already invited? Log in
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-12">
        <div className="flex flex-col justify-center">
          <Badge tone="green" className="mb-5 flex w-fit items-center gap-1.5">
            <BadgeCheck className="h-3.5 w-3.5" />
            Founding creators · India first
          </Badge>
          <h1 className="max-w-2xl text-5xl font-bold tracking-normal text-foreground">
            Be one of the first creators on Agently.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            We&apos;re opening Agently to a small group of founding creators before the public launch.
            Get matched with brands that fit your audience, price your work with real INR rate bands,
            avoid risky contracts, and get paid through protected payments.
          </p>
          <div className="mt-8 grid gap-3">
            {perks.map((perk) => {
              const Icon = perk.icon;
              return (
                <div key={perk.title} className="flex gap-3 rounded-md border bg-white p-4 dark:border-white/8 dark:bg-card">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{perk.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{perk.copy}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Card className="p-6 lg:sticky lg:top-8 lg:self-start">
          <div className="mb-1 flex items-center justify-between gap-3">
            <CardTitle>Request early access</CardTitle>
            <Badge tone="blue">Free</Badge>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            Takes a minute. We invite founding creators in small batches and email you when it&apos;s your turn.
          </p>
          <EarlyAccessForm />
        </Card>
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
