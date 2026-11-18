import type { DataSource } from "@aquareum/api-client/types";
import { cn } from "@aquareum/ui";

export interface DataSourceBadgeProps {
  /** One entry per API function the screen read from. */
  sources: ReadonlyArray<{ name: string; source: DataSource }>;
}

/** Dev-only label saying whether a screen's data is live or mocked. The host never renders it for end users. */
export function DataSourceBadge({ sources }: DataSourceBadgeProps) {
  const live = sources.filter((entry) => entry.source === "live").length;
  const label = live === sources.length ? "Live data" : live === 0 ? "Mock data" : "Live + mock data";
  return (
    <div
      className="pointer-events-auto fixed bottom-24 right-4 z-30 inline-flex h-7 items-center gap-2 rounded-full border border-hairline bg-popover px-2.5 font-mono text-[11px] text-muted-foreground shadow-float md:bottom-5 md:right-5"
      title={sources.map((entry) => `${entry.name}: ${entry.source}`).join("\n")}
    >
      <span className={cn("size-1.5 rounded-full", live > 0 ? "bg-brand-fill" : "bg-subtle-foreground")} />
      {label}
    </div>
  );
}
