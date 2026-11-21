import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { ApiClient, OperatorClient } from "@aquareum/api-client";
import type { NextRequest } from "next/server";

import { apiFor } from "../api";
import { SESSION_COOKIE, readSessionValue } from "../auth/session";
import { devices, mobileEnabled } from "../devices";
import { DEVICE_TOKEN_PREFIX } from "../devices/sessions";
import { env } from "../env";
import { buildOperatorClient } from "../operator/client";
import { ApiError, type Account } from "./operations";

export interface Caller {
  client: ApiClient;
  operator: OperatorClient | null;
  account: Account | null;
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Answers for a guest: the instance's default account, with no one signed in. */
export function guest(): Caller {
  return { client: apiFor(null), operator: null, account: null };
}

/**
 * Who is calling the instance API. Accepted, in order: the operator API token (administers the instance),
 * a device session from the native apps, a user's API key, or a signed-in browser session. Returns null
 * when none is valid. A device session while the instance serves no apps is refused with `mobile_off`, so
 * an installed app can say why.
 */
export async function authenticate(request: NextRequest): Promise<Caller | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (token) {
    const operatorToken = env("OPERATOR_API_TOKEN");
    if (operatorToken && same(token, operatorToken)) {
      return { client: apiFor(null), operator: buildOperatorClient(), account: null };
    }
    if (token.startsWith(DEVICE_TOKEN_PREFIX)) {
      if (!mobileEnabled()) throw new ApiError(403, "This service doesn't offer its app on phones right now.", "mobile_off");
      const device = devices().find(token);
      if (!device) return null;
      const user = { id: device.userId, name: device.name, email: device.email };
      return { client: apiFor(user), operator: null, account: { user, deviceId: device.id } };
    }
    const client = apiFor(null);
    const key = (await client.verifyApiKey(token)).data;
    return key ? { client, operator: null, account: null } : null;
  }

  const session = readSessionValue(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = { id: session.userId, name: session.name, email: session.email };
  return {
    client: apiFor(user),
    operator: session.role === "operator" ? buildOperatorClient() : null,
    account: { user, deviceId: null },
  };
}

/** Whether a request carries a device session, so the API can serve it while the API surface itself is off. */
export function carriesDeviceToken(request: NextRequest): boolean {
  return (request.headers.get("authorization") ?? "").slice(7).trim().startsWith(DEVICE_TOKEN_PREFIX);
}
