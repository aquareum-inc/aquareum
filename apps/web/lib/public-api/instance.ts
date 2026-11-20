import "server-only";

import type { InstanceDescription, SignInMethodName } from "@aquareum/api-client";
import { colourToHex } from "@aquareum/config";

import { signInMethods } from "../auth/methods";
import { instance } from "../instance";

export const API_VERSION = "1";

/** Theme overrides as sRGB hex. An override that isn't a colour this can resolve is left out, so the default shows. */
function hexTokens(tokens: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens ?? {}).flatMap(([name, value]) => {
    const hex = colourToHex(value);
    return hex ? [[name, hex]] : [];
  }));
}

/**
 * This instance as it describes itself to clients. `origin` is where the request arrived, used to make
 * paths absolute when the config has no public domain.
 */
export function describeInstance(origin: string): InstanceDescription {
  const config = instance();
  const base = config.domain ? `https://${config.domain}` : origin;
  const absolute = (value: string | undefined): string | null => (value ? (/^(https?:|data:)/.test(value) ? value : new URL(value, base).toString()) : null);
  return {
    api_version: API_VERSION,
    name: config.name,
    logo: { symbol: absolute(config.logo?.symbol), wordmark: absolute(config.logo?.wordmark), tint: config.logo?.tint ?? true },
    theme: { dark: hexTokens(config.theme?.dark), light: hexTokens(config.theme?.light) },
    surfaces: { app: config.surfaces.app, api: config.surfaces.api, mcp: config.surfaces.mcp },
    sign_in: { methods: signInMethods().filter((method): method is SignInMethodName => method !== "operator"), sign_up: config.auth?.signUp ?? "open" },
    content: { characters: config.content?.characters ?? false, adult_content: config.content?.adultContent ?? false },
    home: {
      background_image: absolute(config.home?.backgroundImage),
      background_poster: absolute(config.home?.backgroundPoster),
      background_video: absolute(config.home?.backgroundVideo),
      aurora: config.home?.aurora ?? false,
    },
  };
}
