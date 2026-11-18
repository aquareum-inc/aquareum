import "server-only";

import type { KnownActor, OperatorClient } from "@aquareum/api-client";

/** Display names for actors: the provider's user name, else the engine's label, else the id. */
export async function actorNames(client: OperatorClient, actors: KnownActor[]): Promise<Record<string, string>> {
  const users = client.provider.features.users ? await client.provider.identity.listUsers() : [];
  const names: Record<string, string> = {};
  for (const actor of actors) names[actor.actor_id] = actor.label || actor.name || actor.actor_id;
  for (const user of users) names[user.id] = user.name;
  return names;
}
