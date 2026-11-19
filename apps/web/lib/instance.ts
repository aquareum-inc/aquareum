import "server-only";

import { statSync } from "node:fs";
import path from "node:path";

import { DEFAULT_CONFIG_FILE, loadConfig, type InstanceConfig } from "@aquareum/config";
import type { Brand } from "@aquareum/ui";

import { env } from "./env";

let cached: { config: InstanceConfig; stamp: number } | null = null;

const root = () => path.join(/* turbopackIgnore: true */ process.cwd(), "../..");

/** When the config file last changed; 0 when the instance runs from the built-in preset. */
function stamp(): number {
  try {
    return statSync(/* turbopackIgnore: true */ path.resolve(/* turbopackIgnore: true */ root(), env("INSTANCE_CONFIG") || DEFAULT_CONFIG_FILE)).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * The instance config, from the repository root (or INSTANCE_CONFIG). Re-read when the file
 * changes, so a save from the operator console applies without a restart.
 */
export function instance(): InstanceConfig {
  const current = stamp();
  if (cached && cached.stamp === current) return cached.config;
  const overrides: Record<string, string | undefined> = {
    INSTANCE_CONFIG: env("INSTANCE_CONFIG"),
    ENGINE_URL: env("ENGINE_URL"),
  };
  cached = { config: loadConfig({ cwd: root(), env: overrides }).config, stamp: current };
  return cached.config;
}

/** The instance's name and marks, as the shells and sign-in draw them. */
export function brandOf(config: InstanceConfig): Brand {
  return { name: config.name, symbol: config.logo?.symbol, wordmark: config.logo?.wordmark, tint: config.logo?.tint ?? true };
}
