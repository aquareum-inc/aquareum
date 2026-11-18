import { NextResponse, type NextRequest } from "next/server";

import { seal, unseal } from "@/lib/auth/seal";
import { FLOW_COOKIE, SESSION_COOKIE, authProvider, createSession, sessionSecret } from "@/lib/auth/session";

interface Flow {
  state: string;
  codeVerifier: string;
  next: string;
}

/** Completes sign-in: checks the state, exchanges the code and sets the sealed session cookie. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const flow = unseal<Flow>(request.cookies.get(FLOW_COOKIE)?.value ?? "", sessionSecret());
  if (!code || !flow || flow.state !== params.get("state")) {
    return NextResponse.redirect(new URL("/sign-in?error=expired", request.url));
  }
  const redirectUri = new URL("/auth/callback", request.url).toString();
  let identity;
  try {
    identity = await authProvider().exchange({ code, redirectUri, codeVerifier: flow.codeVerifier });
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=failed", request.url));
  }
  const destination = identity.role === "operator" || !flow.next.startsWith("/operator") ? flow.next : "/";
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(SESSION_COOKIE, seal(createSession(identity), sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 3600,
  });
  response.cookies.delete(FLOW_COOKIE);
  return response;
}
