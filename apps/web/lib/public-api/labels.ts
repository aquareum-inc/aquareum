import "server-only";

import type { AgentModelEntry, CapabilityLabel } from "@aquareum/api-client";
import { agentModelEntries, appName, workLabel } from "@aquareum/user-app/capability-menu";

import { apiFor } from "../api";
import { appModels } from "../models";

/**
 * The readable name of each capability on offer. The naming rules live in one place
 * (`capability-menu.ts`), so clients that can't run them, such as the native apps, ask for the result.
 */
export async function capabilityLabels(): Promise<CapabilityLabel[]> {
  const offerings = (await apiFor(null).listOfferings()).data;
  const models = new Map((await appModels(offerings)).data.map((model) => [model.app, model]));
  return [...new Set(offerings.map((offering) => offering.app))].map((app) => ({ app, name: appName(app, models.get(app)), work: workLabel(app, models.get(app)) }));
}

/** The agent's model menu, one row per model, by the same rules as the web's (`agentModelEntries`). */
export async function agentModelMenu(): Promise<AgentModelEntry[]> {
  const models = (await apiFor(null).listAgentModels()).data;
  return agentModelEntries(models).map((entry) => ({ ...entry, also: entry.also ?? [] }));
}
