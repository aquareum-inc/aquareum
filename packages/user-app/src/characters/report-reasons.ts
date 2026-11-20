import type { ReportReason } from "@aquareum/api-client/types";

/** Why someone can report a character, in the order the report sheet lists them. The phone apps use the same words. */
export const REPORT_REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: "sexual", label: "Sexual content" },
  { value: "hateful", label: "Hateful or harassing" },
  { value: "violent", label: "Violent or dangerous" },
  { value: "impersonation", label: "Pretends to be a real person" },
  { value: "spam", label: "Spam or a scam" },
  { value: "other", label: "Something else" },
];

/** The longest note a report carries; the API cuts anything longer. */
export const REPORT_NOTE_LIMIT = 500;
