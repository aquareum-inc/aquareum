import type {
  Allocation,
  CreditPack,
  TopUpRange,
  Grant,
  Money,
  PaymentProvider,
  Plan,
  ProviderUser,
  UsageEntry,
} from "./types";

const usd = (amount: number): Money => ({ amount: amount.toFixed(2), currency: "USD" });
const num = (money: Money) => Number(money.amount);

interface State {
  users: ProviderUser[];
  grants: Grant[];
  allocations: Allocation[];
  plans: Plan[];
  packs: CreditPack[];
  topUp: TopUpRange;
  assignments: Map<string, string>;
  usage: UsageEntry[];
  sequence: number;
}

const APPS = ["text-to-video", "image-to-video", "text-to-image", "music", "chat", "video-understanding"];

function seed(): State {
  const users: ProviderUser[] = [
    { id: "usr_demo_adam", name: "Adam Soffer", email: "adam@example.test", role: "user", status: "active", created_at: "2026-09-02T10:14:00Z" },
    { id: "usr_demo_sam", name: "Sam Whitfield", email: "sam@example.test", role: "operator", status: "active", created_at: "2026-08-19T08:40:00Z" },
    { id: "usr_demo_ines", name: "Inés Castellanos", email: "ines@example.test", role: "user", status: "active", created_at: "2026-10-11T16:22:00Z" },
    { id: "usr_demo_tomas", name: "Tomás Lindqvist", email: "tomas@example.test", role: "user", status: "paused", created_at: "2026-10-28T09:05:00Z" },
    { id: "usr_demo_priya", name: "Priya Raman", email: "priya@example.test", role: "user", status: "active", created_at: "2026-11-05T13:47:00Z" },
  ];
  const grants: Grant[] = [
    { id: "grt_launch", label: "Launch credits", funded: usd(500), allocated: usd(210), spent: usd(64.18), created_at: "2026-08-19T08:45:00Z" },
    { id: "grt_studio_partners", label: "Studio partners", funded: usd(1200), allocated: usd(400), spent: usd(212.4), created_at: "2026-10-01T12:00:00Z" },
  ];
  const budget: Array<[string, string, number, number, Allocation["status"]]> = [
    ["usr_demo_adam", "grt_launch", 50, 25.2, "active"],
    ["usr_demo_sam", "grt_launch", 100, 12.6, "active"],
    ["usr_demo_ines", "grt_studio_partners", 250, 141.9, "active"],
    ["usr_demo_tomas", "grt_launch", 60, 26.38, "paused"],
    ["usr_demo_priya", "grt_studio_partners", 150, 70.5, "active"],
  ];
  const allocations = budget.map(([user_id, grant_id, granted, spent, status]) => ({
    id: `alc_${user_id.slice(9)}`,
    grant_id,
    user_id,
    status,
    granted: usd(granted),
    spent: usd(spent),
    available: usd(granted - spent),
  }));
  const plans: Plan[] = [
    { id: "pln_creator", name: "Creator", description: "For people making video every week.", price: usd(18), interval: "month", allowance: { credits: 2000, period: "month", rollover_months: 0 }, features: ["Every capability on the network", "API and MCP access"], markup: null, active: true },
    { id: "pln_studio", name: "Studio", description: "For teams and heavier production.", price: usd(68), interval: "month", allowance: { credits: 9000, period: "month", rollover_months: 2 }, features: ["Unused credits roll over for 2 months", "Priority in the queue", "Live mode destinations"], markup: 1.2, active: true },
    { id: "pln_network", name: "Network", description: "For agents and products built on the API.", price: usd(200), interval: "month", allowance: { credits: 30000, period: "month", rollover_months: 3 }, features: ["Unused credits roll over for 3 months", "Lowest markup on network cost", "Higher API rate limits"], markup: 1.1, active: true },
  ];
  const usage: UsageEntry[] = Array.from({ length: 42 }, (_, index) => {
    const user = users[index % users.length] as ProviderUser;
    const app = APPS[(index * 5) % APPS.length] as string;
    const wholesale = app.includes("video") && !app.includes("understanding") ? 0.4 + (index % 3) * 0.1 : app === "music" ? 0.05 : 0.01;
    return {
      id: `use_${(1000 + index).toString(36)}`,
      user_id: user.id,
      app,
      wholesale: { amount: wholesale.toFixed(4), currency: "USD" },
      credits: Math.ceil(wholesale * 1.3 * 100),
      status: index % 11 === 7 ? "failed_after_payment" : index < 2 ? "pending" : "delivered",
      created_at: new Date(Date.UTC(2026, 10, 17, 20) - index * 5.3 * 3600_000).toISOString(),
    };
  });
  return { users, grants, allocations, plans, packs: PACKS.map((pack) => ({ ...pack })), topUp: { enabled: true, min: usd(5), max: usd(500) }, assignments: new Map([["usr_demo_ines", "pln_studio"], ["usr_demo_priya", "pln_creator"]]), usage, sequence: 0 };
}

const PACKS: CreditPack[] = [
  { id: "pck_usd10", credits: 1000, price: usd(10), popular: false, active: true },
  { id: "pck_usd25", credits: 2500, price: usd(25), popular: true, active: true },
  { id: "pck_usd50", credits: 5250, price: usd(50), popular: false, active: true },
  { id: "pck_usd100", credits: 11000, price: usd(100), popular: false, active: true },
];

/** What any provider would refuse: a pack has to give whole credits for a price. */
function checkPack(pack: Omit<CreditPack, "id">): void {
  if (!Number.isInteger(pack.credits) || pack.credits <= 0) throw new Error("A pack has to give a whole number of credits, more than zero.");
  if (!(num(pack.price) > 0)) throw new Error("A pack's price has to be more than zero.");
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} not found`);
  return value;
}

/**
 * A complete provider in the shape PymtHouse exposes (users, plans with allowances and markup,
 * usage), so plans and sign-in switch to real data when that provider is connected.
 */
export function createMockProvider(): PaymentProvider {
  const state = seed();
  const id = (prefix: string) => `${prefix}_${(++state.sequence + 4096).toString(36)}`;
  const allocationOf = (userId: string) => state.allocations.find((entry) => entry.user_id === userId);

  return {
    id: "mock",
    name: "Built-in mock provider",
    features: { users: true, grants: true, plans: true, allowances: true, credit_packs: true, custom_top_up: true, invoices: true, oidc: true },

    identity: {
      async listUsers() {
        return state.users.map((user) => ({ ...user }));
      },
      async getUser(userId) {
        const user = state.users.find((entry) => entry.id === userId);
        return user ? { ...user } : null;
      },
      async setUserStatus(userId, status) {
        const user = must(state.users.find((entry) => entry.id === userId), "user");
        user.status = status;
        const allocation = allocationOf(userId);
        if (allocation) allocation.status = status;
        return { ...user };
      },
      async setUserRole(userId, role) {
        const user = must(state.users.find((entry) => entry.id === userId), "user");
        user.role = role;
        return { ...user };
      },
      async deleteUser(userId) {
        state.users = state.users.filter((entry) => entry.id !== userId);
        state.allocations = state.allocations.filter((entry) => entry.user_id !== userId);
        state.assignments.delete(userId);
      },
    },

    budgets: {
      async listGrants() {
        return state.grants.map((grant) => ({ ...grant }));
      },
      async createGrant({ label, amount }) {
        const grant: Grant = { id: id("grt"), label, funded: amount, allocated: usd(0), spent: usd(0), created_at: new Date().toISOString() };
        state.grants.push(grant);
        return { ...grant };
      },
      async fundGrant(grantId, amount) {
        const grant = must(state.grants.find((entry) => entry.id === grantId), "grant");
        grant.funded = usd(num(grant.funded) + num(amount));
        return { ...grant };
      },
      async getAllocation(userId) {
        const allocation = allocationOf(userId);
        return allocation ? { ...allocation } : null;
      },
      async provisionAllocation({ userId, grantId, amount }) {
        const grant = must(state.grants.find((entry) => entry.id === grantId), "grant");
        if (num(grant.funded) - num(grant.allocated) < num(amount)) throw new Error("The grant has less unallocated funding than that.");
        grant.allocated = usd(num(grant.allocated) + num(amount));
        const allocation: Allocation = { id: id("alc"), grant_id: grantId, user_id: userId, status: "active", granted: amount, spent: usd(0), available: amount };
        state.allocations = state.allocations.filter((entry) => entry.user_id !== userId).concat(allocation);
        return { ...allocation };
      },
      async topUpAllocation(userId, amount) {
        const allocation = must(allocationOf(userId), "allocation");
        allocation.granted = usd(num(allocation.granted) + num(amount));
        allocation.available = usd(num(allocation.available) + num(amount));
        return { ...allocation };
      },
    },

    plans: {
      async listPlans() {
        return state.plans.map((plan) => ({ ...plan }));
      },
      async createPlan(input) {
        const plan: Plan = { ...input, id: id("pln") };
        state.plans.push(plan);
        return { ...plan };
      },
      async updatePlan(planId, patch) {
        const plan = must(state.plans.find((entry) => entry.id === planId), "plan");
        Object.assign(plan, patch);
        return { ...plan };
      },
      async getUserPlan(userId) {
        const plan = state.plans.find((entry) => entry.id === state.assignments.get(userId));
        return plan ? { ...plan } : null;
      },
      async assignPlan(userId, planId) {
        if (planId === null) {
          state.assignments.delete(userId);
          return null;
        }
        const plan = must(state.plans.find((entry) => entry.id === planId), "plan");
        state.assignments.set(userId, planId);
        return { ...plan };
      },
      async listCreditPacks() {
        return state.packs.map((pack) => ({ ...pack })).sort((a, b) => num(a.price) - num(b.price));
      },
      async createCreditPack(input) {
        checkPack(input);
        const pack: CreditPack = { ...input, id: id("pck") };
        if (pack.popular) for (const other of state.packs) other.popular = false;
        state.packs.push(pack);
        return { ...pack };
      },
      async updateCreditPack(packId, patch) {
        const pack = must(state.packs.find((entry) => entry.id === packId), "credit pack");
        const next = { ...pack, ...patch };
        checkPack(next);
        if (next.popular) for (const other of state.packs) other.popular = false;
        Object.assign(pack, next);
        return { ...pack };
      },
      async getTopUpRange() {
        return { ...state.topUp };
      },
      async updateTopUpRange(patch) {
        const next = { ...state.topUp, ...patch };
        if (num(next.min) <= 0) throw new Error("The minimum has to be more than zero.");
        if (num(next.max) < num(next.min)) throw new Error("The maximum can't be less than the minimum.");
        state.topUp = next;
        return { ...next };
      },
    },

    usage: {
      async listUsage({ userId, limit = 50 }) {
        return state.usage.filter((entry) => !userId || entry.user_id === userId).slice(0, limit);
      },
      async getUsageSummary({ userId }) {
        const entries = state.usage.filter((entry) => !userId || entry.user_id === userId);
        const byApp = new Map<string, { app: string; credits: number; jobs: number }>();
        for (const entry of entries) {
          const row = byApp.get(entry.app) ?? { app: entry.app, credits: 0, jobs: 0 };
          row.credits += entry.credits;
          row.jobs += 1;
          byApp.set(entry.app, row);
        }
        return {
          credits: entries.reduce((total, entry) => total + entry.credits, 0),
          wholesale: { amount: entries.reduce((total, entry) => total + num(entry.wholesale), 0).toFixed(4), currency: "USD" },
          jobs: entries.length,
          by_app: [...byApp.values()].sort((a, b) => b.credits - a.credits),
        };
      },
    },
  };
}
