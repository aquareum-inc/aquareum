"use client";

import type { AppModel, Generation, GenerationRequest, Offering } from "@aquareum/api-client/types";
import { Button, RollingNumber, cn } from "@aquareum/ui";
import { Coins, Info } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCredits } from "../shell/credits";
import { useLink } from "../shell/link";
import { DraftCard, type Draft } from "./draft-card";
import { GenerationTile } from "./generation-tile";
import { MEDIUMS, MEDIUM_ORDER, offeringsFor, studioModes, type Medium, type MediumSpec, type ModeSpec } from "./mediums";
import { StudioHeader, type StudioTab } from "./studio-header";

export interface StudioScreenProps {
  medium: Medium;
  onTabChange: (tab: StudioTab) => void;
  /** What the instance offers in the studio. */
  offerings: ReadonlyArray<Offering>;
  /** Modes the instance has taken out of the studio (`withdrawnModes`). */
  withdrawn?: ReadonlyArray<string>;
  /** The models behind the capabilities, from their runners. */
  models: ReadonlyArray<AppModel>;
  initialPrompt?: string;
  /** What one result of this draft would cost, in credits. */
  quote: (request: GenerationRequest) => number;
  createGeneration: (request: GenerationRequest) => Promise<Generation>;
  getGeneration: (id: string) => Promise<Generation | null>;
  /** Set for a guest: the composer works, and Generate waits for them to sign in here. */
  signInHref?: string;
}

const POLL_MS = 700;

function requestFor(medium: Medium, spec: MediumSpec, mode: ModeSpec, offerings: ReadonlyArray<Offering>, prompt: string): GenerationRequest {
  return {
    kind: medium,
    app: offeringsFor(mode, offerings)[0]?.app ?? mode.fallbackApp,
    prompt,
    aspect: spec.aspects?.[0] ?? "16:9",
    duration_seconds: mode.durations?.[0] ?? null,
    resolution: spec.resolutions?.[0] ?? null,
  };
}

export function StudioScreen({ medium, onTabChange, offerings, withdrawn = [], models, initialPrompt = "", quote, createGeneration, getGeneration, signInHref }: StudioScreenProps) {
  const Link = useLink();
  const guest = signInHref !== undefined;
  const spec = MEDIUMS[medium];
  const { credits, charge } = useCredits();
  const modes = studioModes(medium, withdrawn);
  const firstMode = modes[0] as ModeSpec;
  const [draft, setDraft] = useState<Draft>(() => ({
    mode: firstMode.value,
    variants: 1,
    request: requestFor(medium, spec, firstMode, offerings, initialPrompt),
  }));
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getRef = useRef(getGeneration);
  getRef.current = getGeneration;

  const mode = modes.find((entry) => entry.value === draft.mode) ?? firstMode;
  const available = offeringsFor(mode, offerings).length > 0;
  const cost = quote(draft.request) * draft.variants;
  const ready = available && draft.request.prompt.trim().length > 0 && !submitting;
  const short = !guest && cost > credits;
  const pending = generations.some((entry) => entry.state === "queued" || entry.state === "running");

  const changeMode = useCallback(
    (value: string) => {
      const nextMode = modes.find((entry) => entry.value === value);
      if (!nextMode) return;
      setDraft((current) => {
        const fresh = requestFor(medium, spec, nextMode, offerings, current.request.prompt);
        return {
          ...current,
          mode: value,
          request: { ...fresh, aspect: current.request.aspect, resolution: current.request.resolution },
        };
      });
    },
    [medium, modes, offerings, spec],
  );

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(async () => {
      const active = generations.filter((entry) => entry.state === "queued" || entry.state === "running");
      const updates = await Promise.all(active.map((entry) => getRef.current(entry.id)));
      setGenerations((current) => current.map((entry) => updates.find((update) => update?.id === entry.id) ?? entry));
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, generations]);

  const generate = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await Promise.all(Array.from({ length: draft.variants }, () => createGeneration(draft.request)));
      charge(created.reduce((total, entry) => total + entry.credits_charged, 0));
      setGenerations((current) => [...created, ...current]);
    } catch {
      setError("That didn’t start. Nothing was charged — try again.");
    } finally {
      setSubmitting(false);
    }
  }, [charge, createGeneration, draft.request, draft.variants]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StudioHeader current={medium} onChange={onTabChange} hidden={MEDIUM_ORDER.filter((entry) => studioModes(entry, withdrawn).length === 0)} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6 md:px-6 lg:flex-row lg:gap-6">
        <section aria-label="Composer" className="flex w-full shrink-0 flex-col gap-3 lg:w-[400px] lg:overflow-y-auto lg:pb-2">
          <DraftCard spec={spec} modes={modes} mode={mode} draft={draft} onChange={setDraft} onModeChange={changeMode} offerings={offerings} models={models} credits={cost} />
          {guest ? (
            <p role="status" className="flex items-start gap-2 rounded-field bg-muted px-3.5 py-3 text-caption text-muted-foreground">
              <Info className="mt-px size-4 shrink-0" aria-hidden />
              <span>
                <Link href={signInHref} className="font-medium text-foreground underline underline-offset-2">Sign in or create an account</Link> to generate. Your
                draft stays here.
              </span>
            </p>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={guest || !ready || short}
            onClick={generate}
            aria-describedby={error ? "generate-error" : undefined}
          >
            {short ? "Not enough credits" : submitting ? "Starting…" : "Generate"}
            {short ? null : (
              <span className="inline-flex items-center gap-1 font-mono text-body opacity-70">
                <Coins className="size-4" aria-hidden />
                <RollingNumber value={cost} />
              </span>
            )}
          </Button>
          {available ? null : (
            <p role="status" className="rounded-field bg-muted px-3.5 py-3 text-caption text-muted-foreground">
              No compute operator on the network is offering {mode.fallbackApp.replace(/-/g, " ")} right now. You
              can still write your draft; Generate turns on when one comes online.
            </p>
          )}
          {error ? (
            <p id="generate-error" role="alert" className="px-1 text-caption text-destructive">
              {error}
            </p>
          ) : null}
        </section>

        <section aria-label="Results" className="min-h-[320px] min-w-0 flex-1 lg:overflow-y-auto">
          {generations.length === 0 ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-card border border-dashed border-input px-6 text-center">
              <div className="mb-5 flex items-end gap-1.5" aria-hidden>
                <span className="h-10 w-[72px] rounded-[10px] bg-secondary" />
                <span className="h-14 w-[100px] rounded-[12px] bg-accent ring-1 ring-hairline" />
                <span className="h-10 w-[72px] rounded-[10px] bg-secondary" />
              </div>
              <h2 className="text-lead font-semibold text-foreground">{spec.empty.title}</h2>
              <p className="mt-1.5 max-w-[340px] text-body text-muted-foreground">{spec.empty.body}</p>
            </div>
          ) : (
            <ul className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", medium === "image" && "xl:grid-cols-3")}>
              <AnimatePresence initial={false}>
                {generations.map((generation) => (
                  <GenerationTile
                    key={generation.id}
                    generation={generation}
                    onReuse={(source) => setDraft((current) => ({ ...current, request: source.request }))}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
