/**
 * The payment and identity provider behind the engine, in the engine's terms: grants fund
 * allocations, an allocation is a user's budget, usage is what was spent, a plan is the
 * provider's plan. Nothing here is a second ledger: every amount is read from the provider.
 */

export interface Money {
  /** Decimal string, as the engine and providers report amounts. */
  amount: string;
  currency: string;
}

export interface ProviderUser {
  id: string;
  name: string;
  email: string | null;
  role: "user" | "operator";
  status: "active" | "paused" | "revoked";
  created_at: string;
}

export interface Grant {
  id: string;
  label: string;
  funded: Money;
  allocated: Money;
  spent: Money;
  created_at: string;
}

export interface Allocation {
  id: string;
  grant_id: string;
  user_id: string;
  status: "active" | "paused" | "revoked";
  granted: Money;
  spent: Money;
  available: Money;
}

export interface PlanAllowance {
  /** Credits included each period. */
  credits: number;
  period: "month" | "year";
  /** Months unused credits carry forward; 0 means they expire. */
  rollover_months: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: Money;
  interval: "month" | "year";
  allowance: PlanAllowance;
  features: string[];
  /** Multiplier on wholesale cost for subscribers; null uses the instance default. */
  markup: number | null;
  active: boolean;
}

/** A one-off top-up the provider sells at a fixed price. Buying one adds to the user's allocation. */
export interface CreditPack {
  id: string;
  credits: number;
  price: Money;
  /** Shown first and marked to users. At most one pack is. */
  popular: boolean;
  /** On sale. Packs are taken off sale rather than deleted, so past purchases still name them. */
  active: boolean;
}

/**
 * Top-ups of an amount the user chooses, beside the fixed packs. The operator switches them on and
 * sets the limits; card processors have minimum charges, and fees make very small top-ups a loss.
 */
export interface TopUpRange {
  enabled: boolean;
  min: Money;
  max: Money;
}

export interface UsageEntry {
  id: string;
  user_id: string;
  app: string;
  /** What the network charged. */
  wholesale: Money;
  /** What the user was charged, in credits. */
  credits: number;
  status: "delivered" | "failed_after_payment" | "pending";
  created_at: string;
}

export interface UsageSummary {
  credits: number;
  wholesale: Money;
  jobs: number;
  by_app: Array<{ app: string; credits: number; jobs: number }>;
}

/** What the connected provider can do, so the UI can say so instead of failing. */
export interface ProviderFeatures {
  users: boolean;
  grants: boolean;
  plans: boolean;
  allowances: boolean;
  credit_packs: boolean;
  /** Top-ups of an amount the user chooses. */
  custom_top_up: boolean;
  invoices: boolean;
  oidc: boolean;
}

export class UnsupportedByProvider extends Error {
  constructor(provider: string, operation: string) {
    super(`${provider} does not support ${operation}`);
    this.name = "UnsupportedByProvider";
  }
}

export interface PaymentProvider {
  readonly id: "mock" | "batteries" | "pymthouse";
  readonly name: string;
  readonly features: ProviderFeatures;

  identity: {
    listUsers(): Promise<ProviderUser[]>;
    getUser(id: string): Promise<ProviderUser | null>;
    setUserStatus(id: string, status: ProviderUser["status"]): Promise<ProviderUser>;
    setUserRole(id: string, role: ProviderUser["role"]): Promise<ProviderUser>;
  };

  budgets: {
    listGrants(): Promise<Grant[]>;
    createGrant(input: { label: string; amount: Money }): Promise<Grant>;
    fundGrant(id: string, amount: Money): Promise<Grant>;
    getAllocation(userId: string): Promise<Allocation | null>;
    provisionAllocation(input: { userId: string; grantId: string; amount: Money }): Promise<Allocation>;
    /** A one-off addition to a user's allocation. A credit pack is this. */
    topUpAllocation(userId: string, amount: Money): Promise<Allocation>;
  };

  plans: {
    listPlans(): Promise<Plan[]>;
    createPlan(input: Omit<Plan, "id">): Promise<Plan>;
    updatePlan(id: string, patch: Partial<Omit<Plan, "id">>): Promise<Plan>;
    getUserPlan(userId: string): Promise<Plan | null>;
    assignPlan(userId: string, planId: string | null): Promise<Plan | null>;
    /** Every pack, on sale or not, cheapest first. */
    listCreditPacks(): Promise<CreditPack[]>;
    createCreditPack(input: Omit<CreditPack, "id">): Promise<CreditPack>;
    updateCreditPack(id: string, patch: Partial<Omit<CreditPack, "id">>): Promise<CreditPack>;
    getTopUpRange(): Promise<TopUpRange>;
    updateTopUpRange(patch: Partial<TopUpRange>): Promise<TopUpRange>;
  };

  usage: {
    listUsage(filter: { userId?: string; limit?: number }): Promise<UsageEntry[]>;
    getUsageSummary(filter: { userId?: string }): Promise<UsageSummary>;
  };
}

export interface MarkupRule {
  creditsPerUsd: number;
  default: number;
  perApp?: Record<string, number>;
}

/** A retail price: wholesale cost in USD, marked up, converted to credits and rounded up. */
export function creditsFor(wholesaleUsd: number, app: string, rule: MarkupRule): number {
  const markup = rule.perApp?.[app] ?? rule.default;
  return Math.ceil(wholesaleUsd * markup * rule.creditsPerUsd - 1e-9);
}

/**
 * Credits for a top-up of the user's own amount: the rate of the largest pack it reaches, so an
 * amount between packs never beats buying the packs, and the base rate below the smallest pack.
 */
export function topUpCredits(amountUsd: number, packs: ReadonlyArray<CreditPack>, creditsPerUsd: number): number {
  const reached = packs
    .filter((pack) => pack.active && Number(pack.price.amount) > 0 && Number(pack.price.amount) <= amountUsd)
    .sort((a, b) => Number(b.price.amount) - Number(a.price.amount))[0];
  const rate = reached ? reached.credits / Number(reached.price.amount) : creditsPerUsd;
  return Math.floor(amountUsd * rate + 1e-9);
}

/** A user's credit balance is their allocation's available amount, at the instance's rate. */
export function balanceInCredits(allocation: Pick<Allocation, "available">, rule: MarkupRule): number {
  return Math.max(0, Math.floor(Number(allocation.available.amount) * rule.creditsPerUsd + 1e-9));
}
