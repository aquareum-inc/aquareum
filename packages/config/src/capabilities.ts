import type { InstanceConfig } from "./generated";

function toPattern(rule: string): RegExp {
  const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * Whether the instance offers a discovered app. Block wins over allow; an empty allow list
 * allows everything.
 */
export function isCapabilityEnabled(app: string, rules: InstanceConfig["capabilities"]): boolean {
  const block = rules?.block ?? [];
  const allow = rules?.allow ?? [];
  if (block.some((rule) => toPattern(rule).test(app))) return false;
  return allow.length === 0 || allow.some((rule) => toPattern(rule).test(app));
}

export function filterCapabilities<T extends { app: string }>(
  offerings: ReadonlyArray<T>,
  rules: InstanceConfig["capabilities"],
): T[] {
  return offerings.filter((offering) => isCapabilityEnabled(offering.app, rules));
}
