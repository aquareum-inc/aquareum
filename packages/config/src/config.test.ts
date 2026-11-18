import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ConfigError, PRESET_NAMES, filterCapabilities, isCapabilityEnabled, loadConfig, preset, validateConfig } from "./index";

describe("presets", () => {
  it.each(PRESET_NAMES)("%s is valid against the schema", (name) => {
    expect(() => preset(name)).not.toThrow();
  });

  it("full serves every surface", () => {
    expect(preset("full").surfaces).toEqual({ app: true, console: true, api: true, mcp: true });
  });

  it("headless serves the API and MCP only", () => {
    expect(preset("headless").surfaces).toEqual({ app: false, console: false, api: true, mcp: true });
  });

  it("adult content is off by default in both", () => {
    for (const name of PRESET_NAMES) expect(preset(name).content?.adultContent).toBe(false);
  });
});

describe("validateConfig", () => {
  it("fills defaults", () => {
    const config = validateConfig({ name: "Acme", surfaces: { app: true, console: false, api: true, mcp: false }, pricing: {} });
    expect(config.pricing?.creditsPerUsd).toBe(100);
  });

  it("reports every problem with its path", () => {
    try {
      validateConfig({ name: "", surfaces: { app: true }, colour: "red" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const paths = (error as ConfigError).issues.map((issue) => issue.path);
      expect(paths).toContain("/name");
      expect(paths).toContain("/surfaces");
      expect((error as ConfigError).message).toContain("colour");
    }
  });

  it("rejects a markup below cost", () => {
    expect(() =>
      validateConfig({ name: "Acme", surfaces: { app: true, console: true, api: true, mcp: true }, pricing: { markup: { default: 0.5 } } }),
    ).toThrow(ConfigError);
  });
});

describe("loadConfig", () => {
  it("falls back to the full preset when no file exists", () => {
    const loaded = loadConfig({ cwd: mkdtempSync(path.join(tmpdir(), "cfg-")), env: {} });
    expect(loaded.file).toBeNull();
    expect(loaded.config.surfaces.app).toBe(true);
  });

  it("reads a file and lets ENGINE_URL override the engine url", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cfg-"));
    writeFileSync(path.join(dir, "instance.config.json"), JSON.stringify({ ...preset("headless"), name: "Acme", engine: { url: "http://a.test" } }));
    const loaded = loadConfig({ cwd: dir, env: { ENGINE_URL: "http://b.test" } });
    expect(loaded.config.name).toBe("Acme");
    expect(loaded.config.engine?.url).toBe("http://b.test");
  });

  it("fails when INSTANCE_CONFIG points at a missing file", () => {
    expect(() => loadConfig({ cwd: tmpdir(), env: { INSTANCE_CONFIG: "nope.json" } })).toThrow(ConfigError);
  });
});

describe("capability rules", () => {
  it("allows everything with an empty allow list", () => {
    expect(isCapabilityEnabled("text-to-video", { allow: [], block: [] })).toBe(true);
  });

  it("lets a headless instance start with transcoding only", () => {
    const rules = { allow: ["*transcode*"], block: [] };
    const offerings = [{ app: "video-transcode" }, { app: "live-transcode" }, { app: "chat" }];
    expect(filterCapabilities(offerings, rules).map((o) => o.app)).toEqual(["video-transcode", "live-transcode"]);
  });

  it("block wins over allow", () => {
    expect(isCapabilityEnabled("media/ffmpeg-live", { allow: ["media/*"], block: ["*-live"] })).toBe(false);
  });
});
