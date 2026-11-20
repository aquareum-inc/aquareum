import { describe, expect, it } from "vitest";

import { agentOrbState } from "./agent-orb";

describe("the agent's orb", () => {
  it("says what kind of work the running step is", () => {
    expect(agentOrbState(undefined)).toBe("breathing");
    expect(agentOrbState({ kind: "plan", app: null })).toBe("solving");
    expect(agentOrbState({ kind: "review", app: "video-understanding" })).toBe("searching");
    expect(agentOrbState({ kind: "tool", app: "video-understanding" })).toBe("searching");
    expect(agentOrbState({ kind: "tool", app: "text-to-video" })).toBe("composing");
    expect(agentOrbState({ kind: "tool", app: "image-to-video" })).toBe("composing");
    expect(agentOrbState({ kind: "tool", app: "music" })).toBe("composing");
    expect(agentOrbState({ kind: "tool", app: "chat" })).toBe("weaving");
    expect(agentOrbState({ kind: "tool", app: "something-new" })).toBe("working");
  });
});
