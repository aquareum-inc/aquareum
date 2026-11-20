import { MOCK_ONLY_DEMO_KEY, createApiClient, createMockProvider, createOperatorClient, type DeviceSession, type InstanceDescription } from "@aquareum/api-client";
import { describe, expect, it, vi } from "vitest";

import { ApiError, OPERATIONS, matchOperation, type Account, type DeviceAccess } from "./operations";

const provider = createMockProvider();
const client = createApiClient({ env: { MOCK_ONLY: "1" }, provider });
const operator = createOperatorClient({ provider, env: { MOCK_ONLY: "1" }, pricing: { creditsPerUsd: 100, default: 1.3 } });

const instance: InstanceDescription = {
  api_version: "1",
  name: "Test instance",
  logo: { symbol: null, wordmark: null, tint: true },
  theme: { dark: {}, light: {} },
  surfaces: { app: true, api: true, mcp: true, mobile: true },
  mobile: { ios: { bundle_id: "app.aquareum.dev", minimum_version: null }, android: null },
  sign_in: { methods: ["email"], sign_up: "open" },
  content: { characters: true, adult_content: false },
  home: { background_image: null, background_poster: null, background_video: null, aurora: false },
};

const labels = async () => [{ app: "text-to-video", name: "Text to video", work: "Text to video" }];

const phone: DeviceSession = { id: "dev_1", name: "Test iPhone", platform: "ios", created_at: "2026-11-20T09:00:00Z", last_used_at: "2026-11-20T09:00:00Z", current: true };
const devices: DeviceAccess = {
  redeemCode: ({ code }) => (code === "good" ? { token: "aqd_test", device: phone } : null),
  list: (userId, currentId) => (userId === "usr_demo_adam" ? [{ ...phone, current: phone.id === currentId }] : []),
  revoke: (userId, id) => userId === "usr_demo_adam" && id === phone.id,
  revokeAll: vi.fn(() => 1),
};
const agentModelMenu = async () => [];
const base = { client, operator: null, account: null, devices, instance, labels, agentModelMenu };
const adam: Account = { user: { id: "usr_demo_adam", name: "Adam Soffer", email: "adam@example.test" }, deviceId: "dev_1" };

describe("public API operations", () => {
  it("names and routes are unique", () => {
    expect(new Set(OPERATIONS.map((operation) => operation.name)).size).toBe(OPERATIONS.length);
    expect(new Set(OPERATIONS.map((operation) => `${operation.method} ${operation.path}`)).size).toBe(OPERATIONS.length);
  });

  it("every operation describes itself and its input for agents", () => {
    for (const operation of OPERATIONS) {
      expect(operation.description.length).toBeGreaterThan(20);
      expect(operation.input).toMatchObject({ type: "object" });
    }
  });

  it("matches REST routes and extracts path inputs", () => {
    expect(matchOperation("GET", ["offerings"])?.operation.name).toBe("list_capabilities");
    expect(matchOperation("POST", ["conversations", "cnv_1", "messages"])).toMatchObject({ operation: { name: "send_message" }, params: { id: "cnv_1" } });
    expect(matchOperation("GET", ["nope"])).toBeNull();
    expect(matchOperation("DELETE", ["offerings"])).toBeNull();
  });

  it("runs the main flow: generate, then poll", async () => {
    const create = OPERATIONS.find((operation) => operation.name === "create_generation")!;
    const created = (await create.run(base, { kind: "video", app: "text-to-video", prompt: "A harbour at first light" })) as { id: string; state: string };
    expect(created.state).toBe("queued");
    const get = OPERATIONS.find((operation) => operation.name === "get_generation")!;
    expect(await get.run(base, { id: created.id })).toMatchObject({ id: created.id });
    await expect(get.run(base, { id: "gen_missing" })).rejects.toMatchObject({ status: 404 });
  });

  it("refuses operator operations without the operator role", async () => {
    const overview = OPERATIONS.find((operation) => operation.name === "operator_overview")!;
    await expect(overview.run(base, {})).rejects.toBeInstanceOf(ApiError);
    await expect(overview.run({ ...base, operator }, {})).resolves.toHaveProperty("jobs_today");
  });

  it("an agent can administer a user: suspend, top up, assign a plan", async () => {
    const run = (name: string, input: Record<string, unknown>) => OPERATIONS.find((operation) => operation.name === name)!.run({ ...base, operator }, input);
    await run("operator_set_user_status", { id: "usr_demo_priya", status: "paused" });
    expect((await provider.budgets.getAllocation("usr_demo_priya"))?.status).toBe("paused");
    expect(devices.revokeAll).toHaveBeenCalledWith("usr_demo_priya");
    const before = Number((await provider.budgets.getAllocation("usr_demo_priya"))?.available.amount);
    await run("operator_top_up_user", { id: "usr_demo_priya", amount_usd: 10 });
    expect(Number((await provider.budgets.getAllocation("usr_demo_priya"))?.available.amount)).toBeCloseTo(before + 10);
    await run("operator_assign_plan", { id: "usr_demo_priya", plan_id: "pln_studio" });
    expect((await provider.plans.getUserPlan("usr_demo_priya"))?.id).toBe("pln_studio");
  });

  it("every operation outside the operator's says what it answers with", () => {
    for (const operation of OPERATIONS) if (!operation.operator) expect(operation.output, operation.name).toBeDefined();
  });

  it("only reads are open to guests, apart from collecting a sign-in, and none of them is the operator's", () => {
    const open = OPERATIONS.filter((operation) => operation.public);
    expect(open.map((operation) => operation.name).sort()).toEqual(["create_device_session", "get_instance", "list_agent_model_menu", "list_agent_models", "list_capabilities", "list_capability_labels", "list_prompt_starters", "list_showcase"]);
    for (const operation of open) expect((operation.method === "GET" || operation.name === "create_device_session") && !operation.operator, operation.name).toBe(true);
  });

  it("keeps the apps' sign-in plumbing away from agents", () => {
    expect(OPERATIONS.filter((operation) => operation.mcp === false).map((operation) => operation.name).sort()).toEqual(["create_device_session", "end_device_session"]);
  });

  it("collects a sign-in once, with a reason a client can act on when it can't", async () => {
    const collect = OPERATIONS.find((operation) => operation.name === "create_device_session")!;
    expect(await collect.run(base, { code: "good", verifier: "v", platform: "ios" })).toMatchObject({ token: "aqd_test", device: { id: "dev_1" } });
    await expect(collect.run(base, { code: "used", verifier: "v", platform: "ios" })).rejects.toMatchObject({ status: 400, code: "sign_in_expired" });
  });

  it("knows who is signed in, and refuses account operations to an API key", async () => {
    const run = (name: string, input: Record<string, unknown>, account: Account | null) => OPERATIONS.find((operation) => operation.name === name)!.run({ ...base, account }, input);
    expect(await run("get_me", {}, adam)).toMatchObject({ id: "usr_demo_adam", name: "Adam Soffer", balance: { credits: expect.any(Number) } });
    await expect(run("get_me", {}, null)).rejects.toMatchObject({ status: 403, code: "account_required" });
    expect(await run("list_devices", {}, adam)).toEqual([phone]);
    await expect(run("revoke_device", { id: "dev_other" }, adam)).rejects.toMatchObject({ status: 404 });
    expect(await run("revoke_device", { id: "dev_1" }, adam)).toEqual({ deleted: true });
    expect(await run("end_device_session", {}, adam)).toEqual({ deleted: true });
    await expect(run("end_device_session", {}, { ...adam, deviceId: null })).rejects.toMatchObject({ status: 400 });
  });

  it("describes the instance and passes the agent's model and a cast character through", async () => {
    const run = (name: string, input: Record<string, unknown>) => OPERATIONS.find((operation) => operation.name === name)!.run(base, input);
    expect(await run("get_instance", {})).toMatchObject({ name: "Test instance", api_version: "1" });
    const conversation = (await run("create_conversation", { text: "A fox crossing a frozen lake", agent_model: "qwen3.8-27b" })) as { messages: Array<{ role: string; agent_model?: string | null }> };
    expect(conversation.messages[0]).toMatchObject({ role: "user", agent_model: "qwen3.8-27b" });
  });

  it("the demo key works on a mock-only instance and nowhere else", async () => {
    expect((await client.verifyApiKey(MOCK_ONLY_DEMO_KEY)).data).toMatchObject({ status: "active" });
    const real = createApiClient({ env: {}, provider });
    expect((await real.verifyApiKey(MOCK_ONLY_DEMO_KEY)).data).toBeNull();
  });

  it("deletes a conversation once, and says so when it's gone", async () => {
    const run = (name: string, input: Record<string, unknown>) => OPERATIONS.find((operation) => operation.name === name)!.run(base, input);
    const conversation = (await run("create_conversation", { text: "A heron on a still pond" })) as { id: string };
    expect(await run("delete_conversation", { id: conversation.id })).toEqual({ deleted: true });
    await expect(run("delete_conversation", { id: conversation.id })).rejects.toMatchObject({ status: 404 });
  });

  it("a follow-up can carry the shot's shape and length", async () => {
    const run = (name: string, input: Record<string, unknown>) => OPERATIONS.find((operation) => operation.name === name)!.run(base, input);
    const send = OPERATIONS.find((operation) => operation.name === "send_message")!;
    expect(Object.keys((send.input as { properties: object }).properties)).toEqual(expect.arrayContaining(["app", "aspect", "duration_seconds"]));
    const conversation = (await run("create_conversation", { text: "A heron on a still pond" })) as { id: string };
    expect(await run("send_message", { id: conversation.id, text: "Make it vertical", aspect: "9:16", duration_seconds: 10 })).toMatchObject({ id: conversation.id });
  });
});
