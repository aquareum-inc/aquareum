"use client";

import type { AppModel, Offering } from "@aquareum/api-client/types";
import { Popover, PopoverContent, PopoverTrigger, cn } from "@aquareum/ui";
import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { capabilityEntries, type MenuEntry } from "../lib/capability-menu";

function Row({ entry, selected, onSelect }: { entry: Pick<MenuEntry, "name" | "description"> & { busy?: boolean }; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex w-full items-start gap-2.5 rounded-field px-2.5 py-2 text-left transition-colors duration-150 hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
    >
      <Check className={cn("mt-0.5 size-4 shrink-0 text-foreground", selected ? "opacity-100" : "opacity-0")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-foreground">{entry.name}</span>
        <span className="mt-0.5 block truncate text-caption text-muted-foreground">{entry.description}</span>
      </span>
      {entry.busy ? (
        <span className="shrink-0 rounded-full border border-glass-edge px-2 py-0.5 font-mono text-[10px] text-muted-foreground" title="Every runner is busy, so a job would wait in line">
          Busy
        </span>
      ) : null}
    </button>
  );
}

export interface MenuPickerProps {
  entries: ReadonlyArray<MenuEntry>;
  /** `null` is Auto. */
  value: string | null;
  onValueChange: (app: string | null) => void;
  /** Offered first when set: what Auto does. */
  auto?: { description: string };
  /** Shown before the label on the trigger. */
  icon?: ReactNode;
  /** Opens upward, for a composer near the foot of the screen. */
  side?: "top" | "bottom";
  className?: string;
}

/** A short glass menu of described choices, with an optional Auto first. */
export function MenuPicker({ entries, value, onValueChange, auto, icon, side = "bottom", className }: MenuPickerProps) {
  const [open, setOpen] = useState(false);
  const matches = (entry: MenuEntry) => value !== null && (entry.app === value || (entry.also?.includes(value) ?? false));
  const label = value ? (entries.find(matches)?.name ?? value) : "Auto";
  const pick = (app: string | null) => {
    onValueChange(app);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full pl-2.5 pr-2 text-caption font-medium text-muted-foreground transition-[background-color,color] duration-200 hover:bg-hover hover:text-foreground data-[state=open]:bg-hover data-[state=open]:text-foreground",
            className,
          )}
        >
          {icon}
          {label}
          <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        role="menu"
        side={side}
        // Focus goes back to the trigger on close, unless the user has already moved it, say by
        // clicking into the prompt while the menu fades out.
        onCloseAutoFocus={(event) => {
          if (document.activeElement && document.activeElement !== document.body) event.preventDefault();
        }}
        className="glass-menu w-[min(340px,calc(100vw-24px))] border-glass-edge bg-glass-menu p-1.5">
        <div className="max-h-[min(380px,calc(var(--radix-popover-content-available-height)-16px))] overflow-y-auto">
          {auto ? <Row entry={{ name: "Auto", description: auto.description }} selected={value === null} onSelect={() => pick(null)} /> : null}
          {entries.map((entry) => (
            <Row key={entry.app} entry={entry} selected={matches(entry)} onSelect={() => pick(entry.app)} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface OfferingPickerProps {
  offerings: ReadonlyArray<Offering>;
  /** The models behind them, named under each capability. */
  models: ReadonlyArray<AppModel>;
  value: string;
  onValueChange: (app: string) => void;
  className?: string;
}

/** Picks the capability that runs a studio request, from those that fit its medium. */
export function OfferingPicker({ offerings, models, value, onValueChange, className }: OfferingPickerProps) {
  const entries = useMemo(() => capabilityEntries(offerings, models), [offerings, models]);
  return <MenuPicker entries={entries} value={value} onValueChange={(app) => app && onValueChange(app)} {...(className ? { className } : {})} />;
}
