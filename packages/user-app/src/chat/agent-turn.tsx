"use client";

import type { AgentMessage, AgentStep, AppModel, Generation, VideoMoment } from "@livepeer/api-client/types";
import { EASE_OUT_EXPO, cn } from "@livepeer/ui";
import { Check, ChevronDown, Clapperboard, Eye, ListTree, Wrench } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ThinkingOrb } from "thinking-orbs";

import { agentOrbState } from "../lib/agent-orb";
import { workLabel } from "../lib/capability-menu";
import { GenerationTile } from "../studio/generation-tile";

export interface AgentTurnProps {
  message: AgentMessage;
  generations: ReadonlyArray<Generation>;
  /** The models behind the apps on offer, so each step can say which one did the work. */
  models: ReadonlyArray<AppModel>;
  onOpenInStudio: (generation: Generation) => void;
  onOpenMoment: (moment: VideoMoment) => void;
}

const STEP_ICON = { plan: ListTree, tool: Wrench, review: Eye } as const;

function seconds(ms: number): string {
  const value = Math.max(1, Math.round(ms / 1000));
  return `${value}s`;
}

function timestamp(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function StepRow({ step, last, model }: { step: AgentStep; last: boolean; model: AppModel | undefined }) {
  const Icon = step.state === "done" ? Check : STEP_ICON[step.kind];
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {last ? null : <span aria-hidden className="absolute left-[11px] top-7 h-[calc(100%-28px)] w-px bg-hairline" />}
      <span
        className={cn(
          "relative mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline text-muted-foreground",
          step.state === "running" && "animate-breathe text-foreground",
          step.state === "pending" && "opacity-40",
        )}
      >
        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
      <div className={cn("min-w-0 flex-1", step.state === "pending" && "opacity-40")}>
        <p className="flex flex-wrap items-center gap-x-2 text-body font-medium text-foreground">
          {step.title}
          {step.app ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground" title={step.app}>
              {workLabel(step.app, model)}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-caption text-muted-foreground">{step.detail}</p>
      </div>
    </li>
  );
}

/**
 * One agent turn. While it works, each tool call shows as a step; when it finishes the steps fold
 * into a one-line summary that opens again in place.
 */
export function AgentTurn({ message, generations, models, onOpenInStudio, onOpenMoment }: AgentTurnProps) {
  const working = message.state === "working";
  const [expanded, setExpanded] = useState(false);
  const open = working || expanded;
  const running = message.steps.find((step) => step.state === "running");
  const count = message.steps.length;

  return (
    <div className="flex gap-3">
      {/* The agent's orb: it shows what kind of work is happening, and holds still once the turn is done. */}
      <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center">
        <ThinkingOrb state={working ? agentOrbState(running) : "breathing"} paused={!working} size={20} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          disabled={working}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={open}
          className="inline-flex h-7 items-center gap-1.5 rounded-full text-body text-muted-foreground transition-colors enabled:hover:text-foreground"
        >
          {working ? (
            <span className="animate-breathe">{running?.title ?? "Starting"}…</span>
          ) : (
            <>
              Worked for {seconds(message.elapsed_ms)} · {count} {count === 1 ? "step" : "steps"}
              <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
            </>
          )}
        </button>

        <AnimatePresence initial={false}>
          {open && count > 0 ? (
            <motion.ol
              key="steps"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
              className="overflow-hidden"
            >
              <div className="pb-1 pt-2">
                {message.steps.map((step, index) => (
                  <StepRow key={step.id} step={step} last={index === count - 1} model={models.find((entry) => entry.app === step.app)} />
                ))}
              </div>
            </motion.ol>
          ) : null}
        </AnimatePresence>

        {generations.length > 0 ? (
          <ul className={cn("mt-3 grid gap-3", generations.length > 1 ? "grid-cols-1 sm:grid-cols-3" : "max-w-[460px] grid-cols-1")}>
            {generations.map((generation) => (
              <GenerationTile key={generation.id} generation={generation} caption={false} onOpenInStudio={onOpenInStudio} />
            ))}
          </ul>
        ) : null}

        {message.analysis ? (
          <ol className="mt-3 max-w-[62ch] divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
            {message.analysis.moments.map((moment) => (
              <li key={moment.at_seconds}>
                <button
                  type="button"
                  onClick={() => onOpenMoment(moment)}
                  title="Open this moment in the studio"
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-hover"
                >
                  <span className="w-12 shrink-0 rounded-full bg-muted py-0.5 text-center font-mono text-[11px] text-muted-foreground">{timestamp(moment.at_seconds)}</span>
                  <span className="min-w-0 flex-1 text-body text-foreground">{moment.label}</span>
                  <Clapperboard className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        {message.text ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
            className="mt-3 max-w-[62ch] text-lead text-foreground"
          >
            {message.text}
          </motion.p>
        ) : null}
      </div>
    </div>
  );
}
