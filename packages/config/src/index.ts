export type { InstanceConfig } from "./generated";
export { ConfigError, validateConfig, type ConfigIssue } from "./validate";
export { PRESET_NAMES, isPresetName, preset, type PresetName } from "./presets";
export { DEFAULT_CONFIG_FILE, loadConfig, type LoadOptions, type LoadedConfig } from "./load";
export { filterCapabilities, isCapabilityEnabled } from "./capabilities";
export {
  capabilitiesFor,
  placeCapability,
  type CapabilityInput,
  type CapabilityKind,
  type CapabilityPlacement,
  type Surface,
} from "./surfaces";
