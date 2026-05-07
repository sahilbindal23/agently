import { Banknote, Building2, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type Role = "creator" | "brand" | "freelancer";

export function PayoutReadinessCard({ role }: { role: Role }) {
  const copy = roleCopy[role];

  return (
    <Card className="mb-5 border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10">
      <CardHeader>
        <div>
          <CardTitle>{copy.title}</CardTitle>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>
        <Badge tone="blue">setup placeholder</Badge>
      </CardHeader>
      <div className="grid gap-3 md:grid-cols-3">
        {copy.items.map((item) => (
          <div className="rounded-md border bg-card p-3 dark:border-white/8" key={item.title}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              {item.icon}
            </div>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.copy}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

const roleCopy: Record<Role, {
  title: string;
  description: string;
  items: Array<{ title: string; copy: string; icon: React.ReactNode }>;
}> = {
  creator: {
    title: "Payout readiness",
    description: "Before live payouts, creators will add verified payout details so accepted, funded work can move cleanly from delivery approval to payout release.",
    items: [
      { title: "Razorpay route", copy: "Funding is collected from brands first. Payout automation can connect once RazorpayX is approved.", icon: <Banknote className="h-4 w-4" /> },
      { title: "Identity check", copy: "Creator payout details should match the verified account owner before release.", icon: <ShieldCheck className="h-4 w-4" /> },
      { title: "Manual release now", copy: "The prototype tracks release-ready status while final payouts stay controlled by Agently.", icon: <Clock3 className="h-4 w-4" /> }
    ]
  },
  freelancer: {
    title: "Freelancer payout readiness",
    description: "Freelancers can receive project work without creating a Razorpay account. Agently will collect funding from brands, then release payout after approved delivery.",
    items: [
      { title: "Bank or UPI later", copy: "A secure payout form can be added once the live payout rail is ready.", icon: <Building2 className="h-4 w-4" /> },
      { title: "Scope protected", copy: "Project terms, revision rules, and deliverable approval stay attached to the payout workflow.", icon: <ShieldCheck className="h-4 w-4" /> },
      { title: "Release after approval", copy: "Approved deliverables move the project toward release-ready status.", icon: <CheckCircle2 className="h-4 w-4" /> }
    ]
  },
  brand: {
    title: "Funding readiness",
    description: "Brands do not need a Razorpay account to fund work. They can pay through checkout; Agently tracks whether the deal or project is protected before delivery begins.",
    items: [
      { title: "Checkout funding", copy: "Use Razorpay checkout to fund accepted creator deals and freelancer projects.", icon: <Banknote className="h-4 w-4" /> },
      { title: "Delivery control", copy: "Funding, deliverable review, and approval are tracked in one workflow.", icon: <ShieldCheck className="h-4 w-4" /> },
      { title: "Release queue", copy: "After approval, Agently can move the payment toward payout release.", icon: <CheckCircle2 className="h-4 w-4" /> }
    ]
  }
};
