import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { seal, unseal } = await import("./seal");

describe("sealed cookies", () => {
  const secret = "a".repeat(32);

  it("round-trips a value", () => {
    const value = { userId: "usr_1", builderKey: "lpk_test" };
    expect(unseal(seal(value, secret), secret)).toEqual(value);
  });

  it("does not expose the contents", () => {
    expect(seal({ builderKey: "lpk_test_secret" }, secret)).not.toContain("lpk_test_secret");
  });

  it("rejects a tampered value, a wrong secret and junk", () => {
    const sealed = seal({ role: "user" }, secret);
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("AA") ? "BB" : "AA");
    expect(unseal(tampered, secret)).toBeNull();
    expect(unseal(sealed, "b".repeat(32))).toBeNull();
    expect(unseal("not-a-cookie", secret)).toBeNull();
  });
});
