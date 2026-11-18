import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { seal } from "@/lib/auth/seal";
import { FLOW_COOKIE, authProvider, sessionSecret } from "@/lib/auth/session";
import type { SignInMethod } from "@/lib/auth/types";
import { signInMethods } from "@/lib/auth/methods";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

const METHODS: SignInMethod[] = ["email", "passkey", "google", "apple", "discord", "coinbase", "wallet", "operator"];

/** Begins sign-in with the chosen method: remembers where to return, then hands the browser to the identity provider. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const method = METHODS.find((entry) => entry === params.get("method"));
  const offered: string[] = signInMethods();
  const allowed = method === "operator" ? authProvider().id === "mock" : method !== undefined && offered.includes(method);
  // No method, or one this instance doesn't offer: go to the sign-in screen to choose.
  if (!method || !allowed) {
    const url = new URL("/sign-in", request.url);
    const next = params.get("next");
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  const email = params.get("email")?.trim();
  const state = randomBytes(16).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const redirectUri = new URL("/auth/callback", request.url).toString();
  const target = await authProvider().authorizationUrl({ redirectUri, state, codeVerifier, method, ...(email ? { email } : {}) });
  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.set(
    FLOW_COOKIE,
    seal({ state, codeVerifier, next: safeNext(request.nextUrl.searchParams.get("next")) }, sessionSecret()),
    { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 },
  );
  return response;
}
