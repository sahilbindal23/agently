import { MessageSquareText, Target, WandSparkles } from "lucide-react";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

export default async function FeedbackPage() {
  const user = await getCurrentUser();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Prototype learning loop"
        title="Share feedback"
        description="Capture structured tester notes after walking through Agently. This helps separate UI confusion, missing workflow pieces, and product trust questions."
      />

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>What To Comment On</CardTitle>
            <Badge tone="blue">{user?.role ?? "tester"}</Badge>
          </CardHeader>
          <div className="space-y-3">
            <Prompt icon={<Target className="h-5 w-5" />} title="Workflow clarity" copy="Could you understand what to do next without someone explaining it?" />
            <Prompt icon={<WandSparkles className="h-5 w-5" />} title="Trust and realism" copy="Did fit scores, rates, contract flags, and payment states feel believable enough for Bangalore/India?" />
            <Prompt icon={<MessageSquareText className="h-5 w-5" />} title="Missing moments" copy="What would make this feel more like a digital talent agency OS and less like a simple marketplace?" />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tester Feedback</CardTitle>
            <Badge tone="green">saved</Badge>
          </CardHeader>
          <FeedbackForm />
        </Card>
      </section>
    </AppShell>
  );
}

function Prompt({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return (
    <div className="rounded-md border bg-white p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}
