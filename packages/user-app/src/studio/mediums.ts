import type { MediaKind, Offering, StudioMedium } from "@aquareum/api-client/types";
import { AudioLines, Clapperboard, Film, Image as ImageIcon, ImagePlus, Images, Mic, type LucideIcon } from "lucide-react";

export type Medium = MediaKind;

export interface SlotSpec {
  label: string;
  icon: LucideIcon;
  accept: string;
  compact?: boolean;
}

export interface ModeSpec {
  value: string;
  label: string;
  placeholder: string;
  /** The placeholder where inputs can't be added yet, when `placeholder` mentions them. */
  wordsPlaceholder?: string;
  slots: SlotSpec[];
  /** Which discovered apps this mode can run. */
  apps: RegExp;
  /** Used for the request when discovery has no matching app, so the draft can still be written. */
  fallbackApp: string;
  durations?: number[];
  /** The mode only makes sense with an input: a source to edit, or references to follow. */
  needsInput?: boolean;
}

export interface MediumSpec {
  label: string;
  icon: LucideIcon;
  modes: ModeSpec[];
  aspects: Array<"16:9" | "9:16" | "1:1"> | null;
  resolutions: Array<"720p" | "1080p"> | null;
  promptLimit: number;
  /** How many at once. */
  maxVariants: number;
  noun: string;
  empty: { title: string; body: string };
}

const frame: SlotSpec = { label: "First frame", icon: ImagePlus, accept: "image/*" };
const reference: SlotSpec = { label: "Reference", icon: Images, accept: "image/*,video/*", compact: true };

export const MEDIUMS: Record<Medium, MediumSpec> = {
  video: {
    label: "Video",
    icon: Clapperboard,
    noun: "video generation",
    aspects: ["16:9", "9:16", "1:1"],
    resolutions: ["720p", "1080p"],
    promptLimit: 2500,
    maxVariants: 1,
    modes: [
      {
        value: "frames",
        label: "Frames",
        placeholder: "Describe the shot, or add a first and last frame…",
        wordsPlaceholder: "Describe the shot: subject, movement, light…",
        slots: [frame, { ...frame, label: "Last frame" }],
        apps: /^(text|image)-to-video$/,
        fallbackApp: "text-to-video",
        durations: [5, 10, 15],
      },
      {
        value: "references",
        label: "References",
        placeholder: "Describe the scene and how the references should be used…",
        slots: [reference, reference, reference],
        apps: /^(text|image)-to-video$/,
        fallbackApp: "image-to-video",
        durations: [5, 10, 15],
        needsInput: true,
      },
      {
        value: "edit",
        label: "Edit",
        placeholder: "Describe how the source video should change…",
        slots: [
          { label: "Source video", icon: Film, accept: "video/*" },
          { label: "Guide image", icon: ImagePlus, accept: "image/*" },
        ],
        apps: /^video-to-video$/,
        fallbackApp: "video-to-video",
        durations: [5, 10, 15],
        needsInput: true,
      },
    ],
    empty: {
      title: "Your shots land here",
      body: "Describe a shot and press Generate. Each one renders in place and is saved to your library.",
    },
  },
  image: {
    label: "Image",
    icon: ImageIcon,
    noun: "image generation",
    aspects: ["1:1", "16:9", "9:16"],
    resolutions: null,
    promptLimit: 1500,
    maxVariants: 4,
    modes: [
      {
        value: "create",
        label: "Create",
        placeholder: "Describe the image: subject, setting, light, style…",
        slots: [{ label: "Style reference", icon: Images, accept: "image/*", compact: true }],
        apps: /^text-to-image$/,
        fallbackApp: "text-to-image",
      },
      {
        value: "edit",
        label: "Edit",
        placeholder: "Describe what to change, remove or combine…",
        slots: [
          { label: "Source image", icon: ImagePlus, accept: "image/*" },
          { label: "Reference", icon: Images, accept: "image/*" },
        ],
        apps: /^image-edit$/,
        fallbackApp: "image-edit",
        needsInput: true,
      },
    ],
    empty: {
      title: "Your images land here",
      body: "Useful as first frames: make a still here, then open it in Video to set it moving.",
    },
  },
  audio: {
    label: "Audio",
    icon: AudioLines,
    noun: "audio generation",
    aspects: null,
    resolutions: null,
    promptLimit: 4000,
    maxVariants: 1,
    modes: [
      {
        value: "music",
        label: "Music",
        placeholder: "Describe the music: mood, instruments, how it should build…",
        slots: [],
        apps: /^music$/,
        fallbackApp: "music",
        durations: [15, 30, 60],
      },
      {
        value: "voice",
        label: "Voice",
        placeholder: "Write the words to be spoken…",
        slots: [{ label: "Voice sample", icon: Mic, accept: "audio/*", compact: true }],
        apps: /^text-to-speech$/,
        fallbackApp: "text-to-speech",
      },
    ],
    empty: {
      title: "Your audio lands here",
      body: "Scores and narration for your shots. Anything made here can be laid under a video from the library.",
    },
  },
};

export const MEDIUM_ORDER: Medium[] = ["video", "image", "audio"];

export function isMedium(value: string): value is Medium {
  return (MEDIUM_ORDER as string[]).includes(value);
}

export function offeringsFor(mode: ModeSpec, offerings: ReadonlyArray<Offering>): Offering[] {
  return offerings.filter((offering) => offering.modes.includes("single-shot") && mode.apps.test(offering.app));
}

/**
 * The studio as clients that can't run this file read it (the native apps): every medium and mode, with
 * each mode's capability resolved against what the network offers now.
 */
export function describeStudio(offerings: ReadonlyArray<Offering>): StudioMedium[] {
  return MEDIUM_ORDER.map((kind) => {
    const spec = MEDIUMS[kind];
    return {
      kind,
      label: spec.label,
      aspects: spec.aspects,
      resolutions: spec.resolutions,
      prompt_limit: spec.promptLimit,
      max_variants: spec.maxVariants,
      empty: spec.empty,
      modes: spec.modes.map((mode) => {
        const offered = offeringsFor(mode, offerings);
        return {
          value: mode.value,
          label: mode.label,
          placeholder: mode.placeholder,
          words_placeholder: mode.wordsPlaceholder ?? mode.placeholder,
          app: offered[0]?.app ?? mode.fallbackApp,
          available: offered.length > 0,
          durations: mode.durations ?? null,
          inputs: mode.slots.map((slot) => slot.label),
          needs_input: mode.needsInput ?? false,
        };
      }),
    };
  });
}
