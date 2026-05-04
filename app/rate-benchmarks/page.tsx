import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Calculator, Database, IndianRupee, MapPin, Signal } from "lucide-react";
import { RateBenchmarkForm } from "@/components/benchmarks/rate-benchmark-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { getRateBenchmarks } from "@/lib/benchmarks/rates";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function RateBenchmarksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/dashboard");

  if (user.role !== "admin") {
    return (
      <AppShell>
        <PageHeader eyebrow="Engine calibration" title="Rate Benchmarks" description="This page is reserved for Agently admins." />
        <Card>
          <p className="font-semibold">Admin access required</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Benchmarks affect pricing calibration, so they are managed internally.</p>
        </Card>
      </AppShell>
    );
  }

  const benchmarks = await getRateBenchmarks(admin, 300);
  const avgConfidence = benchmarks.length
    ? benchmarks.reduce((sum, item) => sum + Number(item.confidence_score ?? 0), 0) / benchmarks.length
    : 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Engine calibration"
        title="Rate Benchmarks"
        description="Store real-world creator and freelancer rate findings so Agently can compare rules-based estimates against Bangalore/India market evidence."
      />

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <Metric icon={<Database className="h-4 w-4" />} label="Benchmarks" value={benchmarks.length} />
        <Metric icon={<Signal className="h-4 w-4" />} label="Avg confidence" value={`${Math.round(avgConfidence * 100)}%`} />
        <Metric icon={<MapPin className="h-4 w-4" />} label="Markets" value={new Set(benchmarks.map((item) => item.city)).size} />
        <Metric icon={<IndianRupee className="h-4 w-4" />} label="Median base" value={medianBase(benchmarks)} />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Add Benchmark</CardTitle>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Use this after creator/freelancer interviews, market research, or real closed Agently deals.</p>
            </div>
            <Badge tone="green">training data</Badge>
          </CardHeader>
          <RateBenchmarkForm />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calibration Rules</CardTitle>
            <Badge tone="blue">v1</Badge>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Rule title="Use ranges, not exact rates" copy="Capture low/base/high because creator rates vary with terms, brand prestige, timelines, and usage." />
            <Rule title="Separate proof from opinion" copy="Higher confidence should come from closed deals, invoices, or repeated creator interviews." />
            <Rule title="Capture deliverable context" copy="A Reel, a Reel plus stories, and whitelisted paid usage are different products." />
            <Rule title="Keep Bangalore visible" copy="City-specific evidence is important while Agently launches in Bengaluru first." />
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Benchmark Dataset</CardTitle>
          <Badge tone="blue">{benchmarks.length}</Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Segment</Th>
                <Th>Audience band</Th>
                <Th>Rate band</Th>
                <Th>Source</Th>
                <Th>Confidence</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((benchmark) => (
                <tr key={benchmark.id}>
                  <Td className="min-w-64">
                    <p className="font-medium">{benchmark.platform} / {benchmark.deliverable_type}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{benchmark.niche} - {benchmark.city}, {benchmark.market}</p>
                  </Td>
                  <Td>
                    <p className="text-sm">Followers: {rangeText(benchmark.follower_min, benchmark.follower_max)}</p>
                    <p className="text-sm">Views: {rangeText(benchmark.avg_view_min, benchmark.avg_view_max)}</p>
                  </Td>
                  <Td className="min-w-52">
                    <p className="text-sm">Low {formatCurrency(benchmark.low_cents, "inr")}</p>
                    <p className="text-sm font-semibold">Base {formatCurrency(benchmark.base_cents, "inr")}</p>
                    <p className="text-sm">High {formatCurrency(benchmark.high_cents, "inr")}</p>
                  </Td>
                  <Td>
                    <p className="text-sm">{benchmark.source_type}</p>
                    <p className="text-xs text-muted-foreground">{benchmark.source_label || "No label"}</p>
                  </Td>
                  <Td><Badge tone={Number(benchmark.confidence_score) >= 0.75 ? "green" : Number(benchmark.confidence_score) >= 0.5 ? "amber" : "neutral"}>{Math.round(Number(benchmark.confidence_score) * 100)}%</Badge></Td>
                  <Td className="min-w-72 text-sm leading-5 text-muted-foreground">{benchmark.notes || "-"}</Td>
                </tr>
              ))}
              {!benchmarks.length ? (
                <tr>
                  <Td colSpan={6}>
                    <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">No benchmarks yet. Add your first creator/freelancer rate finding above.</p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-normal">{value}</p>
    </Card>
  );
}

function Rule({ copy, title }: { copy: string; title: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <p className="font-semibold">{title}</p>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}

function rangeText(min: number | null, max: number | null) {
  if (min && max) return `${min.toLocaleString("en-IN")} - ${max.toLocaleString("en-IN")}`;
  if (min) return `${min.toLocaleString("en-IN")}+`;
  if (max) return `up to ${max.toLocaleString("en-IN")}`;
  return "any";
}

function medianBase(benchmarks: Awaited<ReturnType<typeof getRateBenchmarks>>) {
  if (!benchmarks.length) return "-";
  const values = benchmarks.map((item) => item.base_cents).sort((a, b) => a - b);
  return formatCurrency(values[Math.floor(values.length / 2)], "inr");
}
