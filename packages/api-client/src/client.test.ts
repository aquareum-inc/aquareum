import { afterEach, describe, expect, it, vi } from "vitest";

import { DATA_SOURCES, createApiClient, quoteCredits, resolveSource } from "./index";
import { MOCK_OFFERINGS } from "./mock/offerings";

afterEach(() => vi.unstubAllGlobals());

describe("data-source map", () => {
  it("forces every function to mock in mock-only mode", () => {
    for (const name of Object.keys(DATA_SOURCES) as (keyof typeof DATA_SOURCES)[]) {
      expect(resolveSource(name, { MOCK_ONLY: "1" })).toBe("mock");
    }
  });

  it("uses the map otherwise", () => {
    expect(resolveSource("listOfferings", {})).toBe("live");
    expect(resolveSource("createGeneration", {})).toBe("mock");
  });
});

describe("listOfferings", () => {
  it("calls the engine when live", async () => {
    const fetchMock = vi.fn(async (_url: URL | string) => new Response(JSON.stringify([MOCK_OFFERINGS[0]]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient({ engine: { url: "http://engine.test" }, env: {} });
    const result = await client.listOfferings();
    expect(result.source).toBe("live");
    expect(result.data).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://engine.test/v1/offerings");
  });

  it("never calls the engine in mock-only mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient({ engine: { url: "http://engine.test" }, env: { MOCK_ONLY: "1" } });
    const result = await client.listOfferings();
    expect(result.source).toBe("mock");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces an engine failure as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const client = createApiClient({ engine: { url: "http://engine.test" }, env: {} });
    await expect(client.listOfferings()).rejects.toMatchObject({ name: "EngineError", status: 503 });
  });

  it("mock offerings have the engine's shape", () => {
    for (const offering of MOCK_OFFERINGS) {
      expect(Object.keys(offering).sort()).toEqual(
        ["app", "modes", "observed_at", "rate_high", "rate_low", "rate_status", "ready_count", "runner_count", "stale"],
      );
    }
    const modes = new Set(MOCK_OFFERINGS.flatMap((offering) => offering.modes));
    expect(modes).toEqual(new Set(["single-shot", "persistent"]));
  });
});

describe("generations (mock)", () => {
  it("creates a queued job, charges the quote and can be read back", async () => {
    const client = createApiClient({ env: { MOCK_ONLY: "1" } });
    const request = { kind: "video", app: "text-to-video", prompt: "A harbour at first light", aspect: "16:9", duration_seconds: 5, resolution: "720p" } as const;
    const created = await client.createGeneration(request);
    expect(created.data.state).toBe("queued");
    expect(created.data.credits_charged).toBe(quoteCredits(request));
    const read = await client.getGeneration(created.data.id);
    expect(read.data?.id).toBe(created.data.id);
  });

  it("returns null for an unknown job", async () => {
    const client = createApiClient({ env: { MOCK_ONLY: "1" } });
    expect((await client.getGeneration("gen_missing")).data).toBeNull();
  });
});
