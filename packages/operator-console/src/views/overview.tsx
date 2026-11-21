import type { DataSource, EngineHealth, EngineJob, OverviewStats } from "@livepeer/api-client";
import { cn, Tooltip } from "@livepeer/ui";
import type { ReactNode } from "react";

import { ago, count, dateTime, label, usd } from "../components/format";
import { ConsolePage, Panel, Stat, Status } from "../components/parts";
import { Table } from "../components/table";

export interface OverviewProps {
  stats: OverviewStats;
  health: EngineHealth;
  recent: EngineJob[];
  /** Display names by actor id. */
  names: Record<string, string>;
  sources: ReadonlyArray<{ name: string; source: DataSource }>;
}

const shortDate = (day: string): string => new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${day}T00:00`));

/** What a day earned, split at zero: wholesale and margin above the line, any loss below it. */
function split({ revenue_usd: revenue, wholesale_usd: wholesale }: OverviewStats["series"][number]) {
  return { covered: Math.min(revenue, wholesale), margin: Math.max(0, revenue - wholesale), loss: Math.max(0, wholesale - revenue) };
}

function Swatch({ className, children }: { className: string; children: ReactNode }) {
  return <span className="flex items-center gap-1.5"><span className={cn("size-2 rounded-[2px]", className)} />{children}</span>;
}

/** The fortnight in one line, so the chart has numbers without hovering. */
function Totals({ series }: { series: OverviewStats["series"] }) {
  const revenue = series.reduce((total, day) => total + day.revenue_usd, 0);
  const wholesale = series.reduce((total, day) => total + day.wholesale_usd, 0);
  return (
    <p className="font-mono text-[11px] text-muted-foreground">
      {usd(revenue)} revenue · {usd(wholesale)} wholesale · {usd(revenue - wholesale)} margin
    </p>
  );
}

/**
 * Fourteen days of revenue, wholesale cost and margin. Each day is a button with its figures in a
 * tooltip and its label, so the numbers are there for keyboard and screen readers too.
 */
function Bars({ series, estimated }: { series: OverviewStats["series"]; estimated: boolean }) {
  const days = series.map((day) => ({ ...day, ...split(day) }));
  const up = Math.max(0, ...days.map((day) => day.revenue_usd));
  const down = Math.max(0, ...days.map((day) => day.loss));
  const above = up + down > 0 ? (up / (up + down)) * 100 : 100;
  // A loss is only red once revenue is real; an estimate doesn't get to claim one.
  const lossTone = estimated ? "hatch bg-foreground/[0.06] text-foreground/50" : "bg-destructive/70";
  const pct = (value: number, of: number) => (of > 0 ? `${(value / of) * 100}%` : "0%");

  return (
    <div className="flex flex-1 flex-col rounded-card border border-hairline bg-card p-4">
      <div className="relative flex min-h-[132px] flex-1 gap-1.5" role="group" aria-label="Revenue, wholesale cost and margin per day">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-hairline" style={{ top: `${above}%` }} />
        {days.map((day, index) => {
          const today = index === days.length - 1;
          const name = today ? "Today" : shortDate(day.day);
          const margin = day.revenue_usd - day.wholesale_usd;
          return (
            <Tooltip
              key={day.day}
              content={
                <div className="flex min-w-[148px] flex-col gap-1">
                  <p className="font-medium">{name}</p>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 font-mono text-[11px]">
                    <dt className="text-muted-foreground">Revenue</dt><dd className="text-right">{usd(day.revenue_usd)}</dd>
                    <dt className="text-muted-foreground">Wholesale</dt><dd className="text-right">{usd(day.wholesale_usd)}</dd>
                    <dt className="text-muted-foreground">Margin</dt><dd className="text-right">{usd(margin)}</dd>
                  </dl>
                  {estimated ? <p className="text-[11px] text-subtle-foreground">Revenue estimated</p> : null}
                </div>
              }
            >
              <button
                type="button"
                aria-label={`${name}: revenue ${usd(day.revenue_usd)}, wholesale ${usd(day.wholesale_usd)}, margin ${usd(margin)}`}
                className="group flex h-full flex-1 flex-col items-center rounded-[4px] outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.06] focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className="flex w-full max-w-[28px] flex-col justify-end" style={{ height: `${above}%` }}>
                  {day.margin > 0 ? <span className="w-full rounded-t-[3px] bg-foreground/80" style={{ height: pct(day.margin, up) }} /> : null}
                  {day.covered > 0 ? <span className={cn("w-full bg-foreground/20", day.margin > 0 ? "" : "rounded-t-[3px]")} style={{ height: pct(day.covered, up) }} /> : null}
                </span>
                <span className="flex w-full max-w-[28px] flex-col" style={{ height: `${100 - above}%` }}>
                  {day.loss > 0 ? <span className={cn("w-full rounded-b-[3px]", lossTone)} style={{ height: pct(day.loss, down) }} /> : null}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-subtle-foreground">
        <span>{series[0] ? shortDate(series[0].day) : null}</span>
        <span className="flex items-center gap-3">
          <Swatch className="bg-foreground/20">Wholesale</Swatch>
          <Swatch className="bg-foreground/80">Margin</Swatch>
          {down > 0 ? <Swatch className={lossTone}>Loss</Swatch> : null}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

export function OverviewView({ stats, health, recent, names, sources }: OverviewProps) {
  // Revenue is worked out from wholesale cost at the default markup until the payment provider reports charges.
  const estimate = stats.revenue_estimated ? (
    <Tooltip content="Wholesale cost at the default markup, until the payment provider reports what users were charged.">
      <span tabIndex={0} className="cursor-help rounded-[2px] underline decoration-subtle-foreground/50 decoration-dotted underline-offset-[3px] outline-none focus-visible:ring-1 focus-visible:ring-ring">estimated</span>
    </Tooltip>
  ) : undefined;
  return (
    <ConsolePage title="Overview" description="What the instance did today, what it earned and what the network charged." sources={sources}>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Active users, 7 days" value={count(stats.active_users)} />
        <Stat label="Jobs today" value={count(stats.jobs_today)} hint={`${stats.jobs_failed_today} failed`} />
        <Stat label="Revenue today" value={usd(stats.revenue_usd)} hint={estimate} />
        <Stat label="Wholesale cost today" value={usd(stats.wholesale_usd)} hint={`${usd(stats.pending_usd)} pending`} />
        {/* An estimated margin stays neutral: colour would claim a profit or loss the provider hasn’t confirmed. */}
        <Stat label="Margin today" value={usd(stats.margin_usd)} hint={estimate} tone={stats.revenue_estimated ? undefined : stats.margin_usd >= 0 ? "positive" : "negative"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Panel title="Last 14 days" className="mb-0 flex flex-col" actions={<Totals series={stats.series} />}>
          <Bars series={stats.series} estimated={stats.revenue_estimated} />
        </Panel>
        <Panel title="Engine" className="mb-0 flex flex-col">
          <dl className="flex flex-1 flex-col divide-y divide-hairline rounded-card border border-hairline bg-card text-[13px]">
            {[
              ["Status", <Status key="s" value={health.ready ? "ready" : "failed"} />],
              ["Discovery", health.discovery_error ?? `fresh, ${ago(health.discovery_observed_at)}`],
              ["Cost sync", health.cost_sync_error ?? ago(health.cost_sync_at)],
              ["Running jobs", count(health.running_jobs)],
              ["Version", health.version],
            ].map(([term, value]) => (
              <div key={String(term)} className="flex min-h-9 flex-1 items-center justify-between px-4">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="font-mono text-[12px]">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Latest jobs" className="mt-6">
        <Table
          caption="Latest jobs"
          rows={recent}
          rowKey={(job) => job.id}
          empty="No jobs yet. They appear here as users generate."
          columns={[
            { key: "app", header: "Capability", cell: (job) => label(job.app) },
            { key: "user", header: "User", cell: (job) => (names[job.actor_id] ?? job.actor_id), wide: true },
            { key: "state", header: "Status", cell: (job) => <Status value={job.state} /> },
            { key: "when", header: "Started", cell: (job) => dateTime(job.created_at), mono: true, align: "right" },
          ]}
        />
      </Panel>
    </ConsolePage>
  );
}
