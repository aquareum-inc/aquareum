import type { Offering, RatePoint } from "../types";

const OBSERVED = "2026-11-17T21:12:40.208908Z";

function rate(amount: string, unit: string, usd: string): RatePoint {
  return {
    amount,
    currency: "wei",
    unit,
    price_usd: usd,
    source: "orchestrator",
    observed_at: OBSERVED,
    observed_by: "orchestrator",
  };
}

function offering(
  app: string,
  modes: Offering["modes"],
  unit: string,
  low: [string, string],
  high: [string, string],
  runners: number,
  ready: number,
): Offering {
  return {
    app,
    modes,
    rate_low: rate(low[0], unit, low[1]),
    rate_high: rate(high[0], unit, high[1]),
    rate_status: "ok",
    stale: false,
    runner_count: runners,
    ready_count: ready,
    observed_at: OBSERVED,
  };
}

/** Same shape as live `GET /v1/offerings`. Names follow docs/research/capabilities-and-discovery.md. */
export const MOCK_OFFERINGS: Offering[] = [
  offering("text-to-video", ["single-shot"], "fixed", ["222737699129600", "0.4"], ["334106548694400", "0.6"], 6, 5),
  offering("image-to-video", ["single-shot"], "fixed", ["194895486738400", "0.35"], ["278422123912000", "0.5"], 5, 4),
  offering("text-to-image", ["single-shot"], "fixed", ["5568442478240", "0.01"], ["16705327434720", "0.03"], 9, 9),
  offering("image-edit", ["single-shot"], "fixed", ["11136884956480", "0.02"], ["22273769912960", "0.04"], 4, 4),
  offering("live-video-to-video", ["persistent"], "seconds", ["1546789577", "0.0000028"], ["2320184366", "0.0000042"], 3, 2),
  offering("live-avatar", ["persistent"], "seconds", ["2320184366", "0.0000042"], ["3093579154", "0.0000056"], 2, 2),
  offering("text-to-speech", ["single-shot"], "fixed", ["2784221239120", "0.005"], ["5568442478240", "0.01"], 4, 4),
  offering("music", ["single-shot"], "fixed", ["27842212391200", "0.05"], ["55684424782400", "0.1"], 2, 2),
  offering("chat", ["single-shot"], "fixed", ["556844247824", "0.001"], ["2784221239120", "0.005"], 8, 8),
  offering("video-understanding", ["single-shot"], "seconds", ["773394788", "0.0000014"], ["1546789577", "0.0000028"], 3, 3),
  offering("transcription", ["single-shot"], "seconds", ["386697394", "0.0000007"], ["773394788", "0.0000014"], 5, 5),
  offering("video-transcode", ["single-shot"], "seconds", ["193348697", "0.00000035"], ["386697394", "0.0000007"], 7, 7),
  offering("live-transcode", ["persistent"], "seconds", ["193348697", "0.00000035"], ["386697394", "0.0000007"], 6, 6),
  offering("live-delivery", ["persistent"], "seconds", ["96674348", "0.00000018"], ["193348697", "0.00000035"], 4, 4),
];
