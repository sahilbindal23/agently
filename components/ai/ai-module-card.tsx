import type { LucideIcon } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";

export function AiModuleCard({ title, copy, icon: Icon }: { title: string; copy: string; icon: LucideIcon }) {
  return (
    <Card>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <CardTitle>{title}</CardTitle>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
    </Card>
  );
}
