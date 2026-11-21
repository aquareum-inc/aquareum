import "server-only";

import { createApiClient, type ApiClient } from "@aquareum/api-client";
import { isCapabilityEnabled } from "@aquareum/config";

import { getSession } from "./auth/session";
import { env } from "./env";
import { instance } from "./instance";
import { describeApps } from "./models";

/**
 * The API client for the signed-in user. Discovery is public, so it is read without a
 * credential; everything else is called on the user's behalf from the server.
 */
export async function api(): Promise<ApiClient> {
  const session = await getSession();
  return apiFor(session ? { id: session.userId, name: session.name } : null);
}

/**
 * The API client for a known user, or the instance's default account when there is none. It lists and runs only
 * what the instance offers; `network` lists everything discovered, for comparing the two (the studio uses it to
 * tell a mode the operator withdrew from one no operator offers yet). Never run anything with a `network` client.
 */
export function apiFor(user: { id: string; name: string } | null, scope: "offered" | "network" = "offered"): ApiClient {
  const config = instance();
  const url = config.engine?.url ?? env("ENGINE_URL");
  const mockOnly = env("MOCK_ONLY");
  return createApiClient({
    ...(url ? { engine: { url } } : {}),
    describeApps: async (apps) => (await describeApps(apps)).data,
    env: mockOnly ? { MOCK_ONLY: mockOnly } : {},
    ...(scope === "offered" ? { offers: (app: string) => isCapabilityEnabled(app, instance().capabilities) } : {}),
    ...(user ? { user } : {}),
    pricing: {
      creditsPerUsd: config.pricing?.creditsPerUsd ?? 100,
      default: config.pricing?.markup?.default ?? 1.3,
      ...(config.pricing?.markup?.perApp ? { perApp: config.pricing.markup.perApp } : {}),
    },
  });
}
