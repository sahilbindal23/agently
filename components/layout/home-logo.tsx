import Link from "next/link";
import { BarChart3 } from "lucide-react";

export function HomeLogo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted/70 ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BarChart3 className="h-5 w-5" />
      </div>
      <div>
        <p className="text-lg font-bold">Agently</p>
        <p className="text-xs text-muted-foreground">Talent agency OS</p>
      </div>
    </Link>
  );
}
