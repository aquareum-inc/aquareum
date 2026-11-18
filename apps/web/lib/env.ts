import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * Server-side environment. Values come from the process environment, falling back to the
 * repository's root .env in development. Nothing here is ever sent to the browser or logged.
 */
function readRootEnv(): Record<string, string> {
  const file = path.join(/* turbopackIgnore: true */ process.cwd(), "../../.env");
  if (!fs.existsSync(/* turbopackIgnore: true */ file)) return {};
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(/* turbopackIgnore: true */ file, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match?.[1]) continue;
    values[match[1]] = (match[2] ?? "").replace(/^["']|["']$/g, "");
  }
  return values;
}

const fileEnv = process.env.NODE_ENV === "production" ? {} : readRootEnv();

export function env(name: string): string | undefined {
  const value = process.env[name] ?? fileEnv[name];
  return value === "" ? undefined : value;
}

export const isDev = process.env.NODE_ENV === "development";
