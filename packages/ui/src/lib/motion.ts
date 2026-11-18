/** Motion tokens shared by every animated component. See docs/design-brief.md §3. */
export const EASE_OUT_EXPO = [0.19, 1, 0.22, 1] as const;

export const DURATION = { enter: 0.24, exit: 0.15, morph: 0.32 } as const;

/** Layout and shared-element moves. */
export const LAYOUT_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 1 } as const;

/** Panels never fade alone: they arrive slightly small, offset and soft. */
export const PANEL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.97, y: 6, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DURATION.enter, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    filter: "blur(2px)",
    transition: { duration: DURATION.exit, ease: EASE_OUT_EXPO },
  },
} as const;

export const STAGGER = 0.05;
