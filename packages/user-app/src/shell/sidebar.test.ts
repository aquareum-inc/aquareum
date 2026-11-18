import { describe, expect, it } from "vitest";

import { sidebarOpenFrom } from "./sidebar";

describe("sidebar state", () => {
  it("is open unless the person closed it", () => {
    expect(sidebarOpenFrom(undefined)).toBe(true);
    expect(sidebarOpenFrom("open")).toBe(true);
    expect(sidebarOpenFrom("closed")).toBe(false);
  });
});
