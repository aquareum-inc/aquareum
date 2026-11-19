import type { Allocation, KnownActor, Plan, ProviderUser } from "@aquareum/api-client";
import type { UserRow } from "@aquareum/operator-console";

/** The engine's default application, where accounts live unless the instance names another. */
const DEFAULT_APPLICATION = "default";

export interface UserSources {
  /** The provider's people, or none when the provider can't list them. */
  users: ReadonlyArray<ProviderUser>;
  /** The engine's builder accounts. */
  actors: ReadonlyArray<KnownActor>;
  allocationFor: (id: string) => Allocation | null;
  planFor: (id: string) => Plan | null;
}

function row(id: string, user: ProviderUser | null, actor: KnownActor | null, sources: UserSources): UserRow {
  const allocation = sources.allocationFor(id);
  return {
    id,
    applicationId: actor?.application_id ?? DEFAULT_APPLICATION,
    name: user?.name ?? (actor ? actor.label || actor.name || actor.actor_id : id),
    email: user?.email ?? null,
    role: user?.role ?? "user",
    status: allocation?.status ?? actor?.allocation?.status ?? (actor ? (actor.provisioned ? "active" : "not provisioned") : (user?.status ?? "active")),
    plan: sources.planFor(id)?.name ?? null,
    budget: allocation ? Number(allocation.granted.amount) : null,
    spent: allocation ? Number(allocation.spent.amount) : null,
    remaining: allocation ? Number(allocation.available.amount) : null,
    lastSeen: actor?.last_seen_at ?? null,
  };
}

/**
 * The people on this instance. The provider's users come first, each joined to its engine account by
 * id. Engine accounts that no user owns follow, so nothing the engine holds is hidden; with a
 * provider that can't list users, those accounts are all there is.
 */
export function joinUserRows(sources: UserSources): UserRow[] {
  const actors = new Map(sources.actors.map((actor) => [actor.actor_id, actor]));
  const owned = new Set(sources.users.map((user) => user.id));
  return [
    ...sources.users.map((user) => row(user.id, user, actors.get(user.id) ?? null, sources)),
    ...sources.actors.filter((actor) => !owned.has(actor.actor_id)).map((actor) => row(actor.actor_id, null, actor, sources)),
  ];
}
