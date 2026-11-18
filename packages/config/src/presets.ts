import full from "../presets/full.json" with { type: "json" };
import headless from "../presets/headless.json" with { type: "json" };
import type { InstanceConfig } from "./generated";
import { validateConfig } from "./validate";

export const PRESET_NAMES = ["full", "headless"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

const SOURCES: Record<PresetName, unknown> = { full, headless };

export function isPresetName(value: string): value is PresetName {
  return (PRESET_NAMES as readonly string[]).includes(value);
}

/** A fresh, validated copy of a preset. */
export function preset(name: PresetName): InstanceConfig {
  const { $schema: _schema, ...config } = validateConfig(SOURCES[name]);
  return config;
}
