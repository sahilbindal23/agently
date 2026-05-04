import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export function AgentlySignalCard({
  title = "Agently Verified Signals",
  description,
  signals,
  badge = "trust layer",
  icon
}: {
  title?: string;
  description: string;
  signals: string[];
  badge?: string;
  icon?: ReactNode;
}) {
  const cleaned = signals.map((signal) => signal.trim()).filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {icon ?? <Badge tone="blue">{badge}</Badge>}
      </CardHeader>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-4 space-y-2">
        {cleaned.slice(0, 5).map((signal) => (
          <div className="flex gap-2 rounded-md border bg-white p-3 text-sm leading-5" key={signal}>
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{signal}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
