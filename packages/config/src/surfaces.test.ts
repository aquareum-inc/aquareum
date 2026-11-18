import { describe, expect, it } from "vitest";

import { capabilitiesFor, placeCapability } from "./surfaces";

const single = (app: string) => ({ app, modes: ["single-shot"] });
const session = (app: string) => ({ app, modes: ["persistent"] });

describe("placeCapability", () => {
  it.each([
    ["text-to-video", "generation", ["chat", "studio"]],
    ["image-to-video", "generation", ["chat", "studio"]],
    ["text-to-image", "generation", ["chat", "studio"]],
    ["image-edit", "generation", ["chat", "studio"]],
    ["music", "generation", ["chat", "studio"]],
    ["text-to-speech", "generation", ["chat", "studio"]],
    ["image-to-3d", "generation", ["chat", "studio"]],
    ["video-understanding", "understanding", ["chat", "library"]],
    ["transcription", "understanding", ["chat", "library"]],
    ["translation", "understanding", ["chat", "library"]],
    ["chat", "language", ["chat"]],
    ["blueclaw/chat/qwen3.8-27b", "language", ["chat"]],
    ["video-transcode", "media-action", ["library"]],
    ["media/ffmpeg-trim-video", "media-action", ["library"]],
  ])("%s → %s", (app, kind, surfaces) => {
    const placement = placeCapability(single(app));
    expect(placement.kind).toBe(kind);
    expect(placement.surfaces).toEqual(surfaces);
  });

  it("sends real-time sessions to the studio's Live mode", () => {
    expect(placeCapability(session("live/video-to-video")).surfaces).toEqual(["live"]);
    expect(placeCapability(session("live/sd-turbo")).kind).toBe("realtime-session");
  });

  it("sends real-time avatars to characters", () => {
    expect(placeCapability(session("live-avatar"))).toMatchObject({ kind: "realtime-character", surfaces: ["characters"] });
  });

  it("treats transcoding and delivery sessions as support for Live output", () => {
    for (const app of ["live-transcode", "live-delivery", "media/ffmpeg-live"]) {
      expect(placeCapability(session(app)).kind).toBe("stream-support");
    }
  });

  it("leaves unknown capabilities unmapped, for the catalogue and generic run screen", () => {
    expect(placeCapability(single("acme/protein-folding"))).toEqual({ kind: "unmapped", surfaces: [], mediaAction: false });
  });

  it("marks media actions", () => {
    expect(placeCapability(single("video-transcode")).mediaAction).toBe(true);
  });

  it("applies an operator's surface override", () => {
    const overrides = { "acme/protein-folding": { surfaces: ["studio" as const] } };
    expect(placeCapability(single("acme/protein-folding"), overrides).surfaces).toEqual(["studio"]);
  });
});

describe("capabilitiesFor", () => {
  it("lists what a surface presents", () => {
    const all = [single("text-to-video"), single("chat"), session("live/sd-turbo"), single("video-transcode")];
    expect(capabilitiesFor("studio", all).map((c) => c.app)).toEqual(["text-to-video"]);
    expect(capabilitiesFor("chat", all).map((c) => c.app)).toEqual(["text-to-video", "chat"]);
    expect(capabilitiesFor("live", all).map((c) => c.app)).toEqual(["live/sd-turbo"]);
  });
});
