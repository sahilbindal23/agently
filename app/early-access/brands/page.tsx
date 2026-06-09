import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileCheck2, ShieldCheck, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
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

const perks = [
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
    title: "Protected payments",
    copy: "Funds are held and released against approved deliverables — you pay for work that actually ships.",
    icon: ShieldCheck
  }
];

export default function BrandEarlyAccessPage() {
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
            For brands · India first
          </Badge>
          <h1 className="max-w-2xl text-5xl font-bold tracking-normal text-foreground">
            Run creator campaigns with less guesswork and less risk.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            We&apos;re opening Agently to a small group of brands before the public launch. Get matched
            to vetted creators on real fit, scan contracts before you sign, and run protected payments —
            all in one workspace.
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
          <p className="mt-6 text-sm text-muted-foreground">
            Are you a creator?{" "}
            <Link href="/early-access" className="font-semibold text-primary hover:underline">
              Request creator access →
            </Link>
          </p>
        </div>

        <Card className="p-6 lg:sticky lg:top-8 lg:self-start">
          <div className="mb-1 flex items-center justify-between gap-3">
            <CardTitle>Request early access</CardTitle>
            <Badge tone="blue">Free</Badge>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            Takes a minute. We invite brands in small batches and email you when it&apos;s your turn.
          </p>
          <BrandEarlyAccessForm />
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
