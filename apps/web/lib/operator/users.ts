import "server-only";

import type { Allocation, DataSource, OperatorClient, Plan } from "@livepeer/api-client";
import { joinUserRows, type JoinedUsers } from "./user-rows";

/** The provider's people joined with their engine accounts, budgets and plans, and the engine accounts no one owns. */
export async function userRows(client: OperatorClient): Promise<JoinedUsers & { sources: Array<{ name: string; source: DataSource }> }> {
  const { provider } = client;
  const [actors, users] = await Promise.all([client.listActors(), provider.features.users ? provider.identity.listUsers() : Promise.resolve([])]);
  const ids = [...new Set([...users.map((user) => user.id), ...actors.data.map((actor) => actor.actor_id)])];
  const allocations = new Map<string, Allocation | null>();
  const plans = new Map<string, Plan | null>();
  await Promise.all(
    ids.map(async (id) => {
      const [allocation, plan] = await Promise.all([
        provider.budgets.getAllocation(id).catch(() => null),
        provider.plans.getUserPlan(id).catch(() => null),
      ]);
      allocations.set(id, allocation);
      plans.set(id, plan);
    }),
  );
  const providerSource: DataSource = provider.id === "mock" ? "mock" : "live";
  return {
    ...joinUserRows({ listsUsers: provider.features.users, users, actors: actors.data, allocationFor: (id) => allocations.get(id) ?? null, planFor: (id) => plans.get(id) ?? null }),
    sources: [
      { name: "identity.listUsers", source: providerSource },
      { name: "listActors", source: actors.source },
      { name: "budgets.getAllocation", source: providerSource },
      { name: "plans.getUserPlan", source: "mock" },
    ],
  };
}
