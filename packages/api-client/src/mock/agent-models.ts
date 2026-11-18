import type { AgentModel } from "../types";

/**
 * The language models the mock agent can run on. Real open models with their published context
 * sizes, in the shape the live list has, so the menu can be designed and reviewed while the agent
 * itself is mocked. Two apps serve Qwen3.8 27B, as on the live network, to keep that case covered.
 */
export const MOCK_AGENT_MODELS: AgentModel[] = [
  { app: "chat", model: "qwen3.8-27b", context_tokens: 4096, busy: false },
  { app: "blueclaw/chat/qwen3.8-27b", model: "Qwen3.8-27B", context_tokens: 131072, busy: false },
  { app: "northlight/chat/gemma-3-27b", model: "gemma-3-27b", context_tokens: 131072, busy: false },
  { app: "harbor/chat/mistral-small-3.2", model: "Mistral-Small-3.2-24B", context_tokens: 131072, busy: true },
];
