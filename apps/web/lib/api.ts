import "server-only";

import { createApiClient, type ApiClient } from "@aquareum/api-client";

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

/** The API client for a known user, or the instance's default account when there is none. */
export function apiFor(user: { id: string; name: string } | null): ApiClient {
  const config = instance();
  const url = config.engine?.url ?? env("ENGINE_URL");
  const mockOnly = env("MOCK_ONLY");
  return createApiClient({
    ...(url ? { engine: { url } } : {}),
    describeApps: async (apps) => (await describeApps(apps)).data,
    env: mockOnly ? { MOCK_ONLY: mockOnly } : {},
    ...(user ? { user } : {}),
    pricing: {
      creditsPerUsd: config.pricing?.creditsPerUsd ?? 100,
      default: config.pricing?.markup?.default ?? 1.3,
      ...(config.pricing?.markup?.perApp ? { perApp: config.pricing.markup.perApp } : {}),
    },
  });
}
