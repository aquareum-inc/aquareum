import type { Plan } from "@aquareum/api-client/provider";
import { describe, expect, it } from "vitest";

import { planLadder } from "./plan-ladder";

function plan(id: string, price: number, credits: number, features: string[]): Plan {
  return { id, name: id, description: "", price: { amount: price.toFixed(2), currency: "USD" }, interval: "month", allowance: { credits, period: "month", rollover_months: 0 }, features, markup: null, active: true };
}

describe("plan ladder", () => {
  it("orders plans by price, scales allowances against the largest, and lists only what each adds", () => {
    const ladder = planLadder([
      plan("studio", 68, 9000, ["Every capability", "Priority in the queue"]),
      plan("creator", 18, 2000, ["Every capability", "API access"]),
      plan("network", 200, 30000, ["Priority in the queue", "Higher limits"]),
    ]);
    expect(ladder.map((rung) => [rung.plan.id, rung.tier, rung.tiers, rung.previous?.id ?? null])).toEqual([
      ["creator", 1, 3, null],
      ["studio", 2, 3, "creator"],
      ["network", 3, 3, "studio"],
    ]);
    expect(ladder.map((rung) => rung.scale)).toEqual([2000 / 30000, 9000 / 30000, 1]);
    expect(ladder.map((rung) => rung.additions)).toEqual([["Every capability", "API access"], ["Priority in the queue"], ["Higher limits"]]);
  });
});
