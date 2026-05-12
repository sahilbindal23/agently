import Link from "next/link";
import type React from "react";
import { Card } from "@/components/ui/card";

// Standardised empty-state pattern for first-time users on hot pages.
//
// Pattern: friendly icon + title + plain-English description + 1-2 CTAs.
// Avoid the "no data" anti-pattern that just shows a blank table — that
// makes new users bounce because they don't know if the product is
// broken or if they haven't done something yet.
//
// Usage:
//   <EmptyState
//     icon={<Inbox className="h-6 w-6" />}
//     title="No offers yet"
//     description="Brands haven't sent you an offer yet. Improve your discoverability:"
//     actions={[
//       { label: "Finish your profile", href: "/profile" },
//       { label: "Connect social accounts", href: "/profile", variant: "secondary" }
//     ]}
//     bullets={[
//       "Complete intake (bio, rates, target audience)",
//       "Connect Instagram / YouTube via Phyllo for verified metrics",
//       "Wait for India-based brands to send offers (or reach out from /creators)"
//     ]}
//   />

type Action = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

type Props = {
  icon: React.ReactNode;
  title: string;
  description: string;
  actions?: Action[];
  bullets?: string[];
  className?: string;
};

export function EmptyState({ icon, title, description, actions = [], bullets = [], className = "" }: Props) {
  return (
    <Card className={`text-center ${className}`}>
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      {bullets.length ? (
        <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm leading-6 text-muted-foreground">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {actions.length ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actions.map((action) => (
            <Link
              className={
                action.variant === "secondary"
                  ? "inline-flex h-10 items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-muted dark:border-white/10 dark:bg-card"
                  : "inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              }
              href={action.href}
              key={action.href + action.label}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
