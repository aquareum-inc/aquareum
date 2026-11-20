import { NextResponse, type NextRequest } from "next/server";

import { seal, unseal } from "@/lib/auth/seal";
import { FLOW_COOKIE, SESSION_COOKIE, authProvider, createSession, sessionSecret } from "@/lib/auth/session";
import { appCallback, devices, mobileEnabled } from "@/lib/devices";
import { returnToApp, type NativeFlow } from "@/lib/devices/flow";
import { publicOrigin } from "@/lib/public-api/instance";

interface Flow {
  state: string;
  codeVerifier: string;
  next: string;
  native?: NativeFlow;
}

/**
 * Completes sign-in: checks the state and exchanges the code. A browser gets the sealed session cookie. A
 * native app gets a one-time code at its own address, which it exchanges with its verifier for a device
 * session (POST /api/v1/auth/device), so no session ever passes through the browser.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = publicOrigin(request);
  const code = params.get("code");
  const flow = unseal<Flow>(request.cookies.get(FLOW_COOKIE)?.value ?? "", sessionSecret());
  const callback = flow?.native ? appCallback(flow.native.platform) : null;
  const finish = (response: NextResponse) => {
    response.cookies.delete(FLOW_COOKIE);
    return response;
  };

  if (flow?.native && !callback) return finish(new NextResponse("This instance no longer has an app for that platform.", { status: 400 }));
  const fail = (reason: "expired" | "failed" | "mobile_off") =>
    finish(flow?.native && callback ? returnToApp(callback, { error: reason, state: flow.native.state }) : NextResponse.redirect(new URL(`/sign-in?error=${reason === "mobile_off" ? "failed" : reason}`, origin)));

  if (!code || !flow || flow.state !== params.get("state")) return fail("expired");
  const redirectUri = new URL("/auth/callback", origin).toString();
  let identity;
  try {
    identity = await authProvider().exchange({ code, redirectUri, codeVerifier: flow.codeVerifier });
  } catch {
    return fail("failed");
  }

  if (flow.native && callback) {
    if (!mobileEnabled()) return fail("mobile_off");
    const { builderKey } = createSession(identity);
    const handoff = devices().issueCode({
      // A device session is always a user: operator work stays on the web, so a lost phone can't administer the instance.
      identity: { ...identity, role: "user" },
      builderKey: builderKey ? seal(builderKey, sessionSecret()) : null,
      challenge: flow.native.challenge,
      platform: flow.native.platform,
    });
    return finish(returnToApp(callback, { code: handoff, state: flow.native.state }));
  }

  const destination = identity.role === "operator" || !flow.next.startsWith("/operator") ? flow.next : "/";
  const response = NextResponse.redirect(new URL(destination, origin));
  response.cookies.set(SESSION_COOKIE, seal(createSession(identity), sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 3600,
  });
  return finish(response);
}
