"use client";

import { AnimatePresence, motion } from "motion/react";

import { cn } from "../lib/cn";
import { EASE_OUT_EXPO } from "../lib/motion";

export interface RollingNumberProps {
  value: number;
  className?: string;
}

/**
 * A number that changes by rolling only the digits that changed. Each character is keyed by its
 * place from the right, so "2,480" → "2,370" moves two digits and leaves the rest still.
 */
export function RollingNumber({ value, className }: RollingNumberProps) {
  const text = new Intl.NumberFormat("en-US").format(value);
  const chars = [...text];
  return (
    <span className={cn("inline-flex tabular-nums", className)} aria-label={text}>
      {chars.map((char, index) => {
        const place = chars.length - index;
        return (
          <span key={place} aria-hidden className="relative inline-block overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={char}
                initial={{ y: "70%", opacity: 0, filter: "blur(2px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: "-70%", opacity: 0, filter: "blur(2px)" }}
                transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
                className="inline-block"
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}
