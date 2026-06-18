"use client";

import { MotionConfig } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion/variants";

// App-wide motion defaults. reducedMotion="user" makes EVERY Motion component
// automatically honor the OS "reduce motion" setting — transforms collapse to
// instant, opacity still cross-fades. This is the accessibility backbone, set
// once at the root so we never have to remember it per-component.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE_OUT }}>
      {children}
    </MotionConfig>
  );
}
