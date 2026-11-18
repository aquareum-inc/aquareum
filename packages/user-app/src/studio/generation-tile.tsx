"use client";

import type { Generation } from "@aquareum/api-client/types";
import { EASE_OUT_EXPO, cn } from "@aquareum/ui";
import { Clapperboard, Download, Play, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { MediaStill } from "../media/media-still";

export interface GenerationTileProps {
  generation: Generation;
  onReuse?: (generation: Generation) => void;
  onOpenInStudio?: (generation: Generation) => void;
  /** Show the prompt under the tile. */
  caption?: boolean;
}

const ASPECT_CLASS: Record<Generation["request"]["aspect"], string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
};

const STATE_LABEL: Record<Generation["state"], string> = {
  queued: "Waiting for a runner",
  running: "Making it",
  succeeded: "Ready",
  failed: "Didn’t finish",
};

/** A still waveform for an audio result, drawn from the result's seed. */
function Waveform({ seed }: { seed: number }) {
  return (
    <span aria-hidden className="absolute inset-x-6 inset-y-0 flex items-center justify-between">
      {Array.from({ length: 48 }, (_, index) => {
        const height = 18 + ((Math.sin(index * 0.9 + seed) + Math.sin(index * 0.37 + seed * 2) + 2) / 4) * 62;
        return <span key={index} className="w-[3px] rounded-full bg-white/70" style={{ height: `${height}%` }} />;
      })}
    </span>
  );
}

function TileAction({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform duration-200 ease-out-expo hover:bg-black/60 active:scale-[0.92]"
    >
      {children}
    </button>
  );
}

/**
 * One tile from request to result. The frame is there from the start, out of focus and breathing;
 * as the job renders it sharpens into the finished shot. Nothing is swapped out.
 */
export function GenerationTile({ generation, onReuse, onOpenInStudio, caption = true }: GenerationTileProps) {
  const done = generation.state === "succeeded";
  const blur = done ? 0 : 28 - generation.progress * 20;
  const percent = Math.round(generation.progress * 100);
  const { kind, duration_seconds: duration, resolution } = generation.request;
  const audio = kind === "audio";
  const label = [duration ? `${duration}s` : null, resolution, kind === "image" ? generation.request.aspect : null]
    .filter(Boolean)
    .join(" · ");
  // A shot that is already finished when it first appears (a reloaded page) has nothing to announce.
  const [arrivedDone] = useState(done);

  return (
    <motion.li
      layout
      initial={arrivedDone ? false : { opacity: 0, scale: 0.94, y: 12, filter: "blur(6px)" }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.36, ease: EASE_OUT_EXPO, layout: { type: "spring", stiffness: 420, damping: 36 } }}
      className="flex flex-col gap-2"
    >
      <div
        className={cn(
          "group relative w-full overflow-hidden rounded-media ring-1 ring-hairline",
          audio ? "aspect-[16/5]" : ASPECT_CLASS[generation.request.aspect],
          done && !arrivedDone && "animate-settle",
        )}
      >
        <div
          className={cn("absolute inset-0 transition-[filter,transform] duration-700 ease-out-expo", !done && "animate-breathe")}
          style={{ filter: `blur(${blur}px) saturate(${done ? 1 : 0.7})`, transform: done ? "scale(1)" : "scale(1.12)" }}
        >
          {/* A shot that starts from an image, such as a character's portrait, shows that frame. */}
          <MediaStill image={generation.request.first_frame ?? null} artwork={generation.artwork} still={!done} eager />
        </div>

        {done ? (
          <>
            {audio ? <Waveform seed={generation.artwork.seed} /> : null}
            {kind === "image" ? null : (
            <span className="absolute inset-0 flex items-center justify-center">
              <motion.span
                initial={arrivedDone ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: [0.34, 1.2, 0.64, 1] }}
                className="inline-flex size-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
              >
                <Play className="size-5 translate-x-px fill-current" aria-hidden />
              </motion.span>
            </span>
            )}
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
              {onOpenInStudio ? (
                <TileAction label="Open in studio" onClick={() => onOpenInStudio(generation)}><Clapperboard className="size-4" /></TileAction>
              ) : null}
              {onReuse ? (
                <TileAction label="Reuse these settings" onClick={() => onReuse(generation)}><RotateCcw className="size-4" /></TileAction>
              ) : null}
              <TileAction label="Download"><Download className="size-4" /></TileAction>
            </div>
            <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[11px] text-white backdrop-blur-md">
              {label}
            </span>
          </>
        ) : (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5" role="status" aria-live="polite">
            <span className="text-caption font-medium text-white">{STATE_LABEL[generation.state]}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <span
                className="block h-full rounded-full bg-white transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(4, percent)}%` }}
              />
            </span>
            <span className="w-8 text-right font-mono text-[11px] text-white/80">{percent}%</span>
          </div>
        )}
      </div>
      {caption ? <p className="line-clamp-2 px-0.5 text-caption text-muted-foreground">{generation.request.prompt}</p> : null}
    </motion.li>
  );
}
