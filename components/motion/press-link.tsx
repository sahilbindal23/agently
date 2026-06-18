"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { pressableCta } from "@/lib/motion/variants";

const MotionLink = motion.create(Link);

// A Next <Link> for PROMINENT call-to-actions (hero buttons, the sign-in pill).
// Gets a small deliberate hover lift + tap squash on a soft, non-overshooting
// spring — the scale reads as emphasis here because these are the page's main
// actions, not utility controls. Don't reach for this on dense/utility links;
// use a plain Link there. reducedMotion (root MotionProvider) disables it for
// users who ask for less motion.
export function PressLink(props: ComponentProps<typeof MotionLink>) {
  return <MotionLink {...props} {...pressableCta} />;
}
