import "server-only";

import { createBatteriesProvider, createMockProvider, createOperatorClient, type OperatorClient, type PaymentProvider } from "@aquareum/api-client";

import { getSession } from "../auth/session";
import { env } from "../env";
import { instance } from "../instance";

let mockProvider: PaymentProvider | null = null;

export function pricing() {
  const config = instance().pricing;
  return { creditsPerUsd: config?.creditsPerUsd ?? 100, default: config?.markup?.default ?? 1.3, perApp: config?.markup?.perApp ?? {} };
}

/** The payment provider this instance is configured for. */
export function paymentProvider(): PaymentProvider {
  const url = instance().engine?.url ?? env("ENGINE_URL");
  const mockOnly = env("MOCK_ONLY") === "1" || env("MOCK_ONLY") === "true";
  if (instance().payments?.provider === "batteries" && url && !mockOnly) {
    const reader = env("ENGINE_READER_TOKEN");
    const admin = env("ENGINE_ADMIN_TOKEN");
    return createBatteriesProvider({ url, ...(reader ? { reader } : {}), ...(admin ? { admin } : {}) });
  }
  return (mockProvider ??= createMockProvider());
}

/**
 * The operator's API client. Refuses anyone who isn't a signed-in operator, so every console
 * read and action is guarded here as well as in the proxy and the layout.
 */
export async function operatorApi(): Promise<OperatorClient> {
  const session = await getSession();
  if (session?.role !== "operator") throw new Error("Operator role required");
  return buildOperatorClient();
}

/** Builds the operator client. Callers must have checked the operator role first. */
export function buildOperatorClient(): OperatorClient {
  const url = instance().engine?.url ?? env("ENGINE_URL");
  const reader = env("ENGINE_READER_TOKEN");
  const admin = env("ENGINE_ADMIN_TOKEN");
  const mockOnly = env("MOCK_ONLY");
  return createOperatorClient({
    ...(url ? { engine: { url, ...(reader ? { reader } : {}), ...(admin ? { admin } : {}) } } : {}),
    provider: paymentProvider(),
    env: mockOnly ? { MOCK_ONLY: mockOnly } : {},
    pricing: pricing(),
  });
}
