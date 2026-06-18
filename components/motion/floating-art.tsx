"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// Ambient, never-ending drift for decorative hero artwork (the contour rings).
// Very slow and small — it reads as "the page is breathing", not "something is
// moving". Long duration + easeInOut keeps it calm. Disabled automatically for
// reduced-motion users via the root MotionProvider.
export function FloatingArt({
  children,
  className,
  duration = 9,
  y = 12,
  rotate = 1.5
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  y?: number;
  rotate?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -y, 0], rotate: [0, rotate, 0] }}
      transition={{ duration, ease: "easeInOut", repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}
