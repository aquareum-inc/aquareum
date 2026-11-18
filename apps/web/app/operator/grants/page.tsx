import { EngineError, type Grant } from "@aquareum/api-client";
import { GrantsView } from "@aquareum/operator-console";
import type { Metadata } from "next";

import { createGrantAction, fundGrantAction } from "@/lib/operator/actions";
import { operatorApi } from "@/lib/operator/client";

export const metadata: Metadata = { title: "Grants" };

export default async function GrantsPage() {
  const { provider } = await operatorApi();
  let grants: Grant[] = [];
  let unavailable: string | null = null;
  try {
    grants = await provider.budgets.listGrants();
  } catch (error) {
    unavailable =
      error instanceof EngineError && (error.status === 401 || error.status === 403)
        ? "The engine refused to list grants with the configured admin token. ENGINE_ADMIN_TOKEN must be an admin key; the one in .env is not. See System for the check."
        : "Grants couldn't be read from the engine. Check the connection on the System page.";
  }
  return (
    <GrantsView
      grants={grants}
      unavailable={unavailable}
      create={createGrantAction}
      fund={fundGrantAction}
      sources={[{ name: "budgets.listGrants", source: provider.id === "mock" ? "mock" : "live" }]}
    />
  );
}
