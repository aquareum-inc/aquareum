"use client";

import type { AppModel, GenerationRequest, Offering } from "@aquareum/api-client/types";
import { Chip, EASE_OUT_EXPO, Popover, PopoverContent, PopoverTrigger, RollingNumber, Segmented } from "@aquareum/ui";
import { Coins, SlidersHorizontal, WandSparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { OfferingPicker } from "../home/offering-picker";
import { MediaSlot } from "./media-slot";
import { offeringsFor, type MediumSpec, type ModeSpec } from "./mediums";

export interface Draft {
  mode: string;
  variants: number;
  request: GenerationRequest;
}

export interface DraftCardProps {
  spec: MediumSpec;
  /** The modes the instance offers for this medium. */
  modes: ReadonlyArray<ModeSpec>;
  mode: ModeSpec;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onModeChange: (mode: string) => void;
  offerings: ReadonlyArray<Offering>;
  models: ReadonlyArray<AppModel>;
  credits: number;
}

function next<T>(options: ReadonlyArray<T>, current: T): T {
  return options[(options.indexOf(current) + 1) % options.length] ?? current;
}

/** One draft. Changing mode reshapes this card; it never swaps to another panel. */
export function DraftCard({ spec, modes, mode, draft, onChange, onModeChange, offerings, models, credits }: DraftCardProps) {
  const { request } = draft;
  const set = (patch: Partial<GenerationRequest>) => onChange({ ...draft, request: { ...request, ...patch } });
  const available = offeringsFor(mode, offerings);

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.32, ease: EASE_OUT_EXPO } }}
      className="flex flex-col gap-3 rounded-sheet border border-hairline bg-card p-3 shadow-[var(--surface-highlight)]"
    >
      <motion.div layout="position">
        <Segmented
          label="Composer mode"
          size="sm"
          options={modes.map(({ value, label }) => ({ value, label }))}
          value={draft.mode}
          onValueChange={onModeChange}
          className="w-full [&>button]:flex-1"
        />
      </motion.div>

      <AnimatePresence mode="popLayout" initial={false}>
        {mode.slots.length > 0 ? (
          <motion.div
            key={draft.mode}
            layout="position"
            initial={{ opacity: 0, scale: 0.97, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(2px)", transition: { duration: 0.15 } }}
            transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
            className="flex gap-2"
          >
            {mode.slots.map((slot, index) => (
              <MediaSlot key={`${slot.label}-${index}`} {...slot} />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div layout="position" className="relative rounded-media bg-muted">
        <textarea
          value={request.prompt}
          maxLength={spec.promptLimit}
          onChange={(event) => set({ prompt: event.target.value })}
          aria-label="Prompt"
          placeholder={mode.placeholder}
          rows={5}
          className="block min-h-[132px] w-full resize-none bg-transparent px-3.5 pb-9 pt-3 text-body text-foreground outline-none placeholder:text-subtle-foreground"
        />
        <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between">
          <button
            type="button"
            aria-label="Improve this prompt"
            disabled={request.prompt.trim().length === 0}
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-200 hover:bg-hover hover:text-foreground active:scale-[0.92] disabled:opacity-40"
          >
            <WandSparkles className="size-4" />
          </button>
          <span className="pr-1.5 font-mono text-[11px] text-subtle-foreground">
            {request.prompt.length}/{spec.promptLimit}
          </span>
        </div>
      </motion.div>

      <motion.div layout="position" className="flex flex-wrap items-center gap-1.5">
        {available.length > 0 ? (
          <OfferingPicker offerings={available} models={models} value={request.app} onValueChange={(app) => set({ app })} className="border border-hairline" />
        ) : null}
        {spec.resolutions && request.resolution ? (
          <Chip className="font-mono" aria-label={`Resolution ${request.resolution}. Press to change.`} onClick={() => set({ resolution: next(spec.resolutions ?? [], request.resolution ?? "720p") })}>
            {request.resolution}
          </Chip>
        ) : null}
        {spec.aspects ? (
          <Chip className="font-mono" aria-label={`Aspect ratio ${request.aspect}. Press to change.`} onClick={() => set({ aspect: next(spec.aspects ?? [], request.aspect) })}>
            {request.aspect}
          </Chip>
        ) : null}
        {mode.durations && request.duration_seconds !== null ? (
          <Chip className="font-mono" aria-label={`Duration ${request.duration_seconds} seconds. Press to change.`} onClick={() => set({ duration_seconds: next(mode.durations ?? [], request.duration_seconds ?? 5) })}>
            {request.duration_seconds}s
          </Chip>
        ) : null}
        {spec.maxVariants > 1 ? (
          <Chip className="font-mono" aria-label={`${draft.variants} at once. Press to change.`} onClick={() => onChange({ ...draft, variants: (draft.variants % spec.maxVariants) + 1 })}>
            ×{draft.variants}
          </Chip>
        ) : null}
        {request.kind === "audio" ? null : (
          <Popover>
            <PopoverTrigger asChild>
              <Chip aria-label="More settings" className="w-8 justify-center px-0">
                <SlidersHorizontal />
              </Chip>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-4">
              <label htmlFor="negative-prompt" className="text-caption font-medium text-foreground">
                Leave out
              </label>
              <p className="mt-0.5 text-caption text-subtle-foreground">Things the result should avoid.</p>
              <textarea
                id="negative-prompt"
                rows={3}
                value={request.negative_prompt ?? ""}
                onChange={(event) => set({ negative_prompt: event.target.value })}
                placeholder="Text overlays, fast cuts…"
                className="mt-2 block w-full resize-none rounded-field bg-muted px-3 py-2 text-body outline-none placeholder:text-subtle-foreground"
              />
            </PopoverContent>
          </Popover>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-caption text-muted-foreground" title="Credits this draft will cost">
          <Coins className="size-3.5" aria-hidden />
          <RollingNumber value={credits} />
        </span>
      </motion.div>
    </motion.div>
  );
}
