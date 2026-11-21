import type { ReportReason } from "@aquareum/api-client/types";
import { describe, expect, it } from "vitest";

import { REPORT_REASONS } from "./report-reasons";

describe("report reasons", () => {
  it("offers every reason the API takes, once, each in its own words", () => {
    const every: Record<ReportReason, true> = { sexual: true, hateful: true, violent: true, impersonation: true, spam: true, other: true };
    expect(REPORT_REASONS.map((reason) => reason.value).sort()).toEqual(Object.keys(every).sort());
    expect(new Set(REPORT_REASONS.map((reason) => reason.label)).size).toBe(REPORT_REASONS.length);
  });
});
