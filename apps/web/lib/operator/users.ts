import "server-only";

import type { OperatorClient } from "@aquareum/api-client";
import type { UserRow } from "@aquareum/operator-console";

/** Joins the engine's actors with the provider's users, budgets and plans. */
export async function userRows(client: OperatorClient): Promise<{ rows: UserRow[]; live: boolean }> {
  const { provider } = client;
  const actors = await client.listActors();
  const users = provider.features.users ? await provider.identity.listUsers() : [];
  const rows = await Promise.all(
    actors.data.map(async (actor): Promise<UserRow> => {
      const user = users.find((entry) => entry.id === actor.actor_id);
      const [allocation, plan] = await Promise.all([
        provider.budgets.getAllocation(actor.actor_id).catch(() => null),
        provider.plans.getUserPlan(actor.actor_id).catch(() => null),
      ]);
      return {
        id: actor.actor_id,
        applicationId: actor.application_id,
        name: user?.name ?? (actor.label || actor.name || actor.actor_id),
        email: user?.email ?? null,
        role: user?.role ?? "user",
        status: allocation?.status ?? actor.allocation?.status ?? (actor.provisioned ? "active" : "not provisioned"),
        plan: plan?.name ?? null,
        budget: allocation ? Number(allocation.granted.amount) : null,
        spent: allocation ? Number(allocation.spent.amount) : null,
        remaining: allocation ? Number(allocation.available.amount) : null,
        lastSeen: actor.last_seen_at,
      };
    }),
  );
  return { rows, live: actors.source === "live" };
}
