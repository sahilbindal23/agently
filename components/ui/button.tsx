"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";
import { SPRING_SNAPPY } from "@/lib/motion/variants";

// Omit the DOM event handlers whose signatures collide with Motion's own
// (drag + animation lifecycle). No Button caller uses these, and dropping them
// lets us spread the rest cleanly onto motion.button without type conflicts.
type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration" | "onDrag" | "onDragStart" | "onDragEnd"
> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

const variants = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  secondary: "bg-white text-foreground border hover:bg-muted dark:bg-card dark:border-white/10 dark:hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
};

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  icon: "h-10 w-10 p-0"
};

// Every button in the app gets the same physical press feedback: a small
// scale-up on hover and a quick squash on tap, on a snappy spring. Disabled
// buttons have pointer-events:none (below), so they never animate. Reduced
// motion is honored globally via MotionProvider.
export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_SNAPPY}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
