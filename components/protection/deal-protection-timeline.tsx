import { CheckCircle2, Circle, FileWarning, LockKeyhole, Send, ShieldCheck, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskLevel } from "@/types";

type ProtectionTimelineProps = {
  accepted: boolean;
  contractRisk?: RiskLevel | string | null;
  hasContract?: boolean;
  hasDeliverable?: boolean;
  deliverableStatus?: string | null;
  paymentStatus?: string | null;
  title?: string;
  variant?: "card" | "inline";
};

type ProtectionStep = {
  copy: string;
  done: boolean;
  icon: React.ReactNode;
  label: string;
  tone: "green" | "amber" | "red" | "blue" | "neutral";
};

export function DealProtectionTimeline({
  accepted,
  contractRisk,
  deliverableStatus,
  hasContract = false,
  hasDeliverable = false,
  paymentStatus = "unpaid",
  title = "Deal Protection Timeline",
  variant = "card"
}: ProtectionTimelineProps) {
  const funded = ["funded", "release_ready", "released"].includes(String(paymentStatus));
  const approved = deliverableStatus === "approved" || ["release_ready", "released"].includes(String(paymentStatus));
  const released = paymentStatus === "released";
  const contractSafe = hasContract && contractRisk !== "high_risk";
  const steps: ProtectionStep[] = [
    {
      copy: accepted ? "Talent has accepted the commercial scope." : "Talent still needs to accept, decline, or counter.",
      done: accepted,
      icon: <Send className="h-4 w-4" />,
      label: "Offer accepted",
      tone: accepted ? "green" : "amber"
    },
    {
      copy: hasContract ? contractCopy(contractRisk) : "No contract scan or terms review is attached yet.",
      done: contractSafe,
      icon: <FileWarning className="h-4 w-4" />,
      label: "Terms protected",
      tone: !hasContract ? "amber" : contractRisk === "high_risk" ? "red" : contractRisk === "caution" ? "amber" : "green"
    },
    {
      copy: funded ? "Funds are marked protected before delivery." : "Brand funding is still required before final delivery.",
      done: funded,
      icon: <LockKeyhole className="h-4 w-4" />,
      label: "Payment funded",
      tone: funded ? "green" : "amber"
    },
    {
      copy: hasDeliverable ? `Deliverable is ${deliverableStatus || "submitted"}.` : "Talent has not submitted final work yet.",
      done: hasDeliverable,
      icon: <ShieldCheck className="h-4 w-4" />,
      label: "Deliverable submitted",
      tone: hasDeliverable ? "green" : funded ? "blue" : "neutral"
    },
    {
      copy: approved ? "Brand/admin approval is complete." : "Approval is still pending.",
      done: approved,
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: "Approved",
      tone: approved ? "green" : hasDeliverable ? "amber" : "neutral"
    },
    {
      copy: released ? "Payout is marked released." : "Payout release is not complete yet.",
      done: released,
      icon: <WalletCards className="h-4 w-4" />,
      label: "Payout released",
      tone: released ? "green" : approved ? "amber" : "neutral"
    }
  ];
  const current = steps.find((step) => !step.done) ?? steps[steps.length - 1];

  const content = (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{current.done ? "Protected workflow complete" : current.label}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{current.copy}</p>
        </div>
        <Badge tone={current.tone}>{current.done ? "complete" : "next"}</Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {steps.map((step, index) => (
          <div
            className={`rounded-md border p-3 dark:border-white/10 ${
              step.done
                ? "bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-100"
                : "bg-white dark:bg-card dark:text-card-foreground"
            }`}
            key={step.label}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${step.done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
                {step.done ? <CheckCircle2 className="h-4 w-4" /> : step.icon || <Circle className="h-4 w-4" />}
              </span>
              <Badge tone={step.tone}>{index + 1}</Badge>
            </div>
            <p className="text-sm font-semibold">{step.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.copy}</p>
          </div>
        ))}
      </div>
    </>
  );

  if (variant === "inline") return <div className="rounded-md border bg-muted/30 p-3 dark:border-white/10 dark:bg-white/5">{content}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge tone={released ? "green" : funded ? "blue" : accepted ? "amber" : "neutral"}>{paymentStatus || "unpaid"}</Badge>
      </CardHeader>
      {content}
    </Card>
  );
}

function contractCopy(risk: RiskLevel | string | null | undefined) {
  if (risk === "high_risk") return "Contract is high risk. Negotiate before accepting broad rights or delivery.";
  if (risk === "caution") return "Contract has caution flags. Review before moving forward.";
  if (risk === "safe") return "Contract scan did not find major creator-side risks.";
  return "Terms are attached, but risk status is not fully classified.";
}
