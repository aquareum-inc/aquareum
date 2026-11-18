import type { MediaKind, Offering } from "@aquareum/api-client/types";
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
  slots: SlotSpec[];
  /** Which discovered apps this mode can run. */
  apps: RegExp;
  /** Used for the request when discovery has no matching app, so the draft can still be written. */
  fallbackApp: string;
  durations?: number[];
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
      },
    ],
    empty: {
      title: "Your shots land here",
      body: "Describe a shot on the left and press Generate. Each one renders in place and is saved to your library.",
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
