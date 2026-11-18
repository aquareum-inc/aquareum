"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../lib/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  sideOffset = 8,
  align = "start",
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          "z-50 origin-(--radix-popover-content-transform-origin) rounded-card border border-hairline bg-popover p-1.5 text-popover-foreground shadow-float outline-none",
          "data-[state=open]:animate-[pop-in_240ms_var(--ease-out-expo)] data-[state=closed]:animate-[pop-out_150ms_var(--ease-out-expo)]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
