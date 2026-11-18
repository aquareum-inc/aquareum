import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient, createMockProvider } from "./index";

const client = () => createApiClient({ env: { MOCK_ONLY: "1" }, provider: createMockProvider() });

describe("video understanding in chat", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("analyses an attached library video and returns moments", async () => {
    const api = client();
    const [video] = (await api.listMedia({ kind: "video" })).data;
    const created = (await api.createConversation({ text: "Summarise this", app: null, aspect: "16:9", duration_seconds: 5, attachment_ids: [video!.id] })).data;
    vi.advanceTimersByTime(20_000);
    const agent = (await api.getConversation(created.id)).data?.messages[1];
    if (agent?.role !== "agent") throw new Error("expected an agent message");
    expect(agent.steps.every((step) => step.app === "video-understanding")).toBe(true);
    expect(agent.analysis?.moments.length).toBeGreaterThan(0);
    expect(agent.generation_ids).toHaveLength(0);
  });

  it("analyses a linked video", async () => {
    const api = client();
    const created = (await api.createConversation({ text: "What happens in https://example.test/clip.mp4 ?", app: null, aspect: "16:9", duration_seconds: 5 })).data;
    vi.advanceTimersByTime(20_000);
    const agent = (await api.getConversation(created.id)).data?.messages[1];
    expect(agent?.role === "agent" && agent.analysis).toBeTruthy();
  });
});

describe("live sessions (mock)", () => {
  it("goes live, changes the prompt on air, and records to the library", async () => {
    const api = client();
    const session = (await api.startLiveSession({ app: "live-video-to-video", source: "camera", prompt: "Gouache", destination_ids: ["dst_youtube"], record: true })).data;
    expect(session.state).toBe("live");
    expect((await api.updateLiveSession(session.id, "Ink and wash")).data?.prompt).toBe("Ink and wash");
    const ended = (await api.stopLiveSession(session.id)).data;
    expect(ended?.state).toBe("ended");
    expect(ended?.recording_media_id).toBeTruthy();
    const recordings = (await api.listMedia({ source: "recording" })).data;
    expect(recordings.map((item) => item.id)).toContain(ended?.recording_media_id);
    expect((await api.updateLiveSession(session.id, "x")).data).toBeNull();
  });

  it("never returns a stream key, only its last four characters", async () => {
    const api = client();
    const added = (await api.addLiveDestination({ platform: "twitch", label: "Twitch", url: "rtmp://live.twitch.tv/app", stream_key: "live_123456_abcdWXYZ" })).data;
    expect(added.key_hint).toBe("WXYZ");
    expect(JSON.stringify(added)).not.toContain("live_123456");
    expect((await api.removeLiveDestination(added.id)).data).toBe(true);
  });

  it("saves a look", async () => {
    const api = client();
    const look = (await api.saveLiveLook({ name: "Charcoal", prompt: "Charcoal sketch on rough paper" })).data;
    expect((await api.listLiveLooks()).data.map((entry) => entry.id)).toContain(look.id);
  });

  it("connects and ends a character call", async () => {
    const api = client();
    const call = (await api.startCall("juno-live", "video")).data;
    expect(call).toMatchObject({ state: "connected", mode: "video" });
    expect((await api.endCall(call.id)).data?.state).toBe("ended");
  });
});
