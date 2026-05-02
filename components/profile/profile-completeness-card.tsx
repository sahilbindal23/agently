import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileCompleteness } from "@/lib/profile/completeness";

export function ProfileCompletenessCard({
  title,
  completeness
}: {
  title: string;
  completeness: ProfileCompleteness;
}) {
  const tone = completeness.score >= 84 ? "green" : completeness.score >= 50 ? "amber" : "red";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{completeness.label}</p>
        </div>
        <Badge tone={tone}>{completeness.score}%</Badge>
      </CardHeader>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${completeness.score}%` }} />
      </div>
      <div className="mt-4 grid gap-2">
        {completeness.items.map((item) => (
          <div className="flex items-start gap-2 rounded-md border bg-white p-3" key={item.label}>
            {item.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            <div>
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.reason}</p>
            </div>
          </div>
        ))}
      </div>
      {completeness.nextAction?.href ? (
        <div className="mt-4">
          <Link href={completeness.nextAction.href}>
            <Button type="button" variant="secondary" size="sm">
              Next step
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
