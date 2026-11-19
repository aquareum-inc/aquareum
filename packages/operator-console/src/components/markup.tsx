"use client";

import { creditsFor } from "@aquareum/api-client/provider";
import { Popover, PopoverContent, PopoverTrigger, RollingNumber, cn } from "@aquareum/ui";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";

import { label } from "./format";

/** The worked example: what this much network cost comes to for a user. */
const EXAMPLE_USD = 1;

const money = (value: number) => `$${value.toFixed(2)}`;
const times = (value: number) => `${value.toFixed(2)}×`;

export interface MarkupExampleProps {
  markup: { default: number; creditsPerUsd: number; perApp: Record<string, number> };
  Link: ComponentType<{ href: string; className?: string; children: ReactNode }>;
}

function Term({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[28px] font-medium leading-8 tracking-[-0.02em] tabular-nums">{children}</span>
      <span className="text-[12px] text-muted-foreground">{caption}</span>
    </div>
  );
}

const Operator = ({ children }: { children: string }) => (
  <span aria-hidden className="pb-[22px] text-[20px] leading-8 text-subtle-foreground">{children}</span>
);

/**
 * How a price is made, shown as one worked example instead of a list of settings: network cost, times
 * a markup, charged in credits. Choosing a capability swaps in its own markup and the figures roll.
 */
export function MarkupExample({ markup, Link }: MarkupExampleProps) {
  const [app, setApp] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const own = Object.entries(markup.perApp).sort(([, a], [, b]) => a - b);
  const rates = own.map(([, rate]) => rate);
  const rate = app ? (markup.perApp[app] ?? markup.default) : markup.default;
  const credits = creditsFor(EXAMPLE_USD, app ?? "", { creditsPerUsd: markup.creditsPerUsd, default: markup.default, perApp: markup.perApp });

  const options: Array<{ app: string | null; name: string; rate: number }> = [{ app: null, name: "Default", rate: markup.default }, ...own.map(([key, value]) => ({ app: key, name: label(key), rate: value }))];

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <p className="text-[12px] text-subtle-foreground">What a user pays for {money(EXAMPLE_USD)} of network cost</p>
        {own.length > 0 ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className="inline-flex h-7 items-center gap-1 rounded-full bg-hover px-3 text-[12px] font-medium transition-colors duration-100 hover:bg-active">
              {app ? label(app) : "Default markup"}
              <ChevronDown className="size-3.5 text-subtle-foreground" />
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[320px] w-[260px] overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.app ?? "default"}
                  type="button"
                  onClick={() => {
                    setApp(option.app);
                    setOpen(false);
                  }}
                  className="flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] transition-colors duration-100 hover:bg-hover"
                >
                  <Check className={cn("size-3.5 shrink-0", option.app === app ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  <span className="text-[12px] tabular-nums text-muted-foreground">{times(option.rate)}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-4 px-4 pb-4 pt-3">
        <Term caption="Network cost">{money(EXAMPLE_USD)}</Term>
        <Operator>×</Operator>
        <Term caption={app ? "Its own markup" : "Default markup"}>
          <RollingNumber value={rate} format={times} />
        </Term>
        <Operator>=</Operator>
        <Term caption="Charged to the user">
          <RollingNumber value={EXAMPLE_USD * rate} format={money} />
        </Term>
        <Operator>→</Operator>
        <Term caption={`At ${markup.creditsPerUsd.toLocaleString("en-US")} credits per $1`}>
          <RollingNumber value={credits} />
          <span className="ml-1.5 text-[15px] font-normal tracking-normal text-muted-foreground">credits</span>
        </Term>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline px-4 py-2.5 text-[12px] text-muted-foreground">
        <p>
          {own.length === 0
            ? "Every capability uses the default markup."
            : `${own.length} ${own.length === 1 ? "capability has" : "capabilities have"} their own markup${own.length === 1 ? "" : `, from ${times(Math.min(...rates))} to ${times(Math.max(...rates))}`}.`}
        </p>
        <Link href="/operator/capabilities" className="group inline-flex items-center gap-0.5 font-medium text-foreground">
          {own.length === 0 ? "Set them on Capabilities" : "Capabilities"}
          <ChevronRight className="size-3.5 text-subtle-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
