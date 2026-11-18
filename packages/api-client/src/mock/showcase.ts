import type { PromptStarter, ShowcaseItem } from "../types";

export const MOCK_SHOWCASE: ShowcaseItem[] = [
  { id: "sc_harbour", kind: "video", app: "text-to-video", title: "Harbour at first light", prompt: "A slow push along a fishing harbour at first light, mist lifting off the water, gulls crossing the frame, 35mm, shallow focus", aspect: "16:9", duration_seconds: 10, image: "/showcase/harbour.webp", artwork: { hues: [212, 32, 265], seed: 3 } },
  { id: "sc_ceramics", kind: "video", app: "image-to-video", title: "Glaze, turning", prompt: "Animate this photo of a ceramic bowl: the wheel turns one full rotation while wet glaze catches the window light", aspect: "9:16", duration_seconds: 5, image: "/showcase/ceramics.webp", artwork: { hues: [24, 48, 350], seed: 11 } },
  { id: "sc_runner", kind: "video", app: "text-to-video", title: "Night run, tracking shot", prompt: "Tracking shot beside a runner on a wet city street at night, neon reflections, steady pace, breath visible", aspect: "16:9", duration_seconds: 10, image: "/showcase/runner.webp", artwork: { hues: [286, 196, 330], seed: 7 } },
  { id: "sc_orchard", kind: "video", app: "text-to-video", title: "Orchard from above", prompt: "Drone descent over an apple orchard in October, rows converging, low sun, leaves moving in a light wind", aspect: "1:1", duration_seconds: 5, image: "/showcase/orchard.webp", artwork: { hues: [96, 44, 150], seed: 19 } },
  { id: "sc_poster", kind: "image", app: "text-to-image", title: "Festival poster", prompt: "Two-colour risograph poster for a summer film festival, bold geometric sun, generous margins", aspect: "9:16", duration_seconds: null, image: "/showcase/poster.webp", artwork: { hues: [8, 44, 200], seed: 23 } },
  { id: "sc_kitchen", kind: "video", app: "live-video-to-video", title: "Kitchen, restyled live", prompt: "Restyle a live camera feed as hand-painted gouache, warm palette, visible brushwork", aspect: "16:9", duration_seconds: null, image: "/showcase/kitchen.webp", artwork: { hues: [38, 14, 60], seed: 29 } },
  { id: "sc_tide", kind: "video", app: "text-to-video", title: "Tide pool, macro", prompt: "Macro shot of a tide pool as a wave drains away, anemones opening, sunlight rippling on sand", aspect: "16:9", duration_seconds: 10, image: "/showcase/tide.webp", artwork: { hues: [176, 205, 140], seed: 31 } },
  { id: "sc_score", kind: "audio", app: "music", title: "Score for a slow reveal", prompt: "Sixty seconds of sparse piano and bowed strings that builds once, for a slow product reveal", aspect: "1:1", duration_seconds: 60, image: "/showcase/score.webp", artwork: { hues: [250, 300, 220], seed: 37 } },
];

export const MOCK_STARTERS: PromptStarter[] = [
  {
    id: "make-video",
    label: "Make a video",
    app: "text-to-video",
    examples: [
      "A slow push along a fishing harbour at first light, mist lifting off the water",
      "Tracking shot beside a runner on a wet city street at night, neon reflections",
      "A 30-second product film for a ceramic mug: script, storyboard, shots and a score",
    ],
  },
  {
    id: "animate-image",
    label: "Animate an image",
    app: "image-to-video",
    examples: [
      "Bring this photo to life: a gentle camera drift and moving clouds",
      "Turn these two frames into one continuous five-second shot",
    ],
  },
  {
    id: "understand-video",
    label: "Understand a video",
    app: "video-understanding",
    examples: [
      "Summarise this video and list the key moments with timestamps",
      "Find every shot where the product is on screen",
    ],
  },
  {
    id: "restyle-live",
    label: "Restyle a live camera",
    app: "live-video-to-video",
    examples: [
      "Restyle my camera as hand-painted gouache with a warm palette",
      "Make my stream look like a 1970s film print",
    ],
  },
];
