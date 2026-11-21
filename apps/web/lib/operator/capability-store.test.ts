import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { NotOffered } from "@aquareum/api-client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { apiFor } from "../api";
import { studioOfferings } from "../catalogue";
import { configCapabilityStore } from "./settings";

const dir = mkdtempSync(path.join(tmpdir(), "aquareum-capabilities-"));
const file = path.join(dir, "instance.config.json");
const read = () => JSON.parse(readFileSync(file, "utf8"));
const offering = (app: string) => ({ app, modes: ["single-shot"] }) as never;

beforeAll(() => {
  writeFileSync(file, JSON.stringify({ name: "Test", surfaces: { app: true, console: true, api: true, mcp: true }, capabilities: { block: ["*-experimental"], overrides: { music: { label: "Score" } } } }));
  vi.stubEnv("INSTANCE_CONFIG", file);
  vi.stubEnv("MOCK_ONLY", "1");
});
afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("capability settings saved from the console", () => {
  const store = configCapabilityStore();

  it("switches a capability off and on as an exact entry in the block list, keeping the file's own rules", async () => {
    await store.write("text-to-image", { enabled: false });
    expect(read().capabilities.block).toEqual(["*-experimental", "text-to-image"]);
    expect(store.read("text-to-image").enabled).toBe(false);
    expect(studioOfferings([offering("text-to-image"), offering("text-to-video")]).map((entry: { app: string }) => entry.app)).toEqual(["text-to-video"]);
    const client = apiFor(null);
    expect((await client.listOfferings()).data.some((entry) => entry.app === "text-to-image")).toBe(false);
    await expect(client.createGeneration({ kind: "image", app: "text-to-image", prompt: "A lighthouse", aspect: "1:1", duration_seconds: null, resolution: null })).rejects.toThrow(NotOffered);
    await store.write("text-to-image", { enabled: true });
    expect(read().capabilities.block).toEqual(["*-experimental"]);
  });

  it("places a capability with a surface override, keeping its label", async () => {
    await store.write("music", { surfaces: ["chat"] });
    expect(read().capabilities.overrides.music).toEqual({ label: "Score", surfaces: ["chat"] });
    expect(studioOfferings([offering("music")])).toEqual([]);
    await store.write("music", { surfaces: null });
    expect(read().capabilities.overrides.music).toEqual({ label: "Score" });
    expect(store.read("music").surfaces).toBeNull();
  });

  it("keeps markups in pricing and refuses one below 1", async () => {
    await store.write("music", { markup: 1.5 });
    expect(read().pricing.markup.perApp).toEqual({ music: 1.5 });
    await expect(store.write("music", { markup: 0.5 })).rejects.toThrow();
  });
});
