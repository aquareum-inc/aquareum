export type Role = "user" | "operator";

/** What the sealed session cookie holds. The builder key never leaves the server. */
export interface Session {
  userId: string;
  name: string;
  email: string | null;
  role: Role;
  /** The signed-in user's engine key (lpk_…), sent on their behalf. */
  builderKey: string | null;
  /** Unix seconds. */
  expiresAt: number;
}

/** A way to sign in. "operator" exists only for the development provider. */
export type SignInMethod = "email" | "passkey" | "google" | "apple" | "discord" | "coinbase" | "wallet" | "operator";

export interface Identity {
  userId: string;
  name: string;
  email: string | null;
  role: Role;
}

/**
 * An identity provider, shaped on OpenID Connect's authorization-code flow so a hosted provider
 * (for example a white-label login) plugs in without changes to the app.
 */
export interface AuthProvider {
  readonly id: "mock" | "oidc";
  /** Where to send the browser to sign in. `state` comes back on the callback. */
  authorizationUrl(input: {
    redirectUri: string;
    state: string;
    codeVerifier: string;
    /** The method picked on the sign-in screen. */
    method: SignInMethod;
    /** The email typed on the sign-in screen, for the email method. */
    email?: string;
  }): Promise<string>;
  /** Exchanges the callback's code for an identity. */
  exchange(input: { code: string; redirectUri: string; codeVerifier: string }): Promise<Identity>;
}
