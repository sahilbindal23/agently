import { HelpCircle, IndianRupee, LockKeyhole, MessageSquareText, ShieldCheck, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

const faqs = [
  {
    icon: <Sparkles className="h-5 w-5" />,
    question: "What is Agently?",
    answer: "Agently is a talent agency operating system for creators, freelancers, and brands. It helps talent get discovered, receive offers, review terms, negotiate better, submit work, and track protected payout workflows."
  },
  {
    icon: <Users className="h-5 w-5" />,
    question: "How is this different from an influencer marketplace?",
    answer: "A marketplace mostly lists profiles. Agently focuses on representation-style workflow: campaign matching, offer review, contract risk, payment state, deliverables, disputes, and engine-driven recommendations."
  },
  {
    icon: <HelpCircle className="h-5 w-5" />,
    question: "What is the difference between a creator and a freelancer?",
    answer: "Creators post to their own audience and bring distribution. Freelancers create the asset or service, such as editing, shooting, design, podcast production, or campaign production, without needing to publish it on their own socials."
  },
  {
    icon: <IndianRupee className="h-5 w-5" />,
    question: "How does Agently estimate rates?",
    answer: "The current engine uses India-first rules, profile metrics, deliverable scope, usage terms, and admin-managed rate benchmarks. Over time, closed deal outcomes and payment/delivery data should make the estimates more accurate."
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    question: "What does protected payout mean?",
    answer: "It means the workflow tracks whether a brand-funded payment is in place before final delivery, whether deliverables are submitted and approved, and whether payout is ready to release. This prototype does not present itself as regulated escrow."
  },
  {
    icon: <LockKeyhole className="h-5 w-5" />,
    question: "Why does Agently scan contracts?",
    answer: "Contracts can contain risky terms around payment delays, whitelisting, unpaid usage, exclusivity, revisions, cancellation, and licensing duration. The scan helps talent spot terms they should review or push back on."
  },
  {
    icon: <MessageSquareText className="h-5 w-5" />,
    question: "Can brands and talent message each other?",
    answer: "Yes. Messages can be tied to discovery, campaigns, offers, and projects so important context stays attached to the workflow instead of getting lost across chats."
  }
];

export default async function FeedbackPage() {
  const user = await getCurrentUser();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Product guide"
        title="FAQ"
        description="Quick answers to help brands, creators, and freelancers understand how Agently works."
      />

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>How To Think About Agently</CardTitle>
            <Badge tone="blue">{user?.role ?? "guest"}</Badge>
          </CardHeader>
          <div className="space-y-3">
            <GuidePoint title="Agency OS, not listing site" copy="The product is designed around the full deal lifecycle, not only profile browsing." />
            <GuidePoint title="India-first matching" copy="The engine starts with Bangalore and India relevance, then can expand globally later." />
            <GuidePoint title="Workflow data becomes the moat" copy="Shortlists, offers, counters, contract flags, delivery approvals, payments, and disputes should improve future recommendations." />
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
