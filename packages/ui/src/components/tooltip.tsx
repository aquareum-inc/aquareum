"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";

import { cn } from "../lib/cn";

export interface TooltipProps {
  /** What the tooltip says. Keep it to detail a reader can do without: hover and focus only, never touch. */
  content: ReactNode;
  /** One focusable element, so keyboard users reach the tooltip too. */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

/** A small label on hover or focus, after a short delay; it moves straight between neighbours once one is open. */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={400}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={12}
            className={cn(
              "z-50 max-w-[280px] origin-(--radix-tooltip-content-transform-origin) rounded-field border border-hairline bg-popover px-2.5 py-1.5 text-[12px] leading-[17px] text-popover-foreground shadow-float",
              "data-[state=delayed-open]:animate-[pop-in_240ms_var(--ease-out-expo)] data-[state=instant-open]:animate-[pop-in_240ms_var(--ease-out-expo)] data-[state=closed]:animate-[pop-out_150ms_var(--ease-out-expo)]",
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
