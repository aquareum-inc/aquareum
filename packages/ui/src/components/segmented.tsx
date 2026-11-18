"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { LAYOUT_SPRING } from "../lib/motion";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  iconOnly?: boolean;
  className?: string;
}

/** One control, one moving thumb: the selection slides, it doesn't blink. */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  label,
  size = "md",
  iconOnly = false,
  className,
}: SegmentedProps<T>) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5 rounded-full bg-muted p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative inline-flex select-none items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-200 [&_svg]:size-4",
              size === "md" ? "h-9 px-3.5 text-body" : "h-7 px-3 text-caption",
              iconOnly && (size === "md" ? "w-10 px-0" : "w-8 px-0"),
              selected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`${id}-thumb`}
                transition={LAYOUT_SPRING}
                className="absolute inset-0 rounded-full bg-primary"
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {option.icon}
              {iconOnly ? null : option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
