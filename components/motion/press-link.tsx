"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { SPRING_SNAPPY } from "@/lib/motion/variants";

const MotionLink = motion.create(Link);

// A Next <Link> with physical press feedback: a subtle scale-up on hover and a
// quick squash on tap, driven by a snappy spring. This is the single biggest
// "feels alive" upgrade for CTAs — every primary button gets real tactility
// without losing client-side navigation. reducedMotion (root MotionProvider)
// disables the scale for users who ask for less motion.
export function PressLink(props: ComponentProps<typeof MotionLink>) {
  return (
    <MotionLink
      {...props}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_SNAPPY}
    />
  );
}
