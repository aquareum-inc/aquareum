import { EngineError } from "../live/engine";
import type { AccessKey, CostSummary, EngineHealth, EngineJob, KnownActor, Runner } from "./types";

export interface OperatorEngine {
  url: string;
  /** Auditor key: every read. */
  reader?: string;
  /** Admin key: writes only. */
  admin?: string;
}

async function request<T>(engine: OperatorEngine, token: string | undefined, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(new URL(path, engine.url), {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new EngineError(response.status, `Engine answered ${response.status} for ${method} ${path}`);
  return (await response.json()) as T;
}

/** Reads use the reader token. Nothing here uses the admin token for a read. */
export const read = {
  health: (engine: OperatorEngine) => request<EngineHealth>(engine, undefined, "GET", "/readyz"),
  jobs: (engine: OperatorEngine, limit: number) => request<EngineJob[]>(engine, engine.reader, "GET", `/v1/jobs?limit=${limit}`),
  actors: (engine: OperatorEngine) => request<KnownActor[]>(engine, engine.reader, "GET", "/v1/admin/actors"),
  keys: (engine: OperatorEngine) => request<AccessKey[]>(engine, engine.reader, "GET", "/v1/admin/keys"),
  costs: (engine: OperatorEngine, start: string, end: string) =>
    request<CostSummary>(engine, engine.reader, "GET", `/v1/costs/summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  runners: (engine: OperatorEngine, app: string) => request<Runner[]>(engine, engine.reader, "GET", `/v1/runners?app=${encodeURIComponent(app)}`),
};

/** Writes use the admin token and carry an operation_ref, which the engine requires. */
export const write = {
  issueKey: (engine: OperatorEngine, input: { actor_id: string; label: string; kind: AccessKey["kind"] }) =>
    request<{ key: AccessKey; token: string | null; replayed: boolean }>(engine, engine.admin, "POST", "/v1/admin/keys", { ...input, operation_ref: crypto.randomUUID() }),
  revokeKey: (engine: OperatorEngine, keyId: string) =>
    request<AccessKey>(engine, engine.admin, "POST", `/v1/admin/keys/${encodeURIComponent(keyId)}/revoke`, { operation_ref: crypto.randomUUID() }),
  setAllocationStatus: (engine: OperatorEngine, applicationId: string, actorId: string, status: "active" | "paused") =>
    request<unknown>(engine, engine.admin, "POST", `/v1/admin/applications/${encodeURIComponent(applicationId)}/actors/${encodeURIComponent(actorId)}/allocation/status`, { status }),
};
