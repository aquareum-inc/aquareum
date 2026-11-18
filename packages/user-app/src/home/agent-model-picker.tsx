"use client";

import type { AgentModel } from "@aquareum/api-client/types";
import { Bot } from "lucide-react";
import { useEffect, useMemo } from "react";

import { agentModelEntries } from "../lib/capability-menu";
import { MenuPicker } from "./offering-picker";

export interface AgentModelPickerProps {
  /** The language models on offer (`listAgentModels`). */
  models: ReadonlyArray<AgentModel>;
  /** The language model that runs the agent; `null` is Auto. */
  value: string | null;
  onValueChange: (model: string | null) => void;
}

/**
 * Chooses the language model that runs the agent, shown only when there is more than one to choose:
 * the agent reads the request, plans the steps and picks a capability for each. What gets made is
 * the agent's call, steered by the words, what is attached and the starting points; capabilities are
 * chosen directly in the studio.
 */
export function AgentModelPicker({ models, value, onValueChange }: AgentModelPickerProps) {
  const entries = useMemo(() => agentModelEntries(models), [models]);
  // With one model or none, Auto is the only real choice, so there is nothing to pick, and a model
  // carried over from an earlier message must not ride along unseen.
  const choosing = entries.length >= 2;
  useEffect(() => {
    if (!choosing && value !== null) onValueChange(null);
  }, [choosing, value, onValueChange]);
  if (!choosing) return null;
  return (
    <MenuPicker
      entries={entries}
      value={value}
      onValueChange={onValueChange}
      auto={{ description: "Picks a model for each request" }}
      icon={<Bot className="size-4" aria-hidden />}
      side="top"
    />
  );
}
