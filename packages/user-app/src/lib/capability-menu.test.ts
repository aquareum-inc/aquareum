import type { Offering } from "@livepeer/api-client/types";
import { describe, expect, it } from "vitest";

import { agentModelEntries, appName, capabilityEntries, capabilityEntry, contextLabel, modelLabel, modelName, workLabel } from "./capability-menu";

function offering(app: string, ready = 1): Offering {
  return {
    app,
    modes: ["single-shot"],
    rate_low: null,
    rate_high: null,
    rate_status: "ok",
    stale: false,
    runner_count: 1,
    ready_count: ready,
    observed_at: "2026-11-18T00:00:00Z",
  };
}

describe("capability entries", () => {
  it("describes known apps and falls back on the shape of the name", () => {
    expect(capabilityEntry(offering("text-to-video"))).toMatchObject({ name: "Text to video", description: "A shot from a description", busy: false });
    expect(capabilityEntry(offering("media/ffmpeg-metadata"))).toMatchObject({ name: "Media details" });
    expect(capabilityEntry(offering("live/sd-turbo", 0))).toMatchObject({ name: "Sd turbo", description: "Makes images from your request", busy: true });
  });

  it("lists an app once, busy only if every listing is", () => {
    const entries = capabilityEntries([offering("transcription", 0), offering("transcription", 1)]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.busy).toBe(false);
  });
});

describe("model names", () => {
  it("reads the ids runners report", () => {
    expect(modelLabel("black-forest-labs/FLUX.2-klein-4B")).toBe("FLUX.2 klein 4B");
    expect(modelLabel("stabilityai/sd-turbo")).toBe("SD Turbo");
    expect(modelLabel("ACE-Step/Ace-Step1.5")).toBe("ACE-Step 1.5");
    expect(modelLabel("kokoro")).toBe("Kokoro");
    expect(modelLabel("openai/whisper-large-v3-turbo")).toBe("Whisper large v3 turbo");
    expect(modelLabel("qwen3.8-27b")).toBe("Qwen3.8 27B");
  });

  it("names the model under each capability, and says what a narrow model really does", () => {
    const models = [
      { app: "text-to-image", model: "black-forest-labs/FLUX.2-klein-4B", context_tokens: null },
      { app: "image-edit", model: "ZhengPeng7/BiRefNet", context_tokens: null },
    ];
    const entries = capabilityEntries([offering("text-to-image"), offering("image-edit"), offering("media/ffmpeg-trim-video")], models);
    expect(entries.map(({ name, description }) => ({ name, description }))).toEqual([
      { name: "Text to image", description: "A still from a description · FLUX.2 klein 4B" },
      { name: "Remove background", description: "Cuts the subject out of an image · BiRefNet" },
      { name: "Ffmpeg trim video", description: "Makes video from your request" },
    ]);
  });

  it("labels the work in the agent's steps", () => {
    expect(workLabel("text-to-image", { app: "text-to-image", model: "black-forest-labs/FLUX.2-klein-4B", context_tokens: null })).toBe("Text to image · FLUX.2 klein 4B");
    expect(workLabel("chat", { app: "chat", model: "qwen3.8-27b", context_tokens: 4096 })).toBe("Chat · Qwen3.8 27B");
    expect(workLabel("blueclaw/chat/qwen3.8-27b", { app: "blueclaw/chat/qwen3.8-27b", model: "Qwen3.8-27B", context_tokens: 131072 })).toBe("Qwen3.8 27B");
    expect(workLabel("text-to-video")).toBe("Text to video");
  });
});

describe("agent models", () => {
  const model = (app: string, id: string, context: number | null, busy = false) => ({ app, model: id, context_tokens: context, busy });

  it("shows one row per model, sending to the copy with the most context", () => {
    const models = [model("chat", "qwen3.8-27b", 4096), model("blueclaw/chat/qwen3.8-27b", "Qwen3.8-27B", 131072), model("acme/chat/gemma-3-27b", "gemma-3-27b", null)];
    expect(agentModelEntries(models)).toEqual([
      { app: "blueclaw/chat/qwen3.8-27b", also: ["chat"], name: "Qwen3.8 27B", description: "Up to 128K context", busy: false },
      { app: "acme/chat/gemma-3-27b", also: [], name: "Gemma 3 27B", description: "Plans and writes your jobs", busy: false },
    ]);
    expect(contextLabel(512)).toBe("512 tokens of context");
  });

  it("prefers a copy with a runner free over a larger busy one", () => {
    const models = [model("chat", "qwen3.8-27b", 4096), model("blueclaw/chat/qwen3.8-27b", "Qwen3.8-27B", 131072, true)];
    expect(agentModelEntries(models)[0]).toMatchObject({ app: "chat", also: ["blueclaw/chat/qwen3.8-27b"], busy: false });
  });

  it("is busy only when every copy is", () => {
    expect(agentModelEntries([model("harbor/chat/mistral-small-3.2", "Mistral-Small-3.2-24B", 131072, true)])[0]).toMatchObject({ name: "Mistral Small 3.2 24B", busy: true });
  });

  it("names models readably", () => {
    expect(modelName("qwen3.8-27b")).toBe("Qwen3.8 27B");
    expect(modelName("mistral-small")).toBe("Mistral small");
  });

  it("names any app by what it is", () => {
    expect(appName("blueclaw/chat/qwen3.8-27b")).toBe("Qwen3.8 27B");
    expect(appName("media/ffmpeg-trim-video")).toBe("Ffmpeg trim video");
    expect(appName("image-to-3d")).toBe("Image to 3D");
  });
});
