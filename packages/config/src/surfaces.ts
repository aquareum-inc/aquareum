import type { InstanceConfig } from "./generated";

/** Where a capability is presented. "live" is the studio's Live mode. */
export type Surface = "chat" | "studio" | "characters" | "library" | "live";

export type CapabilityKind =
  | "stream-support"
  | "realtime-character"
  | "realtime-session"
  | "understanding"
  | "generation"
  | "language"
  | "media-action"
  | "unmapped";

export interface CapabilityInput {
  app: string;
  modes: ReadonlyArray<string>;
}

export interface CapabilityPlacement {
  kind: CapabilityKind;
  surfaces: Surface[];
  /** Offered as an action on existing media in the library. */
  mediaAction: boolean;
}

interface Rule {
  kind: CapabilityKind;
  surfaces: Surface[];
  mediaAction?: boolean;
  test: (name: string, capability: CapabilityInput) => boolean;
}

const persistent = (capability: CapabilityInput) => capability.modes.includes("persistent");

/**
 * Rules in priority order. Discovery gives only an app name and its modes, so placement is
 * decided from those (docs/architecture.md). `name` is the last path segment of the app.
 */
const RULES: Rule[] = [
  {
    kind: "stream-support",
    surfaces: ["live"],
    test: (name) => /^live-(transcode|delivery)$/.test(name) || /-live$/.test(name) || /-publish(-|$)/.test(name),
  },
  { kind: "realtime-character", surfaces: ["characters"], test: (name, c) => persistent(c) && /avatar|character/.test(name) },
  { kind: "realtime-session", surfaces: ["live"], test: (_name, c) => persistent(c) },
  {
    kind: "understanding",
    surfaces: ["chat", "library"],
    test: (name) => /-understanding$|^transcription$|^translation$|-metadata$|-extract-frame$|-to-text$/.test(name),
  },
  {
    kind: "generation",
    surfaces: ["chat", "studio"],
    test: (name) => /^(text|image|video|audio)-to-(video|image|3d|speech|music|audio)$|^image-edit$|^music$/.test(name),
  },
  { kind: "language", surfaces: ["chat"], test: (name, c) => name === "chat" || /(^|\/)chat(\/|$)/.test(c.app) },
  {
    kind: "media-action",
    surfaces: ["library"],
    mediaAction: true,
    test: (name) => /transcode|-scale-|-trim-|-merge-|-compose$|-loudnorm$|-images-to-video$/.test(name),
  },
];

function lastSegment(app: string): string {
  const parts = app.split("/");
  return parts[parts.length - 1] ?? app;
}

/** Assigns a discovered capability to surfaces. Unmapped ones still appear in the catalogue, API and MCP. */
export function placeCapability(
  capability: CapabilityInput,
  overrides?: NonNullable<InstanceConfig["capabilities"]>["overrides"],
): CapabilityPlacement {
  const name = lastSegment(capability.app);
  const rule = RULES.find((entry) => entry.test(name, capability));
  const placement: CapabilityPlacement = rule
    ? { kind: rule.kind, surfaces: [...rule.surfaces], mediaAction: rule.mediaAction ?? false }
    : { kind: "unmapped", surfaces: [], mediaAction: false };
  const override = overrides?.[capability.app]?.surfaces;
  return override ? { ...placement, surfaces: [...override] } : placement;
}

export function capabilitiesFor<T extends CapabilityInput>(
  surface: Surface,
  capabilities: ReadonlyArray<T>,
  overrides?: NonNullable<InstanceConfig["capabilities"]>["overrides"],
): T[] {
  return capabilities.filter((capability) => placeCapability(capability, overrides).surfaces.includes(surface));
}
