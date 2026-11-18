"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../lib/cn";

/** On is ink, like every other primary state. Never the brand colour. */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-input p-0.5 transition-colors duration-200 ease-out-expo data-[state=checked]:bg-primary disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 rounded-full bg-foreground transition-transform duration-200 ease-out-expo data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-foreground" />
    </SwitchPrimitive.Root>
  );
}
