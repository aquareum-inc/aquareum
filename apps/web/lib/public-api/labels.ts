import "server-only";

import type { AgentModelEntry, CapabilityLabel, StudioMedium } from "@aquareum/api-client";
import { agentModelEntries, appName, modelLabel, workLabel } from "@aquareum/user-app/capability-menu";
import { describeStudio } from "@aquareum/user-app/studio-mediums";

import { apiFor } from "../api";
import { appModels } from "../models";

/**
 * The readable name of each capability on offer, and of each model the agent can run on. The naming rules live in one place
 * (`capability-menu.ts`), so clients that can't run them, such as the native apps, ask for the result.
 */
export async function capabilityLabels(): Promise<CapabilityLabel[]> {
  const offerings = (await apiFor(null).listOfferings()).data;
  const models = new Map((await appModels(offerings)).data.map((model) => [model.app, model]));
  const labels = [...new Set(offerings.map((offering) => offering.app))].map((app) => ({ app, name: appName(app, models.get(app)), work: workLabel(app, models.get(app)) }));
  // The language models the agent runs on are named too, as its model menu names them: a step the agent
  // planned names the model it used.
  const known = new Set(labels.map((label) => label.app));
  const agent = (await apiFor(null).listAgentModels()).data.filter((model) => !known.has(model.app));
  return [...labels, ...agent.map((model) => ({ app: model.app, name: modelLabel(model.model), work: modelLabel(model.model) }))];
}

/** The agent's model menu, one row per model, by the same rules as the web's (`agentModelEntries`). */
export async function agentModelMenu(): Promise<AgentModelEntry[]> {
  const models = (await apiFor(null).listAgentModels()).data;
  return agentModelEntries(models).map((entry) => ({ ...entry, also: entry.also ?? [] }));
}

/** The studio's mediums and modes, as the web's studio has them, against what the network offers now. */
export async function studioMediums(): Promise<StudioMedium[]> {
  return describeStudio((await apiFor(null).listOfferings()).data);
}
