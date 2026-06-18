"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { DURATION, EASE_OUT, staggerContainer, staggerItem } from "@/lib/motion/variants";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay before this element animates in (seconds). */
  delay?: number;
  /** Vertical travel distance in px. Keep small. */
  y?: number;
  /** Re-animate every time it scrolls into view, or just once. */
  once?: boolean;
  /** Fraction of the element that must be visible to trigger (0–1). */
  amount?: number;
};

/**
 * Single element that rises + fades in when scrolled into view. Use for
 * section headers, standalone cards, CTAs. reducedMotion (set on MotionProvider)
 * makes this an instant opacity fade when the user prefers reduced motion.
 */
export function Reveal({ children, className, delay = 0, y = 14, once = true, amount = 0.3 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Container that reveals its <StaggerItem> children one after another as it
 * scrolls into view. Use for grids/lists of cards so they cascade instead of
 * popping in all at once.
 */
export function Stagger({
  children,
  className,
  stagger = 0.08,
  delayChildren = 0.04,
  once = true,
  amount = 0.2
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
  once?: boolean;
  amount?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer(stagger, delayChildren)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
