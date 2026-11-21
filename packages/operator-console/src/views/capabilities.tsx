"use client";

import type { CapabilitySetting, DataSource, Offering } from "@livepeer/api-client";
import { Badge, Input, Switch } from "@livepeer/ui";
import { useState } from "react";

import { label } from "../components/format";
import { ConsolePage } from "../components/parts";

export interface CapabilityRow {
  offering: Offering;
  kind: string;
  /** Where the mapping places it by default. */
  surfaces: string[];
  /** Allowed by the instance's allow and block rules. */
  allowed: boolean;
  setting: CapabilitySetting;
}

export interface CapabilitiesViewProps {
  rows: CapabilityRow[];
  defaultMarkup: number;
  update: (app: string, patch: Partial<Omit<CapabilitySetting, "app">>) => Promise<CapabilitySetting>;
  sources: ReadonlyArray<{ name: string; source: DataSource }>;
  /** False when neither the user app nor the phone apps are on, so nothing shows a capability on a surface. */
  placing: boolean;
}

const SURFACES = ["chat", "studio", "characters", "library", "live"];

function wholesale(offering: Offering): string {
  const low = offering.rate_low?.price_usd;
  if (!low) return "—";
  const perSecond = offering.rate_low?.unit === "seconds";
  const amount = Number(low) * (perSecond ? 3600 : 1);
  return `$${amount < 0.01 ? amount.toPrecision(1) : amount.toFixed(2)}${perSecond ? "/hr" : ""}`;
}

export function CapabilitiesView({ rows: initial, defaultMarkup, update, sources, placing }: CapabilitiesViewProps) {
  const [rows, setRows] = useState(initial);
  const [failed, setFailed] = useState<string | null>(null);

  const save = async (app: string, patch: Partial<Omit<CapabilitySetting, "app">>) => {
    const previous = rows;
    setRows((current) => current.map((row) => (row.offering.app === app ? { ...row, setting: { ...row.setting, ...patch } } : row)));
    setFailed(null);
    try {
      const setting = await update(app, patch);
      setRows((current) => current.map((row) => (row.offering.app === app ? { ...row, setting } : row)));
    } catch {
      setRows(previous);
      setFailed(app);
    }
  };

  return (
    <ConsolePage title="Capabilities" description="Everything discovery returns from the network. Choose what this instance offers, what it charges and where each one appears." sources={sources} note="Discovery is live. Markups save to instance.config.json, which users are charged from. Whether a capability is offered and where it appears are held in memory for now; allow and block rules come from instance.config.json. Routing preferences need the engine to accept a routing constraint.">
      {failed ? <p role="alert" className="mb-3 text-[13px] text-destructive">The change to {failed} didn't save.</p> : null}
      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-input px-6 py-12 text-center text-[13px] text-muted-foreground">
          Discovery returned nothing. Check the engine's discovery status on the System page.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-hairline bg-card">
          <table className="w-full border-collapse text-[13px] leading-[18px]">
            <caption className="sr-only">Capabilities</caption>
            <thead>
              <tr className="border-b border-hairline text-left text-[11px] font-medium uppercase tracking-[0.04em] text-subtle-foreground">
                <th scope="col" className="h-9 pl-4 pr-3 font-medium">Capability</th>
                {placing ? <th scope="col" className="hidden h-9 px-3 font-medium lg:table-cell">Appears in</th> : null}
                <th scope="col" className="hidden h-9 px-3 text-right font-medium md:table-cell">Runners</th>
                <th scope="col" className="h-9 px-3 text-right font-medium">Wholesale</th>
                <th scope="col" className="h-9 px-3 text-right font-medium">Markup</th>
                <th scope="col" className="h-9 pl-3 pr-4 text-right font-medium">Offered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map(({ offering, kind, surfaces, allowed, setting }) => {
                const shown = setting.surfaces ?? surfaces;
                return (
                  <tr key={`${offering.app}:${offering.rate_low?.unit ?? ""}`} className="transition-colors duration-150 hover:bg-hover">
                    <td className="py-2 pl-4 pr-3">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        {label(offering.app)}
                        {offering.modes.includes("persistent") ? <Badge>Session</Badge> : null}
                        {allowed ? null : <Badge tone="warn">Blocked by config</Badge>}
                      </p>
                      <p className="font-mono text-[11px] text-subtle-foreground">{offering.app} · {kind}</p>
                    </td>
                    {placing ? <td className="hidden px-3 lg:table-cell">
                      <div className="flex flex-wrap gap-1" role="group" aria-label={`Surfaces for ${offering.app}`}>
                        {SURFACES.map((surface) => {
                          const on = shown.includes(surface);
                          return (
                            <button
                              key={surface}
                              type="button"
                              aria-pressed={on}
                              onClick={() => save(offering.app, { surfaces: on ? shown.filter((entry) => entry !== surface) : [...shown, surface] })}
                              className={`h-6 rounded-full px-2 text-[11px] font-medium transition-colors ${on ? "bg-active text-foreground" : "text-subtle-foreground hover:bg-hover hover:text-foreground"}`}
                            >
                              {surface}
                            </button>
                          );
                        })}
                      </div>
                    </td> : null}
                    <td className="hidden px-3 text-right font-mono text-[12px] text-muted-foreground md:table-cell">{offering.ready_count}/{offering.runner_count}</td>
                    <td className="px-3 text-right font-mono text-[12px] text-muted-foreground">{wholesale(offering)}</td>
                    <td className="px-3 text-right">
                      <Input
                        type="number"
                        min="1"
                        step="0.05"
                        aria-label={`Markup for ${offering.app}`}
                        placeholder={defaultMarkup.toFixed(2)}
                        defaultValue={setting.markup ?? ""}
                        onBlur={(event) => {
                          const value = event.target.value ? Math.max(1, Number(event.target.value)) : null;
                          if (value !== setting.markup) void save(offering.app, { markup: value });
                        }}
                        className="ml-auto h-8 w-[76px] rounded-full px-3 text-right font-mono text-[12px]"
                      />
                    </td>
                    <td className="pl-3 pr-4 text-right">
                      <Switch checked={allowed && setting.enabled} disabled={!allowed} onCheckedChange={(enabled) => save(offering.app, { enabled })} aria-label={`Offer ${offering.app}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ConsolePage>
  );
}
