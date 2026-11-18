import type { ButtonHTMLAttributes, Ref } from "react";

import { cn } from "../lib/cn";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** A small pill for a parameter or a starting point. */
export function Chip({ className, selected = false, type, ...props }: ChipProps) {
  return (
    <button
      type={type ?? "button"}
      aria-pressed={props["aria-pressed"] ?? undefined}
      data-selected={selected || undefined}
      className={cn(
        "inline-flex h-8 shrink-0 select-none items-center gap-1.5 rounded-full border border-hairline px-3 text-caption font-medium text-muted-foreground transition-[background-color,color,border-color,transform] duration-200 ease-out-expo hover:bg-hover hover:text-foreground active:scale-[0.97] data-[selected]:border-transparent data-[selected]:bg-active data-[selected]:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}
