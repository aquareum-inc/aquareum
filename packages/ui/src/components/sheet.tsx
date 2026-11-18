"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  children: ReactNode;
  className?: string;
}

/**
 * A tray for one transient task: one title, one way out, one thing to do. It rises from the
 * bottom on phones and sits centred on larger screens.
 */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-[fade-out_150ms_ease-out] data-[state=open]:animate-[fade-in_240ms_ease-out]" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-2 bottom-2 z-50 max-h-[calc(100dvh-16px)] overflow-y-auto rounded-sheet border border-hairline bg-popover p-6 text-popover-foreground shadow-float outline-none",
            "data-[state=closed]:animate-[pop-out_150ms_var(--ease-out-expo)] data-[state=open]:animate-[sheet-in_320ms_var(--ease-out-expo)]",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(480px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:data-[state=open]:animate-[pop-in_240ms_var(--ease-out-expo)]",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lead font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-body text-muted-foreground">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mr-2 -mt-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-200 hover:bg-hover hover:text-foreground active:scale-[0.92]"
            >
              <X className="size-[18px]" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
