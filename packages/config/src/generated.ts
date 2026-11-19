/* Generated from schema/instance.schema.json by `pnpm --filter @aquareum/config generate`. Do not edit. */

/**
 * One file that defines an instance: branding, engine, surfaces, capability rules, auth, payments and content policy. Secrets never go here; they are environment variables.
 */
export interface InstanceConfig {
  $schema?: string;
  /**
   * Instance name shown in the interface.
   */
  name: string;
  /**
   * Paths or URLs to SVG marks. Omitted, the Livepeer mark is used.
   */
  logo?: {
    symbol?: string;
    wordmark?: string;
  };
  /**
   * Overrides for semantic colour tokens, per theme. Keys are token names without the leading dashes, e.g. "primary".
   */
  theme?: {
    dark?: Tokens;
    light?: Tokens;
  };
  /**
   * Public hostname of the instance.
   */
  domain?: string;
  engine?: {
    /**
     * Engine REST API base URL. ENGINE_URL overrides it.
     */
    url?: string;
  };
  /**
   * Which parts of the product this instance serves.
   */
  surfaces: {
    /**
     * The user app.
     */
    app: boolean;
    /**
     * The operator console.
     */
    console: boolean;
    /**
     * The instance REST API.
     */
    api: boolean;
    /**
     * The MCP server.
     */
    mcp: boolean;
  };
  /**
   * Which discovered capabilities the instance offers. Patterns match app names; * matches any run of characters. Block wins over allow. An empty allow list allows everything.
   */
  capabilities?: {
    allow?: string[];
    block?: string[];
    /**
     * Per-app overrides, keyed by app name.
     */
    overrides?: {
      [k: string]: {
        label?: string;
        surfaces?: ("chat" | "studio" | "characters" | "library" | "live")[];
      };
    };
  };
  auth?: {
    provider?: "mock" | "oidc";
    oidc?: {
      issuer: string;
      clientId: string;
      /**
       * Authorization request parameter that tells the provider which method the user picked (for example "connection" or "kc_idp_hint").
       */
      methodParam?: string;
    };
    signUp?: "open" | "invite" | "closed";
    /**
     * Sign-in methods offered on the sign-in screen, in order. The identity provider must support each one.
     */
    methods?: ("email" | "passkey" | "google" | "apple" | "discord" | "coinbase" | "wallet")[];
  };
  payments?: {
    provider?: "mock" | "batteries" | "pymthouse";
  };
  /**
   * How wholesale network cost becomes credits charged.
   */
  pricing?: {
    creditsPerUsd?: number;
    markup?: {
      /**
       * Multiplier on wholesale cost.
       */
      default?: number;
      perApp?: {
        [k: string]: number;
      };
    };
  };
  content?: {
    /**
     * Characters and companions.
     */
    characters?: boolean;
    /**
     * Allow adult content. Users still confirm their age and opt in.
     */
    adultContent?: boolean;
  };
  privacy?: {
    /**
     * Keep prompts and outputs on the instance's servers.
     */
    retainChats?: boolean;
  };
  /**
   * The home screen.
   */
  home?: {
    /**
     * URL or public path of a looping, silent video shown behind the home screen's composer.
     */
    backgroundVideo?: string;
    /**
     * Still image shown while the video loads, and in place of it when the visitor prefers reduced motion. With aurora, the opening frame shown while the live sky starts: the sky and stars without the aurora.
     */
    backgroundPoster?: string;
    /**
     * URL or public path of a photograph shown behind the composer when there is no video, brought gently to life with a slow drift and a shimmer in its coloured light. With neither, soft drifting light is shown.
     */
    backgroundImage?: string;
    /**
     * Draw a live aurora over backgroundImage, in place of any coloured glow in the photograph. Meant for a night-sky photo.
     */
    aurora?: boolean;
  };
}
export interface Tokens {
  [k: string]: string;
}
