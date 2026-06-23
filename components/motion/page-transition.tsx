"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DURATION, EASE_OUT } from "@/lib/motion/variants";

// A single, subtle route entrance for the whole authed app. Keyed on pathname
// so it re-fires on every navigation — moving between screens feels like a soft
// settle rather than a hard cut. Deliberately small (8px rise, one quick fade):
// page transitions should smooth the jump, not perform. reduced-motion (root
// MotionProvider) turns this into an instant render.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
