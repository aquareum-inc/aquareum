import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { ApiClient, OperatorClient } from "@aquareum/api-client";
import type { NextRequest } from "next/server";

import { apiFor } from "../api";
import { SESSION_COOKIE, readSessionValue } from "../auth/session";
import { env } from "../env";
import { buildOperatorClient } from "../operator/client";

export interface Caller {
  client: ApiClient;
  operator: OperatorClient | null;
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Who is calling the instance API. Accepted, in order: the operator API token (administers the
 * instance), a user's API key, or a signed-in browser session. Returns null when none is valid.
 */
export async function authenticate(request: NextRequest): Promise<Caller | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (token) {
    const operatorToken = env("OPERATOR_API_TOKEN");
    if (operatorToken && same(token, operatorToken)) {
      return { client: apiFor(null), operator: buildOperatorClient() };
    }
    const client = apiFor(null);
    const key = (await client.verifyApiKey(token)).data;
    return key ? { client, operator: null } : null;
  }

  const session = readSessionValue(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return {
    client: apiFor({ id: session.userId, name: session.name }),
    operator: session.role === "operator" ? buildOperatorClient() : null,
  };
}
