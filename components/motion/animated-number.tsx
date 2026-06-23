"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/motion/variants";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

type Format = "number" | "currency" | "percent";

function render(value: number, format: Format, currency: string): string {
  if (format === "currency") return formatCurrency(Math.round(value), currency);
  if (format === "percent") return `${Math.round(value)}%`;
  return formatNumber(Math.round(value));
}

/**
 * Counts a metric up from zero to `value` when it scrolls into view. Used on
 * dashboard/insights stat tiles — a premium touch that draws the eye to the
 * number that matters. Restraint: it animates once, only when visible, and
 * collapses to the final value instantly under prefers-reduced-motion.
 *
 * For currency, pass the value in CENTS (formatCurrency divides by 100), e.g.
 * <AnimatedNumber value={amountCents} format="currency" />.
 */
export function AnimatedNumber({
  value,
  format = "number",
  currency = "inr",
  duration = 0.9,
  className
}: {
  value: number;
  format?: Format;
  currency?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(() => render(reduce ? value : 0, format, currency));

  useEffect(() => {
    if (reduce) {
      setDisplay(render(value, format, currency));
      return;
    }
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(render(v, format, currency))
    });
    return () => controls.stop();
  }, [inView, value, format, currency, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
