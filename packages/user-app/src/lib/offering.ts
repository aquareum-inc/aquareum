import type { Offering } from "@livepeer/api-client/types";

import { appName } from "./capability-menu";

/** A readable label for a discovered app name: "text-to-video" → "Text to video", "blueclaw/chat/qwen3.8-27b" → "Qwen3.8 27B". */
export function offeringLabel(app: string): string {
  return appName(app);
}

const VIDEO_GENERATION = /^(text|image|video)-to-video$/;

export function isVideoApp(app: string): boolean {
  return VIDEO_GENERATION.test(app);
}

export function offeringAvailability(offering: Offering): string {
  return `${offering.ready_count} of ${offering.runner_count} runners ready`;
}
