import { CheckCircle2, MessageSquareWarning, MousePointer2, Route, Sparkles, Target, Workflow } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { WalkthroughLaunchButton } from "@/components/onboarding/walkthrough-launch-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

const roleCopy = {
  brand: {
    title: "Brand campaign walkthrough",
    copy: "Move from brand profile to campaign brief, ranked talent, offers, insights, deliverables, and payment readiness."
  },
  creator: {
    title: "Creator talent walkthrough",
    copy: "See how creators tune profile data, receive offers, use talent-side AI, submit deliverables, and track payout status."
  },
  freelancer: {
    title: "Freelancer services walkthrough",
    copy: "See how production talent lists services, receives project offers, protects scope, submits work, and tracks payment."
  },
  admin: {
    title: "Agency operations walkthrough",
    copy: "See the full operating system across creator CRM, campaign matching, contract intelligence, deliverables, and payment control."
  }
};

export default async function DemoGuidePage() {
  const user = await getCurrentUser();
  const role = user?.role ?? "admin";
  const intro = roleCopy[role] ?? roleCopy.admin;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Interactive onboarding"
        title="Guided product walkthrough"
        description="Instead of a static help page, this launches an overlay that darkens the app, highlights important UI, and explains what each feature does in context."
        action={<WalkthroughLaunchButton label="Launch walkthrough" />}
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-primary/10" />
          <CardHeader>
            <div>
              <CardTitle>{intro.title}</CardTitle>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{intro.copy}</p>
            </div>
            <Badge tone="green">{role}</Badge>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Feature icon={<MousePointer2 className="h-5 w-5" />} title="Highlights real UI" copy="The walkthrough points at the actual sidebar and feature areas rather than explaining them abstractly." />
            <Feature icon={<Route className="h-5 w-5" />} title="Moves through routes" copy="Steps can take users from home to profile, campaigns, offers, insights, AI tools, and payments." />
            <Feature icon={<Target className="h-5 w-5" />} title="Role-aware" copy="Brands, creators, freelancers, and admins each see a different walkthrough path." />
            <Feature icon={<Workflow className="h-5 w-5" />} title="Prototype-ready" copy="This is the base for future first-login onboarding and activation checklists." />
          </div>
          <div className="mt-5">
            <WalkthroughLaunchButton label="Start the interactive tour" />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What It Shows</CardTitle>
            <Badge tone="blue">demo mode</Badge>
          </CardHeader>
          <div className="space-y-3">
            <WalkthroughStep title="Profile trust layer" copy="Users can edit public profile details, while Agently-owned scores stay protected." />
            <WalkthroughStep title="Matching and campaign engine" copy="Brands create campaign briefs before selecting creators or freelancers." />
            <WalkthroughStep title="Talent-side workflow" copy="Offers, AI support, deliverable submission, contract protection, and payout state are connected." />
            <WalkthroughStep title="Brand insight loop" copy="Brands can inspect campaign status, delivery progress, projected ROI signals, and payment release queue." />
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tester Script</CardTitle>
            <Badge tone="amber">send to friends</Badge>
          </CardHeader>
          <div className="grid gap-3">
            <TesterStep title="1. Create one account" copy="Choose creator, brand, or freelancer. Complete the intake and check whether the homepage makes sense for that role." />
            <TesterStep title="2. Explore the marketplace" copy="Search, filter, open full profiles, shortlist talent if you are a brand, and message another profile." />
            <TesterStep title="3. Run one workflow" copy="Brands should create a campaign and send an offer. Creators or freelancers should accept, decline, negotiate, or message back." />
            <TesterStep title="4. Check protection pages" copy="Open offers, contracts, payments, notifications, activity, and messages. Look for confusing copy, broken links, slow actions, or unreadable dark mode." />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What To Report</CardTitle>
            <Badge tone="blue">feedback quality</Badge>
          </CardHeader>
          <div className="space-y-3">
            <ReportPoint title="Workflow blockers" copy="Where did you get stuck, hesitate, or not know what to click next?" />
            <ReportPoint title="Trust gaps" copy="Did the matching, verification, protected payout, or contract scan feel believable enough to use?" />
            <ReportPoint title="Role confusion" copy="Was it obvious what creators post, what freelancers deliver, and what brands control?" />
            <ReportPoint title="Prototype bugs" copy="Share the page, role, action clicked, and what happened versus what you expected." />
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

function Feature({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return (
    <div className="rounded-md border bg-card p-4 dark:border-white/8">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}

function WalkthroughStep({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="flex gap-3 rounded-md border bg-card p-4 dark:border-white/8">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Sparkles className="h-4 w-4" />
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
      </div>
    </div>
  );
}

function TesterStep({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="flex gap-3 rounded-md border bg-card p-4 dark:border-white/8">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
      </div>
    </div>
  );
}

function ReportPoint({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="flex gap-3 rounded-md border bg-card p-4 dark:border-white/8">
      <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
      </div>
    </div>
  );
}
