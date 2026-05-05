import { BriefcaseBusiness, FileText, HelpCircle, IndianRupee, LockKeyhole, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

const faqs = [
  {
    icon: <HelpCircle className="h-5 w-5" />,
    question: "What can I use Agently for?",
    answer: "Agently helps brands find creators and freelancers, send offers, manage campaign work, review contracts, track deliverables, and keep payments organized in one workflow."
  },
  {
    icon: <Users className="h-5 w-5" />,
    question: "What is the difference between a creator and a freelancer?",
    answer: "A creator posts content on their own social channels and brings audience reach. A freelancer creates the asset or service for the brand, such as editing, shooting, design, podcast production, or campaign production."
  },
  {
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    question: "How do brands send work through Agently?",
    answer: "Brands create campaign briefs, review recommended creators or freelancers, shortlist talent, and send offers or project requests with scope, amount, due date, usage terms, and approval expectations."
  },
  {
    icon: <IndianRupee className="h-5 w-5" />,
    question: "How should I use the rate estimate tools?",
    answer: "Use the rate tools as a starting point before accepting or countering an offer. They help you understand whether the amount fits the platform, deliverables, usage rights, revisions, timeline, and audience or service value."
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    question: "What does protected payout mean?",
    answer: "Protected payout is Agently's workflow for making sure creators and freelancers are not left unpaid after completing approved work. The goal is for brands to fund the work first, talent to submit deliverables, and payout to be released once the agreed work is approved."
  },
  {
    icon: <LockKeyhole className="h-5 w-5" />,
    question: "What if a brand backs out after I submit deliverables?",
    answer: "If the work was accepted, funded, and submitted through Agently, the platform can track the agreement, deliverable, approval status, and payment state in one place. If something goes wrong, use the dispute/report issue flow so the problem can be reviewed with the campaign context attached."
  },
  {
    icon: <FileText className="h-5 w-5" />,
    question: "Why should I scan a contract before accepting?",
    answer: "Contract scans help spot terms that can hurt creators and freelancers, such as delayed payment, unlimited usage, broad exclusivity, too many revisions, unclear cancellation terms, whitelisting, or unpaid licensing rights."
  },
  {
    icon: <MessageSquareText className="h-5 w-5" />,
    question: "Can I ask questions before accepting an offer?",
    answer: "Yes. Use messages to clarify scope, usage, payment timing, revisions, deadline, or approval terms before accepting. Keeping the conversation inside Agently helps preserve context for the workflow."
  }
];

export default async function FeedbackPage() {
  const user = await getCurrentUser();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Product guide"
        title="FAQ"
        description="Answers to common questions from brands, creators, and freelancers using Agently."
      />

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <Badge tone="blue">{user?.role ?? "guest"}</Badge>
          </CardHeader>
          <div className="space-y-3">
            <GuidePoint title="Brands" copy="Create a campaign brief, review recommended talent, shortlist the right people, and send a clear offer." />
            <GuidePoint title="Creators" copy="Review incoming offers, scan terms, negotiate if needed, wait for funding, then submit deliverables." />
            <GuidePoint title="Freelancers" copy="Show your services and portfolio, receive project requests, clarify scope, and manage protected payout workflows." />
          </div>
        </Card>

        <div className="grid gap-3">
          {faqs.map((faq) => (
            <Card className="p-4" key={faq.question}>
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {faq.icon}
                </div>
                <div>
                  <p className="font-semibold">{faq.question}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function GuidePoint({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-md border bg-white p-4 dark:border-white/10 dark:bg-card">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  );
}
