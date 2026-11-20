import { MOCK_ONLY_DEMO_KEY, createApiClient, createMockProvider, createOperatorClient, type InstanceDescription } from "@aquareum/api-client";
import { describe, expect, it } from "vitest";

import { ApiError, OPERATIONS, matchOperation } from "./operations";

const provider = createMockProvider();
const client = createApiClient({ env: { MOCK_ONLY: "1" }, provider });
const operator = createOperatorClient({ provider, env: { MOCK_ONLY: "1" }, pricing: { creditsPerUsd: 100, default: 1.3 } });

const instance: InstanceDescription = {
  api_version: "1",
  name: "Test instance",
  logo: { symbol: null, wordmark: null, tint: true },
  theme: { dark: {}, light: {} },
  surfaces: { app: true, api: true, mcp: true },
  sign_in: { methods: ["email"], sign_up: "open" },
  content: { characters: true, adult_content: false },
  home: { background_image: null, background_poster: null, background_video: null, aurora: false },
};

const labels = async () => [{ app: "text-to-video", name: "Text to video", work: "Text to video" }];

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
    const created = (await create.run({ client, operator: null, instance, labels }, { kind: "video", app: "text-to-video", prompt: "A harbour at first light" })) as { id: string; state: string };
    expect(created.state).toBe("queued");
    const get = OPERATIONS.find((operation) => operation.name === "get_generation")!;
    expect(await get.run({ client, operator: null, instance, labels }, { id: created.id })).toMatchObject({ id: created.id });
    await expect(get.run({ client, operator: null, instance, labels }, { id: "gen_missing" })).rejects.toMatchObject({ status: 404 });
  });

  it("refuses operator operations without the operator role", async () => {
    const overview = OPERATIONS.find((operation) => operation.name === "operator_overview")!;
    await expect(overview.run({ client, operator: null, instance, labels }, {})).rejects.toBeInstanceOf(ApiError);
    await expect(overview.run({ client, operator, instance, labels }, {})).resolves.toHaveProperty("jobs_today");
  });

  it("an agent can administer a user: suspend, top up, assign a plan", async () => {
    const run = (name: string, input: Record<string, unknown>) => OPERATIONS.find((operation) => operation.name === name)!.run({ client, operator, instance, labels }, input);
    await run("operator_set_user_status", { id: "usr_demo_priya", status: "paused" });
    expect((await provider.budgets.getAllocation("usr_demo_priya"))?.status).toBe("paused");
    const before = Number((await provider.budgets.getAllocation("usr_demo_priya"))?.available.amount);
    await run("operator_top_up_user", { id: "usr_demo_priya", amount_usd: 10 });
    expect(Number((await provider.budgets.getAllocation("usr_demo_priya"))?.available.amount)).toBeCloseTo(before + 10);
    await run("operator_assign_plan", { id: "usr_demo_priya", plan_id: "pln_studio" });
    expect((await provider.plans.getUserPlan("usr_demo_priya"))?.id).toBe("pln_studio");
  });

  it("every operation outside the operator's says what it answers with", () => {
    for (const operation of OPERATIONS) if (!operation.operator) expect(operation.output, operation.name).toBeDefined();
  });

  it("only reads are open to guests, and none of them is the operator's", () => {
    const open = OPERATIONS.filter((operation) => operation.public);
    expect(open.map((operation) => operation.name).sort()).toEqual(["get_instance", "list_agent_models", "list_capabilities", "list_capability_labels", "list_prompt_starters", "list_showcase"]);
    for (const operation of open) expect(operation.method === "GET" && !operation.operator, operation.name).toBe(true);
  });

  it("describes the instance and passes the agent's model and a cast character through", async () => {
    const run = (name: string, input: Record<string, unknown>) => OPERATIONS.find((operation) => operation.name === name)!.run({ client, operator: null, instance, labels }, input);
    expect(await run("get_instance", {})).toMatchObject({ name: "Test instance", api_version: "1" });
    const conversation = (await run("create_conversation", { text: "A fox crossing a frozen lake", agent_model: "qwen3.8-27b" })) as { messages: Array<{ role: string; agent_model?: string | null }> };
    expect(conversation.messages[0]).toMatchObject({ role: "user", agent_model: "qwen3.8-27b" });
  });

  it("the demo key works on a mock-only instance and nowhere else", async () => {
    expect((await client.verifyApiKey(MOCK_ONLY_DEMO_KEY)).data).toMatchObject({ status: "active" });
    const real = createApiClient({ env: {}, provider });
    expect((await real.verifyApiKey(MOCK_ONLY_DEMO_KEY)).data).toBeNull();
  });
});
