import { afterEach, describe, expect, it, vi } from "vitest";

import { UnsupportedByProvider, balanceInCredits, createBatteriesProvider, createMockProvider, creditsFor, topUpCredits } from "./index";

afterEach(() => vi.unstubAllGlobals());

const rule = { creditsPerUsd: 100, default: 1.3, perApp: { "text-to-video": 1.5 } };
const usd = (amount: string) => ({ amount, currency: "USD" });

describe("pricing rules", () => {
  it("a retail price is wholesale cost, marked up, in credits, rounded up", () => {
    expect(creditsFor(0.4, "music", rule)).toBe(52);
    expect(creditsFor(0.4, "text-to-video", rule)).toBe(60);
    expect(creditsFor(0.0001, "chat", rule)).toBe(1);
  });

  it("a credit balance is the allocation's available amount", () => {
    expect(balanceInCredits({ available: usd("24.80") }, rule)).toBe(2480);
    expect(balanceInCredits({ available: usd("-3.00") }, rule)).toBe(0);
  });
});

describe("top-ups of the user's own amount", () => {
  const packs = [
    { id: "small", credits: 1000, price: usd("10.00"), popular: false, active: true },
    { id: "large", credits: 5500, price: usd("50.00"), popular: false, active: true },
    { id: "retired", credits: 4000, price: usd("30.00"), popular: false, active: false },
  ];

  it("pays the rate of the largest offered pack the amount reaches, and the base rate below the smallest", () => {
    expect(topUpCredits(37, packs, 100)).toBe(3700);
    expect(topUpCredits(60, packs, 100)).toBe(6600);
    expect(topUpCredits(5, packs, 100)).toBe(500);
  });

  it("the operator's limits must make sense", async () => {
    const { plans } = createMockProvider();
    expect(await plans.updateTopUpRange({ max: usd("250.00") })).toMatchObject({ enabled: true, min: usd("5.00"), max: usd("250.00") });
    await expect(plans.updateTopUpRange({ min: usd("0.00") })).rejects.toThrow();
    await expect(plans.updateTopUpRange({ min: usd("300.00") })).rejects.toThrow();
  });
});

describe("mock provider", () => {
  it("supports every area", () => {
    expect(Object.values(createMockProvider().features).every(Boolean)).toBe(true);
  });

  it("a credit pack is a one-off allocation top-up", async () => {
    const provider = createMockProvider();
    const before = await provider.budgets.getAllocation("usr_demo_adam");
    const after = await provider.budgets.topUpAllocation("usr_demo_adam", usd("25.00"));
    expect(Number(after.available.amount)).toBeCloseTo(Number(before?.available.amount) + 25);
    expect(Number(after.spent.amount)).toBe(Number(before?.spent.amount));
  });

  it("provisions an allocation from a grant and refuses to over-allocate", async () => {
    const provider = createMockProvider();
    const grant = await provider.budgets.createGrant({ label: "Pilot", amount: usd("100.00") });
    const allocation = await provider.budgets.provisionAllocation({ userId: "usr_new", grantId: grant.id, amount: usd("60.00") });
    expect(allocation).toMatchObject({ status: "active", available: usd("60.00") });
    await expect(provider.budgets.provisionAllocation({ userId: "usr_other", grantId: grant.id, amount: usd("60.00") })).rejects.toThrow();
  });

  it("creates and edits credit packs, with one highlighted at most", async () => {
    const { plans } = createMockProvider();
    const pack = await plans.createCreditPack({ credits: 25000, price: usd("200.00"), popular: true, active: true });
    expect((await plans.listCreditPacks()).filter((entry) => entry.popular).map((entry) => entry.id)).toEqual([pack.id]);
    expect((await plans.listCreditPacks()).at(-1)?.id).toBe(pack.id);
    expect(await plans.updateCreditPack(pack.id, { active: false })).toMatchObject({ active: false, credits: 25000 });
    await expect(plans.createCreditPack({ credits: 0, price: usd("5.00"), popular: false, active: true })).rejects.toThrow();
    await expect(plans.updateCreditPack(pack.id, { price: usd("0.00") })).rejects.toThrow();
    await expect(plans.updateCreditPack("pck_nope", { active: true })).rejects.toThrow();
  });

  it("assigns and removes a plan", async () => {
    const provider = createMockProvider();
    const [plan] = await provider.plans.listPlans();
    expect((await provider.plans.assignPlan("usr_demo_adam", plan!.id))?.id).toBe(plan!.id);
    expect((await provider.plans.getUserPlan("usr_demo_adam"))?.name).toBe(plan!.name);
    await provider.plans.assignPlan("usr_demo_adam", null);
    expect(await provider.plans.getUserPlan("usr_demo_adam")).toBeNull();
  });

  it("pausing a user pauses their allocation", async () => {
    const provider = createMockProvider();
    await provider.identity.setUserStatus("usr_demo_adam", "paused");
    expect((await provider.budgets.getAllocation("usr_demo_adam"))?.status).toBe("paused");
  });

  it("summarises usage per user", async () => {
    const provider = createMockProvider();
    const summary = await provider.usage.getUsageSummary({ userId: "usr_demo_adam" });
    const entries = await provider.usage.listUsage({ userId: "usr_demo_adam", limit: 500 });
    expect(summary.jobs).toBe(entries.length);
    expect(summary.by_app.reduce((total, row) => total + row.credits, 0)).toBe(summary.credits);
  });
});

describe("batteries provider", () => {
  const provider = () => createBatteriesProvider({ url: "http://engine.test", reader: "reader", admin: "admin" });

  it("says what it cannot do", async () => {
    expect(provider().features).toMatchObject({ grants: true, plans: false, users: false });
    await expect(provider().identity.listUsers()).rejects.toBeInstanceOf(UnsupportedByProvider);
    expect(await provider().plans.listPlans()).toEqual([]);
    await expect(provider().plans.createCreditPack({ credits: 1000, price: usd("10.00"), popular: false, active: true })).rejects.toBeInstanceOf(UnsupportedByProvider);
  });

  it("reads an allocation with the reader token, never the admin token", async () => {
    const fetchMock = vi.fn(async (_url: URL | string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({ allocation_id: "alc_1", status: "active", granted: usd("50"), spent: usd("25.2"), available: usd("24.8") }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const allocation = await provider().budgets.getAllocation("actor-1");
    expect(allocation).toMatchObject({ id: "alc_1", status: "active", available: usd("24.8") });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://engine.test/v1/allowance?actor_id=actor-1");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer reader");
  });

  it("returns null for an actor without an allocation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect(await provider().budgets.getAllocation("nobody")).toBeNull();
  });

  it("uses the admin token and an operation_ref for writes", async () => {
    const fetchMock = vi.fn(
      async (_url: URL | string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "g1", name: "Pilot", status: "active", currency: "USD", total: "100", metadata: {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await provider().budgets.createGrant({ label: "Pilot", amount: usd("100") });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer admin");
    expect(JSON.parse(String(init?.body))).toMatchObject({ name: "Pilot", amount: { amount: "100", currency: "USD" } });
    expect(JSON.parse(String(init?.body)).operation_ref).toBeTruthy();
  });
});
