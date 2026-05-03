import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileCompleteness } from "@/lib/profile/completeness";

export function ProfileCompletenessCard({
  title,
  completeness,
  compact = false
}: {
  title: string;
  completeness: ProfileCompleteness;
  compact?: boolean;
}) {
  const tone = completeness.score >= 84 ? "green" : completeness.score >= 50 ? "amber" : "red";
  const visibleItems = compact ? completeness.items.filter((item) => !item.done).slice(0, 3) : completeness.items;

  return (
    <Card className={compact ? "p-4 shadow-none" : undefined}>
      <CardHeader className={compact ? "mb-3 gap-3" : undefined}>
        <div>
          <CardTitle className={compact ? "text-sm" : undefined}>{title}</CardTitle>
          <p className={compact ? "mt-1 text-xs leading-5 text-muted-foreground" : "mt-1 text-sm text-muted-foreground"}>{completeness.label}</p>
        </div>
        <Badge tone={tone}>{completeness.score}%</Badge>
      </CardHeader>
      <div className={compact ? "h-1.5 overflow-hidden rounded-full bg-muted" : "h-2 overflow-hidden rounded-full bg-muted"}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${completeness.score}%` }} />
      </div>
      <div className={compact ? "mt-3 grid gap-2" : "mt-4 grid gap-2"}>
        {visibleItems.map((item) => (
          <div className={compact ? "flex items-center gap-2 rounded-md bg-muted px-3 py-2" : "flex items-start gap-2 rounded-md border bg-white p-3"} key={item.label}>
            {item.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            <div>
              <p className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}>{item.label}</p>
              {compact ? null : <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.reason}</p>}
            </div>
          </div>
        ))}
        {compact && visibleItems.length === 0 ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">Profile is ready for discovery.</p>
        ) : null}
      </div>
      {completeness.nextAction?.href ? (
        <div className={compact ? "mt-3" : "mt-4"}>
          <Link href={completeness.nextAction.href}>
            <Button className={compact ? "w-full justify-center" : undefined} type="button" variant="secondary" size="sm">
              {compact ? "Improve profile" : "Next step"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
