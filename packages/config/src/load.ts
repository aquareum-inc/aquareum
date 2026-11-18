import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { InstanceConfig } from "./generated";
import { preset } from "./presets";
import { ConfigError, validateConfig } from "./validate";

export const DEFAULT_CONFIG_FILE = "instance.config.json";

export interface LoadOptions {
  /** Directory relative paths resolve against. */
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export interface LoadedConfig {
  config: InstanceConfig;
  /** Absolute path of the file read, or null when the "full" preset was used. */
  file: string | null;
}

/**
 * Reads the instance config: INSTANCE_CONFIG if set, else ./instance.config.json, else the
 * "full" preset. ENGINE_URL overrides `engine.url`.
 */
export function loadConfig(options: LoadOptions = {}): LoadedConfig {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const explicit = env.INSTANCE_CONFIG;
  const file = path.resolve(cwd, explicit || DEFAULT_CONFIG_FILE);

  let config: InstanceConfig;
  let source: string | null = file;
  if (existsSync(/* turbopackIgnore: true */ file)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(/* turbopackIgnore: true */ file, "utf8"));
    } catch (error) {
      throw new ConfigError([{ path: "", message: `is not valid JSON (${(error as Error).message})` }]);
    }
    config = validateConfig(parsed);
  } else if (explicit) {
    throw new ConfigError([{ path: "", message: `file not found: ${file}` }]);
  } else {
    config = preset("full");
    source = null;
  }

  if (env.ENGINE_URL) config.engine = { ...config.engine, url: env.ENGINE_URL };
  return { config, file: source };
}
