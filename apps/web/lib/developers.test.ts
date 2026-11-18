import { describe, expect, it } from "vitest";

import { developerPathServed, developerTabs } from "./developers";

describe("developer section", () => {
  it("serves every tab with the API on, and the MCP pages without it", () => {
    expect(developerTabs({ api: true, mcp: true })).toEqual(["/developers", "/developers/keys", "/developers/models", "/developers/playground", "/developers/examples"]);
    expect(developerTabs({ api: false, mcp: true })).toEqual(["/developers", "/developers/keys", "/developers/models"]);
    expect(developerTabs({ api: false, mcp: false })).toEqual([]);
  });

  it("turns off pages whose tab isn't served, and leaves the rest of the app alone", () => {
    const mcpOnly = { api: false, mcp: true };
    expect(developerPathServed("/developers/models/text-to-image", mcpOnly)).toBe(true);
    expect(developerPathServed("/developers/playground", mcpOnly)).toBe(false);
    expect(developerPathServed("/developers-guide", { api: false, mcp: false })).toBe(true);
    expect(developerPathServed("/developers", { api: false, mcp: false })).toBe(false);
    expect(developerPathServed("/studio", { api: false, mcp: false })).toBe(true);
  });
});
