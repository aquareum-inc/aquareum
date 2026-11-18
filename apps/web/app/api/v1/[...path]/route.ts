import { EngineError, UnsupportedByProvider } from "@aquareum/api-client";
import { NextResponse, type NextRequest } from "next/server";

import { authenticate } from "@/lib/public-api/auth";
import { ApiError, matchOperation } from "@/lib/public-api/operations";

export const dynamic = "force-dynamic";

const error = (status: number, message: string) => NextResponse.json({ error: { status, message } }, { status });

/** The instance's REST API: one route per operation in the registry. */
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const caller = await authenticate(request);
  if (!caller) return error(401, "Send an API key as a bearer token: Authorization: Bearer <key>");

  const match = matchOperation(request.method, (await context.params).path);
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
    return NextResponse.json(await match.operation.run(caller, input));
  } catch (cause) {
    if (cause instanceof ApiError) return error(cause.status, cause.message);
    if (cause instanceof UnsupportedByProvider) return error(501, cause.message);
    if (cause instanceof EngineError) return error(cause.status === 401 || cause.status === 403 ? 502 : cause.status, "The engine refused or failed this request.");
    return error(500, cause instanceof Error ? cause.message : "The request failed.");
  }
}

export { handle as DELETE, handle as GET, handle as PATCH, handle as POST };
