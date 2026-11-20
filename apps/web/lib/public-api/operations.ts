import type { AgentModelEntry, ApiClient, CapabilityLabel, Character, ReportReason, DeviceSession, GenerationRequest, StudioMedium, DeviceToken, InstanceDescription, OperatorClient } from "@aquareum/api-client";

import type { Moderation } from "../moderation/moderation";

type Schema = Record<string, unknown>;

/** A signed-in person: through a browser session, or a device session from the native apps. */
export interface Account {
  user: { id: string; name: string; email: string | null };
  /** The device session making the request, when it comes from an app. */
  deviceId: string | null;
}

/** The instance's device sessions, as the operations use them. */
export interface DeviceAccess {
  redeemCode(input: { code: string; verifier: string; deviceName: string; platform: "ios" | "android" }): DeviceToken | null;
  list(userId: string, currentId: string | null): DeviceSession[];
  revoke(userId: string, id: string): boolean;
  /** Ends every device session a user has. */
  revokeAll(userId: string): number;
}

interface Context {
  client: ApiClient;
  /** Present for callers with the operator role. */
  operator: OperatorClient | null;
  /** Who is signed in. API keys, the operator token and guests have no account. */
  account: Account | null;
  devices: DeviceAccess;
  /** Reports, blocks and characters taken down. */
  moderation: Moderation;
  /** This instance, as it describes itself to clients. */
  instance: InstanceDescription;
  /** The readable name of each capability on offer, as the interface shows it. */
  labels: () => Promise<CapabilityLabel[]>;
  /** The agent's model menu, as the interface shows it. */
  agentModelMenu: () => Promise<AgentModelEntry[]>;
  /** The studio's mediums and modes, as the interface shows them. */
  studioMediums: () => Promise<StudioMedium[]>;
  /** What one result of a draft would cost, in credits, as the web's studio quotes it. */
  quote: (request: GenerationRequest) => number;
}

/**
 * The exported API client type an operation answers with, or a one-element list for an array of it.
 * The OpenAPI document and the native clients' models are generated from these names.
 */
export type Output = string | [string];

export interface Operation {
  /** Tool name over MCP. */
  name: string;
  description: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** REST path under /api/v1; `{name}` segments become inputs. */
  path: string;
  input: Schema;
  /** What it answers with. Operator operations may leave it out; they are not in the generated clients. */
  output?: Output;
  operator?: boolean;
  /** Answers without a caller, as the instance's default account: what a guest can see on the web. */
  public?: boolean;
  /** Left out of the MCP server: sign-in plumbing for the native apps, which agents have no use for. */
  mcp?: false;
  run: (context: Context, input: Record<string, unknown>) => Promise<unknown>;
}

const object = (properties: Schema, required: string[] = []): Schema => ({ type: "object", properties, required, additionalProperties: false });
const text = (description: string): Schema => ({ type: "string", description });
const str = (input: Record<string, unknown>, key: string): string => String(input[key] ?? "");
const REPORT_REASONS: readonly ReportReason[] = ["sexual", "hateful", "violent", "impersonation", "spam", "other"];
const aspect = { enum: ["16:9", "9:16", "1:1"], default: "16:9" };

const operator = (context: Context): OperatorClient => {
  if (!context.operator) throw new ApiError(403, "This operation needs the operator role.");
  return context.operator;
};

export class ApiError extends Error {
  readonly status: number;
  /** A stable reason a client can act on, such as `mobile_off`. */
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const signedIn = (context: Context): Account => {
  if (!context.account) throw new ApiError(403, "This needs a signed-in person, not an API key.", "account_required");
  return context.account;
};

const found = <T>(value: T | null, what: string): T => {
  if (value === null) throw new ApiError(404, `${what} not found`);
  return value;
};

/** A character this caller may see: not for adults only, not taken down, not blocked. */
async function character(context: Context, slug: string): Promise<Character> {
  const value = (await context.client.getCharacter(slug)).data;
  if (!value || value.mature || !context.moderation.visible(context.account?.user.id ?? null)(value)) throw new ApiError(404, "Character not found");
  return value;
}

/** A character someone else shared, which is what can be reported or blocked. */
async function shared(context: Context, slug: string): Promise<Character> {
  const value = await character(context, slug);
  if (value.mine) throw new ApiError(400, "That character is yours.");
  return value;
}

/**
 * Every operation the instance exposes to agents and developers. The REST API and the MCP
 * server are both generated from this list, and each entry calls one API client function, so the
 * API can do exactly what the interface can.
 */
export const OPERATIONS: Operation[] = [
  { name: "get_instance", description: "Describe this instance: its name, logo and theme, what it serves, how to sign in and its content settings.", method: "GET", path: "/instance", output: "InstanceDescription", public: true, input: object({}), run: async ({ instance }) => instance },
  {
    name: "create_device_session",
    description: "Native apps: collect a finished sign-in with the one-time code from the sign-in callback and the PKCE verifier. Answers with a device session token, shown once.",
    method: "POST",
    path: "/auth/device",
    output: "DeviceToken",
    public: true,
    mcp: false,
    input: object({ code: text("The code from the sign-in callback"), verifier: text("The PKCE verifier whose challenge started the sign-in"), platform: { enum: ["ios", "android"] }, device_name: text("The device's own name, shown in the list of devices") }, ["code", "verifier", "platform"]),
    run: async ({ devices }, input) => {
      const token = devices.redeemCode({ code: str(input, "code"), verifier: str(input, "verifier"), deviceName: str(input, "device_name"), platform: input.platform === "android" ? "android" : "ios" });
      if (!token) throw new ApiError(400, "That sign-in expired or was already used. Sign in again.", "sign_in_expired");
      return token;
    },
  },
  {
    name: "end_device_session",
    description: "Native apps: sign this device out by ending the device session making the request.",
    method: "DELETE",
    path: "/auth/device",
    output: "Deleted",
    mcp: false,
    input: object({}),
    run: async (context) => {
      const { user, deviceId } = signedIn(context);
      if (!deviceId) throw new ApiError(400, "Only a device session can sign itself out here.");
      return { deleted: context.devices.revoke(user.id, deviceId) };
    },
  },
  {
    name: "get_me",
    description: "The signed-in person: their name, email and credit balance.",
    method: "GET",
    path: "/me",
    output: "Me",
    input: object({}),
    run: async (context) => ({ ...signedIn(context).user, balance: (await context.client.getCreditBalance()).data }),
  },
  { name: "list_devices", description: "List the phones and tablets signed in to the person's account, most recently used first.", method: "GET", path: "/devices", output: ["DeviceSession"], input: object({}), run: async (context) => { const { user, deviceId } = signedIn(context); return context.devices.list(user.id, deviceId); } },
  {
    name: "revoke_device",
    description: "Sign one of the person's devices out. The app on it returns to signed out on its next request.",
    method: "DELETE",
    path: "/devices/{id}",
    output: "Deleted",
    input: object({ id: text("Device session id, from list_devices") }, ["id"]),
    run: async (context, input) => {
      if (!context.devices.revoke(signedIn(context).user.id, str(input, "id"))) throw new ApiError(404, "Device not found");
      return { deleted: true };
    },
  },
  { name: "list_prompt_starters", description: "List the starting points shown on Home, each with example requests.", method: "GET", path: "/starters", output: ["PromptStarter"], public: true, input: object({}), run: async ({ client }) => (await client.listPromptStarters()).data },
  { name: "list_showcase", description: "List the examples in the instance's gallery, each with the request that made it.", method: "GET", path: "/showcase", output: ["ShowcaseItem"], public: true, input: object({}), run: async ({ client }) => (await client.listShowcase()).data },
  { name: "list_agent_models", description: "List the language models the agent can run on, for the model menu.", method: "GET", path: "/agent-models", output: ["AgentModel"], public: true, input: object({}), run: async ({ client }) => (await client.listAgentModels()).data },
  { name: "list_agent_model_menu", description: "List the agent's model menu as the interface shows it: one row per language model, named and described, with the app to send as agent_model. Hidden when there are fewer than two rows.", method: "GET", path: "/agent-models/menu", output: ["AgentModelEntry"], public: true, input: object({}), run: async ({ agentModelMenu }) => agentModelMenu() },
  { name: "list_capability_labels", description: "List the readable name of each capability on offer and each model the agent can run on, as the interface shows it, with the model that does the work when known.", method: "GET", path: "/offerings/labels", output: ["CapabilityLabel"], public: true, input: object({}), run: async ({ labels }) => labels() },
  { name: "list_capabilities", description: "List the capabilities discovered on the network that this instance offers.", method: "GET", path: "/offerings", output: ["Offering"], public: true, input: object({}), run: async ({ client }) => (await client.listOfferings()).data },
  { name: "run_capability", description: "Run any discovered capability with a request body of your own.", method: "POST", path: "/run", output: "CapabilityRun", input: object({ app: text("Capability name from list_capabilities"), request: { type: "object", description: "The request body for the capability" } }, ["app"]), run: async ({ client }, input) => (await client.runCapability(str(input, "app"), input.request ?? {})).data },
  { name: "list_studio_mediums", description: "List the studio's mediums (video, image, audio) as the interface shows them: each one's modes, with the capability each mode runs and whether it is on offer, and its shapes, lengths and resolutions.", method: "GET", path: "/studio", output: ["StudioMedium"], public: true, input: object({}), run: async ({ studioMediums }) => studioMediums() },
  {
    name: "quote_generation",
    description: "What one result of a generation would cost in credits, before starting it.",
    method: "GET",
    path: "/generations/quote",
    output: "Quote",
    public: true,
    input: object({ kind: { enum: ["video", "image", "audio"] }, app: text("Capability to use"), duration_seconds: { type: ["number", "null"] }, resolution: { enum: ["720p", "1080p", null] } }, ["kind", "app"]),
    run: async ({ quote }, input) =>
      ({
        credits: quote({
          kind: input.kind as "video" | "image" | "audio",
          app: str(input, "app"),
          prompt: "",
          aspect: "16:9",
          duration_seconds: input.duration_seconds === undefined || input.duration_seconds === null || input.duration_seconds === "" ? null : Number(input.duration_seconds),
          resolution: input.resolution === "1080p" ? "1080p" : input.resolution === "720p" ? "720p" : null,
        }),
      }),
  },
  {
    name: "create_generation",
    description: "Generate a video, image or audio clip. Returns a job to poll with get_generation.",
    method: "POST",
    path: "/generations",
    output: "Generation",
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
  { name: "get_generation", description: "Check a generation's state and progress.", method: "GET", path: "/generations/{id}", output: "Generation", input: object({ id: text("Generation id") }, ["id"]), run: async ({ client }, input) => found((await client.getGeneration(str(input, "id"))).data, "Generation") },
  { name: "list_conversations", description: "List the user's conversations with the agent, newest first.", method: "GET", path: "/conversations", output: ["ConversationSummary"], input: object({}), run: async ({ client }) => (await client.listConversations()).data },
  {
    name: "create_conversation",
    description: "Start a conversation with the agent. It plans the job, calls capabilities and reports each step.",
    method: "POST",
    path: "/conversations",
    output: "Conversation",
    input: object({ text: text("The request"), app: text("Optional capability to use"), aspect, duration_seconds: { type: "number", default: 5 }, attachment_ids: { type: "array", items: { type: "string" }, description: "Library item ids to work from" }, agent_model: text("Language model to run the agent, from list_agent_models; leave out to let the agent choose"), character_slug: text("A character to put on screen") }, ["text"]),
    run: async ({ client }, input) => (await client.createConversation(message(input))).data,
  },
  { name: "get_conversation", description: "Read a conversation, including the agent's steps, results and any video analysis.", method: "GET", path: "/conversations/{id}", output: "Conversation", input: object({ id: text("Conversation id") }, ["id"]), run: async ({ client }, input) => found((await client.getConversation(str(input, "id"))).data, "Conversation") },
  { name: "send_message", description: "Send a follow-up message in a conversation.", method: "POST", path: "/conversations/{id}/messages", output: "Conversation", input: object({ id: text("Conversation id"), text: text("The message"), app: text("Optional capability to use"), aspect, duration_seconds: { type: "number", default: 5 }, attachment_ids: { type: "array", items: { type: "string" } }, agent_model: text("Language model to run the agent; leave out to let the agent choose"), character_slug: text("A character to put on screen") }, ["id", "text"]), run: async ({ client }, input) => found((await client.sendMessage(str(input, "id"), message(input))).data, "Conversation") },
  { name: "delete_conversation", description: "Delete a conversation. Its shots stay in the library. This can't be undone.", method: "DELETE", path: "/conversations/{id}", output: "Deleted", input: object({ id: text("Conversation id") }, ["id"]), run: async ({ client }, input) => {
      if (!(await client.deleteConversation(str(input, "id"))).data) throw new ApiError(404, "Conversation not found");
      return { deleted: true };
    } },
  { name: "search_library", description: "Search the user's media by what is in it: subjects, places, actions, tags.", method: "GET", path: "/library", output: ["MediaItem"], input: object({ query: text("What to look for"), kind: { enum: ["video", "image", "audio"] } }), run: async ({ client }, input) => (await client.listMedia({ ...(input.query ? { query: str(input, "query") } : {}), ...(input.kind ? { kind: input.kind as "video" | "image" | "audio" } : {}) })).data },
  { name: "delete_media", description: "Delete an item from the library. This can't be undone.", method: "DELETE", path: "/library/{id}", output: "Deleted", input: object({ id: text("Library item id") }, ["id"]), run: async ({ client }, input) => ({ deleted: (await client.deleteMedia(str(input, "id"))).data }) },
  { name: "understand_video", description: "Ask about a video: summarise it, find moments, answer a question.", method: "POST", path: "/understand", output: "VideoAnalysis", input: object({ source: text("A URL or a library item id"), question: text("What to find out") }, ["source", "question"]), run: async ({ client }, input) => (await client.analyseVideo({ source: str(input, "source"), question: str(input, "question") })).data },
  {
    name: "list_characters",
    description: "List characters to cast in a scene: the person's own, then those shared on the instance. Characters for adults only aren't listed.",
    method: "GET",
    path: "/characters",
    output: ["Character"],
    public: true,
    input: object({ query: text("Filter by name, role or subject") }),
    run: async (context, input) => {
      const visible = context.moderation.visible(context.account?.user.id ?? null);
      return (await context.client.listCharacters(input.query ? { query: str(input, "query") } : {})).data.filter(visible);
    },
  },
  { name: "get_character", description: "One character: who they are, how they open and who made them.", method: "GET", path: "/characters/{slug}", output: "Character", public: true, input: object({ slug: text("The character's slug") }, ["slug"]), run: async (context, input) => character(context, str(input, "slug")) },
  {
    name: "create_character",
    description: "Create a character to cast in scenes. It is private unless shared with everyone on the instance.",
    method: "POST",
    path: "/characters",
    output: "Character",
    input: object({
      name: { type: "string", maxLength: 40, description: "Their name" },
      tagline: { type: "string", maxLength: 80, description: "One line about them, shown under their name" },
      description: { type: "string", maxLength: 2000, description: "How they look, move and speak, and what they care about" },
      greeting: { type: "string", maxLength: 300, description: "The first thing they say in a new conversation" },
      visibility: { enum: ["private", "public"], default: "private" },
    }, ["name", "description", "greeting"]),
    run: async ({ client }, input) => {
      const field = (key: string, limit: number) => {
        const value = str(input, key).trim();
        if (value.length > limit) throw new ApiError(400, `${key} is longer than ${limit} characters.`);
        return value;
      };
      const name = field("name", 40);
      const description = field("description", 2000);
      const greeting = field("greeting", 300);
      if (!name || !description || !greeting) throw new ApiError(400, "A character needs a name, who they are and how they open.");
      return (await client.createCharacter({ name, tagline: field("tagline", 80), description, greeting, visibility: input.visibility === "public" ? "public" : "private", mature: false })).data;
    },
  },
  {
    name: "report_character",
    description: "Report a shared character to the instance's operator, with a reason.",
    method: "POST",
    path: "/characters/{slug}/report",
    output: "CharacterReport",
    input: object({ slug: text("The character's slug"), reason: { enum: [...REPORT_REASONS] }, note: { type: "string", maxLength: 500, description: "Anything to add, in your own words" } }, ["slug", "reason"]),
    run: async (context, input) => {
      const { user } = signedIn(context);
      const found = await shared(context, str(input, "slug"));
      const reason = REPORT_REASONS.find((entry) => entry === input.reason);
      if (!reason) throw new ApiError(400, `reason is one of ${REPORT_REASONS.join(", ")}.`);
      return context.moderation.report(user.id, found, reason, str(input, "note").trim().slice(0, 500) || null);
    },
  },
  {
    name: "block_character",
    description: "Block a shared character: it, and everything else by its author, is hidden from the person from now on.",
    method: "POST",
    path: "/characters/{slug}/block",
    output: "CharacterBlock",
    input: object({ slug: text("The character's slug") }, ["slug"]),
    run: async (context, input) => context.moderation.block(signedIn(context).user.id, await shared(context, str(input, "slug"))),
  },
  { name: "get_balance", description: "The user's credit balance and budget.", method: "GET", path: "/balance", output: "CreditBalance", input: object({}), run: async ({ client }) => (await client.getCreditBalance()).data },
  { name: "get_usage", description: "What the user has spent, by capability, and recent jobs.", method: "GET", path: "/usage", output: "Usage", input: object({}), run: async ({ client }) => (await client.getUsage()).data },
  {
    name: "open_session",
    description: "Open a real-time session, such as a live restyle of a camera. It stays open and is billed by the second until closed.",
    method: "POST",
    path: "/sessions",
    output: "LiveSession",
    input: object({ app: text("A persistent capability, e.g. live-video-to-video"), prompt: text("The look or instruction"), destination_ids: { type: "array", items: { type: "string" } }, record: { type: "boolean", default: false } }, ["app", "prompt"]),
    run: async ({ client }, input) =>
      (await client.startLiveSession({ app: str(input, "app"), source: "camera", prompt: str(input, "prompt"), destination_ids: Array.isArray(input.destination_ids) ? input.destination_ids.map(String) : [], record: input.record === true })).data,
  },
  { name: "update_session", description: "Change a running session's prompt without closing it.", method: "PATCH", path: "/sessions/{id}", output: "LiveSession", input: object({ id: text("Session id"), prompt: text("The new look or instruction") }, ["id", "prompt"]), run: async ({ client }, input) => found((await client.updateLiveSession(str(input, "id"), str(input, "prompt"))).data, "Session") },
  { name: "close_session", description: "Close a real-time session.", method: "DELETE", path: "/sessions/{id}", output: "LiveSession", input: object({ id: text("Session id") }, ["id"]), run: async ({ client }, input) => found((await client.stopLiveSession(str(input, "id"))).data, "Session") },

  // Operator: administering the instance without the console.
  { name: "operator_overview", description: "Operator: active users, jobs today, revenue, wholesale cost and margin.", method: "GET", path: "/operator/overview", input: object({}), operator: true, run: async (context) => (await operator(context).getOverview()).data },
  { name: "operator_health", description: "Operator: engine readiness, discovery freshness, cost sync and version.", method: "GET", path: "/operator/health", input: object({}), operator: true, run: async (context) => (await operator(context).getEngineHealth()).data },
  { name: "operator_list_users", description: "Operator: every account the engine knows, with its allocation.", method: "GET", path: "/operator/users", input: object({}), operator: true, run: async (context) => (await operator(context).listActors()).data },
  { name: "operator_set_user_status", description: "Operator: suspend (pause) or resume a user's allocation. Suspending also signs out their phones and tablets.", method: "POST", path: "/operator/users/{id}/status", input: object({ id: text("Actor id"), status: { enum: ["active", "paused"] }, application_id: { type: "string", default: "default" } }, ["id", "status"]), operator: true, run: async (context, input) => {
      const paused = input.status === "paused";
      const ok = (await operator(context).setActorStatus(str(input, "application_id") || "default", str(input, "id"), paused ? "paused" : "active")).data;
      // A suspended user's apps sign out on their next request.
      if (ok && paused) context.devices.revokeAll(str(input, "id"));
      return { ok };
    } },
  { name: "operator_top_up_user", description: "Operator: add credit to a user's allocation, as a one-off adjustment.", method: "POST", path: "/operator/users/{id}/top-up", input: object({ id: text("User id"), amount_usd: { type: "number", exclusiveMinimum: 0 } }, ["id", "amount_usd"]), operator: true, run: async (context, input) => operator(context).provider.budgets.topUpAllocation(str(input, "id"), { amount: Number(input.amount_usd).toFixed(2), currency: "USD" }) },
  { name: "operator_assign_plan", description: "Operator: assign a plan to a user, or remove it with a null plan_id.", method: "POST", path: "/operator/users/{id}/plan", input: object({ id: text("User id"), plan_id: { type: ["string", "null"] } }, ["id"]), operator: true, run: async (context, input) => ({ plan: await operator(context).provider.plans.assignPlan(str(input, "id"), typeof input.plan_id === "string" ? input.plan_id : null) }) },
  { name: "operator_list_jobs", description: "Operator: recent jobs across all users, with attempts and failures.", method: "GET", path: "/operator/jobs", input: object({ limit: { type: "number", default: 50 } }), operator: true, run: async (context, input) => (await operator(context).listJobs(Number(input.limit) || 50)).data },
  { name: "operator_costs", description: "Operator: wholesale network cost by class and capability over a number of days.", method: "GET", path: "/operator/costs", input: object({ days: { type: "number", default: 30 } }), operator: true, run: async (context, input) => (await operator(context).getCostSummary(Number(input.days) || 30)).data },
  { name: "operator_list_reports", description: "Operator: reports of shared characters, open ones first.", method: "GET", path: "/operator/reports", input: object({}), operator: true, run: async (context) => { operator(context); return context.moderation.reports(); } },
  {
    name: "operator_resolve_report",
    description: "Operator: decide a report. Dismiss leaves the character up; hide takes it off the instance for everyone.",
    method: "POST",
    path: "/operator/reports/{id}",
    input: object({ id: text("Report id"), outcome: { enum: ["dismissed", "hidden"] } }, ["id", "outcome"]),
    operator: true,
    run: async (context, input) => {
      operator(context);
      return found(context.moderation.resolve(str(input, "id"), input.outcome === "hidden" ? "hidden" : "dismissed"), "Report");
    },
  },
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
    ...(typeof input.agent_model === "string" && input.agent_model ? { agent_model: input.agent_model } : {}),
    ...(typeof input.character_slug === "string" && input.character_slug ? { character_slug: input.character_slug } : {}),
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
