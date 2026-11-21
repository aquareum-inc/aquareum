import "server-only";

import { createHash } from "node:crypto";

import type { AuthProvider, Identity } from "./types";

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

export interface OidcOptions {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  /** Claim that marks an operator: a `roles` or `groups` array containing this value. */
  operatorRole?: string;
  /** Authorization parameter naming the chosen method, e.g. "connection" or "kc_idp_hint". */
  methodParam?: string;
}

async function json<T>(response: Response, what: string): Promise<T> {
  if (!response.ok) throw new Error(`OIDC ${what} failed with ${response.status}`);
  return (await response.json()) as T;
}

/**
 * When the person signed in, from the ID token's `auth_time`. The token came straight from the provider's
 * token endpoint over TLS, in exchange for our own code and verifier, so its claims are read without
 * checking its signature (OpenID Connect Core 3.1.3.7). Null when there is no such claim.
 */
function authTime(idToken: string | undefined): number | null {
  try {
    const claims = JSON.parse(Buffer.from(idToken?.split(".")[1] ?? "", "base64url").toString("utf8")) as { auth_time?: unknown };
    return typeof claims.auth_time === "number" && Number.isFinite(claims.auth_time) ? claims.auth_time : null;
  } catch {
    return null;
  }
}

/** Authorization-code flow with PKCE against any OpenID Connect issuer. */
export function oidcProvider(options: OidcOptions): AuthProvider {
  let discovery: Promise<Discovery> | null = null;
  const discover = () =>
    (discovery ??= fetch(new URL(".well-known/openid-configuration", options.issuer.replace(/\/?$/, "/"))).then((r) =>
      json<Discovery>(r, "discovery"),
    ));

  return {
    id: "oidc",
    async authorizationUrl({ redirectUri, state, codeVerifier, method, email, fresh }) {
      const { authorization_endpoint } = await discover();
      const url = new URL(authorization_endpoint);
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: options.clientId,
        redirect_uri: redirectUri,
        scope: "openid profile email",
        state,
        code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"),
        code_challenge_method: "S256",
        // Tell the provider what was picked, so it can skip its own chooser.
        [options.methodParam ?? "connection"]: method,
        ...(email ? { login_hint: email } : {}),
        // A sign-in that must be new: the provider asks again even when it has a session for this browser.
        ...(fresh ? { prompt: "login", max_age: "0" } : {}),
      }).toString();
      return url.toString();
    },
    async exchange({ code, redirectUri, codeVerifier }) {
      const { token_endpoint, userinfo_endpoint } = await discover();
      const tokens = await json<{ access_token: string; id_token?: string }>(
        await fetch(token_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: options.clientId,
            code_verifier: codeVerifier,
            ...(options.clientSecret ? { client_secret: options.clientSecret } : {}),
          }),
        }),
        "token exchange",
      );
      const claims = await json<Record<string, unknown>>(
        await fetch(userinfo_endpoint, { headers: { authorization: `Bearer ${tokens.access_token}` } }),
        "userinfo",
      );
      const roles = [claims.roles, claims.groups].flatMap((value) => (Array.isArray(value) ? value : []));
      const identity: Identity = {
        userId: String(claims.sub),
        name: String(claims.name ?? claims.preferred_username ?? claims.email ?? claims.sub),
        email: typeof claims.email === "string" ? claims.email : null,
        role: roles.includes(options.operatorRole ?? "operator") ? "operator" : "user",
      };
      return { identity, authenticatedAt: authTime(tokens.id_token) };
    },
  };
}
