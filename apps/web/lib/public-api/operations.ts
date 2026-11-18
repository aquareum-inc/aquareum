import type { ApiClient, OperatorClient } from "@aquareum/api-client";

type Schema = Record<string, unknown>;

interface Context {
  client: ApiClient;
  /** Present for callers with the operator role. */
  operator: OperatorClient | null;
}

export interface Operation {
  /** Tool name over MCP. */
  name: string;
  description: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** REST path under /api/v1; `{name}` segments become inputs. */
  path: string;
  input: Schema;
  operator?: boolean;
  run: (context: Context, input: Record<string, unknown>) => Promise<unknown>;
}

const object = (properties: Schema, required: string[] = []): Schema => ({ type: "object", properties, required, additionalProperties: false });
const text = (description: string): Schema => ({ type: "string", description });
const str = (input: Record<string, unknown>, key: string): string => String(input[key] ?? "");
const aspect = { enum: ["16:9", "9:16", "1:1"], default: "16:9" };

const operator = (context: Context): OperatorClient => {
  if (!context.operator) throw new ApiError(403, "This operation needs the operator role.");
  return context.operator;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const found = <T>(value: T | null, what: string): T => {
  if (value === null) throw new ApiError(404, `${what} not found`);
  return value;
};

/**
 * Every operation the instance exposes to agents and developers. The REST API and the MCP
 * server are both generated from this list, and each entry calls one API client function, so the
 * API can do exactly what the interface can.
 */
export const OPERATIONS: Operation[] = [
  { name: "list_capabilities", description: "List the capabilities discovered on the network that this instance offers.", method: "GET", path: "/offerings", input: object({}), run: async ({ client }) => (await client.listOfferings()).data },
  { name: "run_capability", description: "Run any discovered capability with a request body of your own.", method: "POST", path: "/run", input: object({ app: text("Capability name from list_capabilities"), request: { type: "object", description: "The request body for the capability" } }, ["app"]), run: async ({ client }, input) => (await client.runCapability(str(input, "app"), input.request ?? {})).data },
  {
    name: "create_generation",
    description: "Generate a video, image or audio clip. Returns a job to poll with get_generation.",
    method: "POST",
    path: "/generations",
    input: object(
      { kind: { enum: ["video", "image", "audio"] }, app: text("Capability to use, e.g. text-to-video"), prompt: text("What to make"), aspect, duration_seconds: { type: ["number", "null"] }, resolution: { enum: ["720p", "1080p", null] }, negative_prompt: text("What to leave out") },
      ["kind", "app", "prompt"],
    ),
    run: async ({ client }, input) =>
      (
        await client.createGeneration({
          kind: input.kind as "video" | "image" | "audio",
          app: str(input, "app"),
          prompt: str(input, "prompt"),
          aspect: (input.aspect as "16:9" | "9:16" | "1:1" | undefined) ?? "16:9",
          duration_seconds: typeof input.duration_seconds === "number" ? input.duration_seconds : input.kind === "image" ? null : 5,
          resolution: input.kind === "video" ? ((input.resolution as "720p" | "1080p" | undefined) ?? "720p") : null,
          ...(input.negative_prompt ? { negative_prompt: str(input, "negative_prompt") } : {}),
        })
      ).data,
  },
  { name: "get_generation", description: "Check a generation's state and progress.", method: "GET", path: "/generations/{id}", input: object({ id: text("Generation id") }, ["id"]), run: async ({ client }, input) => found((await client.getGeneration(str(input, "id"))).data, "Generation") },
  { name: "list_conversations", description: "List the user's conversations with the agent, newest first.", method: "GET", path: "/conversations", input: object({}), run: async ({ client }) => (await client.listConversations()).data },
  {
    name: "create_conversation",
    description: "Start a conversation with the agent. It plans the job, calls capabilities and reports each step.",
    method: "POST",
    path: "/conversations",
    input: object({ text: text("The request"), app: text("Optional capability to use"), aspect, duration_seconds: { type: "number", default: 5 }, attachment_ids: { type: "array", items: { type: "string" }, description: "Library item ids to work from" } }, ["text"]),
    run: async ({ client }, input) => (await client.createConversation(message(input))).data,
  },
  { name: "get_conversation", description: "Read a conversation, including the agent's steps, results and any video analysis.", method: "GET", path: "/conversations/{id}", input: object({ id: text("Conversation id") }, ["id"]), run: async ({ client }, input) => found((await client.getConversation(str(input, "id"))).data, "Conversation") },
  { name: "send_message", description: "Send a follow-up message in a conversation.", method: "POST", path: "/conversations/{id}/messages", input: object({ id: text("Conversation id"), text: text("The message"), attachment_ids: { type: "array", items: { type: "string" } } }, ["id", "text"]), run: async ({ client }, input) => found((await client.sendMessage(str(input, "id"), message(input))).data, "Conversation") },
  { name: "search_library", description: "Search the user's media by what is in it: subjects, places, actions, tags.", method: "GET", path: "/library", input: object({ query: text("What to look for"), kind: { enum: ["video", "image", "audio"] } }), run: async ({ client }, input) => (await client.listMedia({ ...(input.query ? { query: str(input, "query") } : {}), ...(input.kind ? { kind: input.kind as "video" | "image" | "audio" } : {}) })).data },
  { name: "delete_media", description: "Delete an item from the library. This can't be undone.", method: "DELETE", path: "/library/{id}", input: object({ id: text("Library item id") }, ["id"]), run: async ({ client }, input) => ({ deleted: (await client.deleteMedia(str(input, "id"))).data }) },
  { name: "understand_video", description: "Ask about a video: summarise it, find moments, answer a question.", method: "POST", path: "/understand", input: object({ source: text("A URL or a library item id"), question: text("What to find out") }, ["source", "question"]), run: async ({ client }, input) => (await client.analyseVideo({ source: str(input, "source"), question: str(input, "question") })).data },
  { name: "list_characters", description: "List characters the user can chat with or call.", method: "GET", path: "/characters", input: object({ query: text("Filter by name, role or subject") }), run: async ({ client }, input) => (await client.listCharacters(input.query ? { query: str(input, "query") } : {})).data },
  { name: "get_balance", description: "The user's credit balance and budget.", method: "GET", path: "/balance", input: object({}), run: async ({ client }) => (await client.getCreditBalance()).data },
  { name: "get_usage", description: "What the user has spent, by capability, and recent jobs.", method: "GET", path: "/usage", input: object({}), run: async ({ client }) => (await client.getUsage()).data },
  {
    name: "open_session",
    description: "Open a real-time session, such as a live restyle of a camera. It stays open and is billed by the second until closed.",
    method: "POST",
    path: "/sessions",
    input: object({ app: text("A persistent capability, e.g. live-video-to-video"), prompt: text("The look or instruction"), destination_ids: { type: "array", items: { type: "string" } }, record: { type: "boolean", default: false } }, ["app", "prompt"]),
    run: async ({ client }, input) =>
      (await client.startLiveSession({ app: str(input, "app"), source: "camera", prompt: str(input, "prompt"), destination_ids: Array.isArray(input.destination_ids) ? input.destination_ids.map(String) : [], record: input.record === true })).data,
  },
  { name: "update_session", description: "Change a running session's prompt without closing it.", method: "PATCH", path: "/sessions/{id}", input: object({ id: text("Session id"), prompt: text("The new look or instruction") }, ["id", "prompt"]), run: async ({ client }, input) => found((await client.updateLiveSession(str(input, "id"), str(input, "prompt"))).data, "Session") },
  { name: "close_session", description: "Close a real-time session.", method: "DELETE", path: "/sessions/{id}", input: object({ id: text("Session id") }, ["id"]), run: async ({ client }, input) => found((await client.stopLiveSession(str(input, "id"))).data, "Session") },

  // Operator: administering the instance without the console.
  { name: "operator_overview", description: "Operator: active users, jobs today, revenue, wholesale cost and margin.", method: "GET", path: "/operator/overview", input: object({}), operator: true, run: async (context) => (await operator(context).getOverview()).data },
  { name: "operator_health", description: "Operator: engine readiness, discovery freshness, cost sync and version.", method: "GET", path: "/operator/health", input: object({}), operator: true, run: async (context) => (await operator(context).getEngineHealth()).data },
  { name: "operator_list_users", description: "Operator: every account the engine knows, with its allocation.", method: "GET", path: "/operator/users", input: object({}), operator: true, run: async (context) => (await operator(context).listActors()).data },
  { name: "operator_set_user_status", description: "Operator: suspend (pause) or resume a user's allocation.", method: "POST", path: "/operator/users/{id}/status", input: object({ id: text("Actor id"), status: { enum: ["active", "paused"] }, application_id: { type: "string", default: "default" } }, ["id", "status"]), operator: true, run: async (context, input) => ({ ok: (await operator(context).setActorStatus(str(input, "application_id") || "default", str(input, "id"), input.status === "paused" ? "paused" : "active")).data }) },
  { name: "operator_top_up_user", description: "Operator: add credit to a user's allocation, as a one-off adjustment.", method: "POST", path: "/operator/users/{id}/top-up", input: object({ id: text("User id"), amount_usd: { type: "number", exclusiveMinimum: 0 } }, ["id", "amount_usd"]), operator: true, run: async (context, input) => operator(context).provider.budgets.topUpAllocation(str(input, "id"), { amount: Number(input.amount_usd).toFixed(2), currency: "USD" }) },
  { name: "operator_assign_plan", description: "Operator: assign a plan to a user, or remove it with a null plan_id.", method: "POST", path: "/operator/users/{id}/plan", input: object({ id: text("User id"), plan_id: { type: ["string", "null"] } }, ["id"]), operator: true, run: async (context, input) => ({ plan: await operator(context).provider.plans.assignPlan(str(input, "id"), typeof input.plan_id === "string" ? input.plan_id : null) }) },
  { name: "operator_list_jobs", description: "Operator: recent jobs across all users, with attempts and failures.", method: "GET", path: "/operator/jobs", input: object({ limit: { type: "number", default: 50 } }), operator: true, run: async (context, input) => (await operator(context).listJobs(Number(input.limit) || 50)).data },
  { name: "operator_costs", description: "Operator: wholesale network cost by class and capability over a number of days.", method: "GET", path: "/operator/costs", input: object({ days: { type: "number", default: 30 } }), operator: true, run: async (context, input) => (await operator(context).getCostSummary(Number(input.days) || 30)).data },
  { name: "operator_list_grants", description: "Operator: grants and their funding.", method: "GET", path: "/operator/grants", input: object({}), operator: true, run: async (context) => operator(context).provider.budgets.listGrants() },
  { name: "operator_create_grant", description: "Operator: create a grant with initial funding.", method: "POST", path: "/operator/grants", input: object({ label: text("Grant name"), amount_usd: { type: "number", exclusiveMinimum: 0 } }, ["label", "amount_usd"]), operator: true, run: async (context, input) => operator(context).provider.budgets.createGrant({ label: str(input, "label"), amount: { amount: Number(input.amount_usd).toFixed(2), currency: "USD" } }) },
  { name: "operator_list_plans", description: "Operator: the provider's plans and allowances.", method: "GET", path: "/operator/plans", input: object({}), operator: true, run: async (context) => operator(context).provider.plans.listPlans() },
  { name: "operator_list_keys", description: "Operator: engine access keys.", method: "GET", path: "/operator/keys", input: object({}), operator: true, run: async (context) => (await operator(context).listAccessKeys()).data },
  { name: "operator_set_capability", description: "Operator: enable or disable a capability, set its markup or the surfaces it appears in.", method: "PATCH", path: "/operator/capabilities", input: object({ app: text("Capability name"), enabled: { type: "boolean" }, markup: { type: ["number", "null"] }, surfaces: { type: ["array", "null"], items: { type: "string" } } }, ["app"]), operator: true, run: async (context, input) => (await operator(context).updateCapabilitySetting(str(input, "app"), { ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}), ...(input.markup === null || typeof input.markup === "number" ? { markup: input.markup } : {}), ...(input.surfaces === null || Array.isArray(input.surfaces) ? { surfaces: input.surfaces === null ? null : input.surfaces.map(String) } : {}) })).data },
];

function message(input: Record<string, unknown>) {
  return {
    text: str(input, "text"),
    app: typeof input.app === "string" && input.app ? input.app : null,
    aspect: (input.aspect as "16:9" | "9:16" | "1:1" | undefined) ?? "16:9",
    duration_seconds: typeof input.duration_seconds === "number" ? input.duration_seconds : 5,
    ...(Array.isArray(input.attachment_ids) ? { attachment_ids: input.attachment_ids.map(String) } : {}),
  };
}

/** Finds the operation for a REST request and extracts its path inputs. */
export function matchOperation(method: string, segments: string[]): { operation: Operation; params: Record<string, string> } | null {
  for (const operation of OPERATIONS) {
    if (operation.method !== method) continue;
    const pattern = operation.path.split("/").filter(Boolean);
    if (pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    const matches = pattern.every((part, index) => {
      const segment = segments[index] as string;
      if (part.startsWith("{")) {
        params[part.slice(1, -1)] = decodeURIComponent(segment);
        return true;
      }
      return part === segment;
    });
    if (matches) return { operation, params };
  }
  return null;
}
