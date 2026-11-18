import type { CostClass, CostSummary, DataSource } from "@aquareum/api-client";

import { count, label, usd } from "../components/format";
import { ConsolePage, Panel, Stat } from "../components/parts";
import { Table } from "../components/table";

export interface CostsViewProps {
  summary: CostSummary;
  days: number;
  /** Markup applied per app, and the default. */
  markup: { default: number; perApp: Record<string, number> };
  sources: ReadonlyArray<{ name: string; source: DataSource }>;
}

const fee = (summary: CostSummary["by_class"] | Partial<CostSummary["by_class"]>, cls: CostClass) => Number(summary[cls]?.fee_usd ?? 0);

export function CostsView({ summary, days, markup, sources }: CostsViewProps) {
  const rows = Object.entries(summary.by_app)
    .map(([app, classes]) => {
      const delivered = fee(classes, "delivered");
      const lost = fee(classes, "failed_after_payment");
      const rate = markup.perApp[app] ?? markup.default;
      return { app, delivered, lost, pending: fee(classes, "pending"), retail: delivered * rate, margin: delivered * rate - delivered - lost, rate };
    })
    .sort((a, b) => b.retail - a.retail);
  const delivered = fee(summary.by_class, "delivered");
  const lost = fee(summary.by_class, "failed_after_payment");
  const retail = rows.reduce((total, row) => total + row.retail, 0);

  return (
    <ConsolePage title="Costs" description={`Retail revenue against what the network charged, over the last ${days} days.`} sources={sources} note="Wholesale cost is the engine's own record. Retail is that cost at each capability's markup; the engine doesn't know what users were charged.">
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Retail revenue" value={usd(retail)} />
        <Stat label="Wholesale, delivered" value={usd(delivered)} hint={`${count(summary.jobs_with_cost)} jobs with a cost`} />
        <Stat label="Paid, then failed" value={usd(lost)} hint="charged by the network, nothing delivered" tone={lost > 0 ? "negative" : undefined} />
        <Stat label="Still pending" value={usd(fee(summary.by_class, "pending"))} hint={`${count(summary.jobs_pending)} jobs`} />
        <Stat label="Margin" value={usd(retail - delivered - lost)} tone={retail - delivered - lost >= 0 ? "positive" : "negative"} />
      </div>
      <Panel title="By capability">
        <Table
          caption="Costs by capability"
          rows={rows}
          rowKey={(row) => row.app}
          empty="No costs in this period."
          columns={[
            { key: "app", header: "Capability", cell: (row) => <span title={row.app}>{label(row.app)}</span> },
            { key: "rate", header: "Markup", cell: (row) => `${row.rate.toFixed(2)}×`, mono: true, align: "right", wide: true },
            { key: "retail", header: "Retail", cell: (row) => usd(row.retail), mono: true, align: "right" },
            { key: "wholesale", header: "Wholesale", cell: (row) => usd(row.delivered), mono: true, align: "right" },
            { key: "lost", header: "Paid, failed", cell: (row) => usd(row.lost), mono: true, align: "right", wide: true },
            { key: "pending", header: "Pending", cell: (row) => usd(row.pending), mono: true, align: "right", wide: true },
            { key: "margin", header: "Margin", cell: (row) => usd(row.margin), mono: true, align: "right" },
          ]}
        />
      </Panel>
    </ConsolePage>
  );
}
