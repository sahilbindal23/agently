import type { Transition, Variants } from "motion/react";

// Shared motion language for Agently. The whole point (Emil Kowalski's ethos):
// a SMALL, consistent set of easings + durations applied with restraint, so
// motion feels like one designed system rather than a pile of one-off tweens.
//
// Rules we follow everywhere:
//   - Animate transform + opacity only (GPU-composited, never layout-thrashing).
//   - Enter with ease-out (fast start, gentle settle); keep it short.
//   - Small travel (8–16px). Big slides feel cheap; small ones feel premium.
//   - Springs for anything interactive (press, hover, layout) so it feels physical.

/** ease-out-expo — the house easing for entrances. Snappy in, soft landing. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** Symmetric ease for hovers / color transitions. */
export const EASE_IN_OUT: [number, number, number, number] = [0.45, 0, 0.55, 1];

export const DURATION = {
  fast: 0.18,
  base: 0.4,
  slow: 0.6
} as const;

/** Snappy spring for press/tap and small interactive feedback. */
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 420, damping: 32, mass: 0.7 };
/** Softer spring for hover lift and layout shifts. */
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 26 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } }
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } }
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } }
};

/** Parent that reveals its children one after another. */
export const staggerContainer = (stagger = 0.08, delayChildren = 0.04): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } }
});

/** Child of a staggerContainer — rises into place. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } }
};

/** Standard interactive feedback for buttons/links. */
export const pressable = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: SPRING_SNAPPY
} as const;

/** Card hover lift. */
export const liftable = {
  whileHover: { y: -4 },
  transition: SPRING_SOFT
} as const;
