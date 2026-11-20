import { EngineError, UnsupportedByProvider } from "@aquareum/api-client";
import { NextResponse, type NextRequest } from "next/server";

import { apiFor } from "@/lib/api";
import { authenticate } from "@/lib/public-api/auth";
import { describeInstance } from "@/lib/public-api/instance";
import { capabilityLabels } from "@/lib/public-api/labels";
import { ApiError, matchOperation } from "@/lib/public-api/operations";

export const dynamic = "force-dynamic";

const error = (status: number, message: string) => NextResponse.json({ error: { status, message } }, { status });

/** The instance's REST API: one route per operation in the registry. */
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const match = matchOperation(request.method, (await context.params).path);
  // A guest can call what a guest can see on the web; it runs as the instance's default account.
  const caller = (await authenticate(request)) ?? (match?.operation.public ? { client: apiFor(null), operator: null } : null);
  if (!caller) return error(401, "Send an API key as a bearer token: Authorization: Bearer <key>");
  if (!match) return error(404, "No such operation. GET /api/v1 lists them.");

  let body: Record<string, unknown> = {};
  if (request.method !== "GET" && request.method !== "DELETE") {
    try {
      const text = await request.text();
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return error(400, "The request body isn't valid JSON.");
    }
  }
  const query = Object.fromEntries(request.nextUrl.searchParams);
  const input = { ...query, ...body, ...match.params };

  const schema = match.operation.input as { required?: string[] };
  const missing = (schema.required ?? []).filter((key) => input[key] === undefined || input[key] === "");
  if (missing.length > 0) return error(400, `Missing: ${missing.join(", ")}`);

  try {
    return NextResponse.json(await match.operation.run({ ...caller, instance: describeInstance(request.nextUrl.origin), labels: capabilityLabels }, input));
  } catch (cause) {
    if (cause instanceof ApiError) return error(cause.status, cause.message);
    if (cause instanceof UnsupportedByProvider) return error(501, cause.message);
    if (cause instanceof EngineError) return error(cause.status === 401 || cause.status === 403 ? 502 : cause.status, "The engine refused or failed this request.");
    return error(500, cause instanceof Error ? cause.message : "The request failed.");
  }
}

export { handle as DELETE, handle as GET, handle as PATCH, handle as POST };
