import type { AgentStep } from "@livepeer/api-client/types";

/** The thinking orb's animations this product uses, named as the `thinking-orbs` package names them. */
export type AgentOrbState = "breathing" | "solving" | "searching" | "composing" | "weaving" | "working";

/**
 * What the agent's orb shows for the step it is on, so the motion says what kind of work is happening:
 * planning reads as solving, watching or checking as searching, making media as composing, writing a prompt
 * as weaving. Between steps it breathes. The phone apps use the same mapping.
 */
export function agentOrbState(step: Pick<AgentStep, "kind" | "app"> | undefined): AgentOrbState {
  if (!step) return "breathing";
  if (step.kind === "plan") return "solving";
  if (step.kind === "review") return "searching";
  const app = step.app ?? "";
  if (/understanding|detect|segment|caption|transcri/.test(app)) return "searching";
  if (/to-video|to-image|image-edit|video-edit|music|sfx|tts|speech|audio|3d|upscale|restyle/.test(app)) return "composing";
  if (/chat|llm|text/.test(app)) return "weaving";
  return "working";
}
