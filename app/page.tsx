import Link from "next/link";
import { ArrowRight, ClipboardCheck, Handshake, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

const highlights = [
  {
    title: "For creators",
    copy: "Understand sponsorship value, find brands that fit your audience, negotiate better terms, and avoid risky contracts.",
    icon: ClipboardCheck
  },
  {
    title: "For brands",
    copy: "Find creators and creative freelancers around campaign goals, audience fit, city relevance, category, language, and budget.",
    icon: Sparkles
  },
  {
    title: "For freelancers",
    copy: "Showcase editing, shooting, design, and production services with portfolio links, hourly rates, and project-based pricing.",
    icon: ShieldCheck
  }
];

const operatingSystem = [
  "AI matching for Bangalore and India-first campaigns",
  "Creator valuation and rate bands in INR",
  "Contract risk scans before work begins",
  "Protected payment workflow from funding to release"
];

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Handshake className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold">Agently</p>
            <p className="text-xs text-muted-foreground">Creator talent agency OS</p>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/app">
              <Button variant="secondary">Go to app</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="secondary">Login</Button>
            </Link>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center">
          <Badge tone="green" className="mb-5 w-fit">Bangalore and India first</Badge>
          <h1 className="max-w-4xl text-5xl font-bold tracking-normal text-foreground">
            A talent marketplace with the workflow of a digital agency.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Agently connects creators, brands, and creative freelancers, then keeps the important work in one place: matching, pricing, contracts, payment status, deliverables, and negotiation support for the talent side.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup">
              <Button className="h-11 px-5">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={user ? "/app" : "/dashboard"}>
              <Button className="h-11 px-5" variant="secondary">{user ? "Go to your workspace" : "View prototype dashboard"}</Button>
            </Link>
          </div>
        </div>

        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <CardTitle>Who Agently is for</CardTitle>
            <Badge tone="blue">Marketplace OS</Badge>
          </div>
          <div className="space-y-4">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3 rounded-md border bg-white p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.copy}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Badge tone="green" className="mb-4 w-fit">Why it matters</Badge>
            <h2 className="text-3xl font-bold tracking-normal">Not just discovery. Deal workflow, protection, and better data.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {operatingSystem.map((item) => (
              <div key={item} className="rounded-md border bg-white p-4 text-sm font-medium leading-6">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
