import { describe, expect, it } from "vitest";

import { homePath, surfacePathServed } from "./surfaces";

const all = { app: true, console: true, api: true, mcp: true };
const headless = { app: false, console: true, api: true, mcp: true };
const apiOnly = { app: false, console: false, api: true, mcp: true };

describe("surfaces", () => {
  it("serves everything with every surface on", () => {
    for (const path of ["/", "/studio", "/sign-in", "/auth/start", "/operator", "/operator/users", "/api/v1/offerings", "/api/mcp", "/api/health"]) {
      expect(surfacePathServed(path, all)).toBe(true);
    }
  });

  it("lets operators sign in to the console when there is no app", () => {
    expect(surfacePathServed("/sign-in", headless)).toBe(true);
    expect(surfacePathServed("/auth/callback", headless)).toBe(true);
    expect(surfacePathServed("/operator", headless)).toBe(true);
    expect(surfacePathServed("/studio", headless)).toBe(false);
    expect(homePath(headless)).toBe("/operator");
  });

  it("serves only the API and health check when that's all there is", () => {
    expect(surfacePathServed("/sign-in", apiOnly)).toBe(false);
    expect(surfacePathServed("/operator", apiOnly)).toBe(false);
    expect(surfacePathServed("/api/v1/offerings", apiOnly)).toBe(true);
    expect(surfacePathServed("/api/health", apiOnly)).toBe(true);
    expect(homePath(all)).toBe("/");
  });
});
