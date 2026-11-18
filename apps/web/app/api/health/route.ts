import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { instance } from "@/lib/instance";

export const dynamic = "force-dynamic";

/** Liveness and a quick readiness summary for the bundle's health check and `doctor`. */
export async function GET() {
  const config = instance();
  const mockOnly = env("MOCK_ONLY") === "1" || env("MOCK_ONLY") === "true";
  const engineUrl = config.engine?.url ?? env("ENGINE_URL");
  let engine: "ok" | "unreachable" | "skipped" = "skipped";
  if (!mockOnly && engineUrl) {
    try {
      const response = await fetch(new URL("/readyz", engineUrl), { cache: "no-store", signal: AbortSignal.timeout(3000) });
      engine = response.ok ? "ok" : "unreachable";
    } catch {
      engine = "unreachable";
    }
  }
  const ok = engine !== "unreachable";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", instance: config.name, mode: mockOnly ? "mock-only" : "live", surfaces: config.surfaces, engine },
    { status: ok ? 200 : 503 },
  );
}
