import { DATA_SOURCES, OPERATOR_DATA_SOURCES, isMockOnly, type DataSource, type EngineHealth } from "@aquareum/api-client";
import { SystemView } from "@aquareum/operator-console";
import type { Metadata } from "next";

import release from "../../../../../release.config.json";

import { env } from "@/lib/env";
import { operatorApi } from "@/lib/operator/client";
import { runDoctor } from "@/lib/operator/doctor";

export const metadata: Metadata = { title: "System" };

export default async function SystemPage() {
  const client = await operatorApi();
  let health: EngineHealth | null = null;
  let healthError: string | null = null;
  let healthSource: DataSource = "mock";
  try {
    const result = await client.getEngineHealth();
    health = result.data;
    healthSource = result.source;
  } catch {
    healthError = "The engine didn't answer.";
  }
  const mockOnly = isMockOnly({ MOCK_ONLY: env("MOCK_ONLY") });
  const resolve = (source: DataSource): DataSource => (mockOnly ? "mock" : source);
  const dataSources = [
    ...Object.entries(OPERATOR_DATA_SOURCES).map(([name, source]) => ({ name, source: resolve(source), area: "Operator console" })),
    ...Object.entries(DATA_SOURCES).map(([name, source]) => ({ name, source: resolve(source), area: "User app" })),
  ];
  return (
    <SystemView
      health={health}
      healthError={healthError}
      provider={{ name: client.provider.name, id: client.provider.id }}
      versions={{ app: release.version, enginePinned: release.engine.ref.slice(0, 12), engineRunning: healthSource === "live" ? (health?.version ?? null) : mockOnly ? "mock-only mode" : null }}
      checks={await runDoctor()}
      dataSources={dataSources}
      sources={[{ name: "getEngineHealth", source: healthSource }]}
    />
  );
}
