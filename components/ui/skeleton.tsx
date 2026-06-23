import { cn } from "@/lib/utils/cn";

// Loading placeholder. A calm shimmer (not a pulsing flash) via the `shimmer`
// keyframe in globals.css — pure CSS so it runs during route transitions before
// any JS hydrates, and it self-disables under prefers-reduced-motion (the
// reduced-motion block in globals.css zeroes the animation). Used in route-level
// loading.tsx files so navigating to a data-heavy page shows structure instantly
// instead of a blank hang.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-[shimmer_1.6s_ease-in-out_infinite] rounded-md bg-muted/70", className)} />;
}
