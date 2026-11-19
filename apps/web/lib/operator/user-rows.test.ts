import type { Allocation, KnownActor, ProviderUser } from "@aquareum/api-client";
import { describe, expect, it } from "vitest";

import { joinUserRows } from "./user-rows";

const person = (id: string, name: string, email: string): ProviderUser => ({ id, name, email, role: "user", status: "active", created_at: "2026-11-01T00:00:00Z" });
const account = (id: string, label: string, lastSeen: string | null = null): KnownActor => ({
  application_id: "default",
  actor_id: id,
  label,
  name: null,
  allocation: null,
  first_seen_at: null,
  last_seen_at: lastSeen,
  provisioned: true,
});
const usd = (amount: number) => ({ amount: amount.toFixed(2), currency: "USD" });
const allocation: Allocation = { id: "alc_ines", grant_id: "grt", user_id: "usr_ines", status: "active", granted: usd(50), spent: usd(20), available: usd(30) };

describe("joinUserRows", () => {
  it("lists the provider's people with their email, joined to their engine account", () => {
    const rows = joinUserRows({
      users: [person("usr_ines", "Inés Castellanos", "ines@example.test")],
      actors: [account("usr_ines", "ines", "2026-11-18T09:00:00Z")],
      allocationFor: (id) => (id === "usr_ines" ? allocation : null),
      planFor: () => null,
    });
    expect(rows).toEqual([
      expect.objectContaining({ id: "usr_ines", name: "Inés Castellanos", email: "ines@example.test", lastSeen: "2026-11-18T09:00:00Z", budget: 50, remaining: 30 }),
    ]);
  });

  it("keeps engine accounts no one owns, after the people", () => {
    const rows = joinUserRows({
      users: [person("usr_ines", "Inés Castellanos", "ines@example.test")],
      actors: [account("acme", "Acme Studio")],
      allocationFor: () => null,
      planFor: () => null,
    });
    expect(rows.map((row) => [row.name, row.email, row.lastSeen])).toEqual([
      ["Inés Castellanos", "ines@example.test", null],
      ["Acme Studio", null, null],
    ]);
  });

  it("falls back to the engine's accounts when the provider can't list people", () => {
    const rows = joinUserRows({ users: [], actors: [account("acme", "Acme Studio")], allocationFor: () => null, planFor: () => null });
    expect(rows).toEqual([expect.objectContaining({ id: "acme", name: "Acme Studio", email: null, status: "active" })]);
  });
});
