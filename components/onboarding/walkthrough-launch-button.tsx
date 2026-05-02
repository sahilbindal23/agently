"use client";

import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WalkthroughLaunchButton({
  label = "Start walkthrough",
  variant = "secondary",
  className
}: {
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Button
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent("agently:start-walkthrough"))}
      type="button"
      variant={variant}
    >
      <PlayCircle className="h-4 w-4" />
      {label}
    </Button>
  );
}
