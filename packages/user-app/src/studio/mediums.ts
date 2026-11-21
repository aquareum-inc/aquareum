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

/** A mode's key across mediums, as `video:text`. */
export const modeKey = (medium: Medium, mode: ModeSpec): string => `${medium}:${mode.value}`;

/**
 * The modes this instance has taken out of the studio: the network offers them, but the instance offers none of
 * what they run in the studio, because the operator switched it off or placed it elsewhere. A mode the network
 * doesn't offer at all stays, shown as unavailable until an operator comes online.
 */
export function withdrawnModes(network: ReadonlyArray<Offering>, offered: ReadonlyArray<Offering>): string[] {
  return MEDIUM_ORDER.flatMap((medium) =>
    MEDIUMS[medium].modes.filter((mode) => offeringsFor(mode, network).length > 0 && offeringsFor(mode, offered).length === 0).map((mode) => modeKey(medium, mode)),
  );
}

/** A medium's modes, less those withdrawn. A medium left with none isn't offered. */
export function studioModes(medium: Medium, withdrawn: ReadonlyArray<string>): ModeSpec[] {
  return MEDIUMS[medium].modes.filter((mode) => !withdrawn.includes(modeKey(medium, mode)));
}

/**
 * The studio as clients that can't run this file read it (the native apps): every medium and mode the instance
 * offers, with each mode's capability resolved against what the network offers now. `offered` is what the
 * instance offers in the studio; it defaults to everything on the network.
 */
export function describeStudio(network: ReadonlyArray<Offering>, offered: ReadonlyArray<Offering> = network): StudioMedium[] {
  const withdrawn = withdrawnModes(network, offered);
  return MEDIUM_ORDER.flatMap((kind) => {
    const spec = MEDIUMS[kind];
    const modes = studioModes(kind, withdrawn);
    if (modes.length === 0) return [];
    return [{
      kind,
      label: spec.label,
      aspects: spec.aspects,
      resolutions: spec.resolutions,
      prompt_limit: spec.promptLimit,
      max_variants: spec.maxVariants,
      empty: spec.empty,
      modes: modes.map((mode) => {
        const resolved = offeringsFor(mode, offered);
        return {
          value: mode.value,
          label: mode.label,
          placeholder: mode.placeholder,
          words_placeholder: mode.wordsPlaceholder ?? mode.placeholder,
          app: resolved[0]?.app ?? mode.fallbackApp,
          available: resolved.length > 0,
          durations: mode.durations ?? null,
          inputs: mode.slots.map((slot) => slot.label),
          needs_input: mode.needsInput ?? false,
        };
      }),
    }];
  });
}
