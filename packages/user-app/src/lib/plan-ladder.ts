import type { Plan } from "@aquareum/api-client/provider";

export interface Rung {
  plan: Plan;
  /** 1 for the cheapest plan. */
  tier: number;
  tiers: number;
  /** This plan's allowance against the largest one, 0 to 1. */
  scale: number;
  /** The plan below, whose features this one includes. */
  previous: Plan | null;
  /** The features this plan has that the one below doesn't. */
  additions: string[];
}

/**
 * Plans as a ladder, cheapest first: each rung knows its tier, its allowance against the largest,
 * and what it adds to the rung below, so a card can say "Everything in Creator, plus" and list
 * only what's new. Providers give each plan a flat feature list; repeats of the plan below are
 * dropped here.
 */
export function planLadder(plans: ReadonlyArray<Plan>): Rung[] {
  const sorted = [...plans].sort((a, b) => Number(a.price.amount) - Number(b.price.amount));
  const largest = Math.max(1, ...sorted.map((plan) => plan.allowance.credits));
  return sorted.map((plan, index) => {
    const previous = sorted[index - 1] ?? null;
    return {
      plan,
      tier: index + 1,
      tiers: sorted.length,
      scale: plan.allowance.credits / largest,
      previous,
      additions: previous ? plan.features.filter((feature) => !previous.features.includes(feature)) : [...plan.features],
    };
  });
}
