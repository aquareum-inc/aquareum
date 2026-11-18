import { Ajv, type ErrorObject } from "ajv";

import schema from "../schema/instance.schema.json" with { type: "json" };
import type { InstanceConfig } from "./generated";

export interface ConfigIssue {
  /** JSON pointer to the offending value, "" for the root. */
  path: string;
  message: string;
}

export class ConfigError extends Error {
  constructor(readonly issues: ConfigIssue[]) {
    super(`Invalid instance config:\n${issues.map((issue) => `  ${issue.path || "/"} ${issue.message}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: false, formats: { uri: true } });
const validator = ajv.compile<InstanceConfig>(schema);

function toIssue(error: ErrorObject): ConfigIssue {
  const extra =
    error.keyword === "additionalProperties" ? ` ("${String(error.params.additionalProperty)}")` : "";
  return { path: error.instancePath, message: `${error.message ?? "is invalid"}${extra}` };
}

/** Validates a parsed config and fills schema defaults. Throws ConfigError listing every problem. */
export function validateConfig(input: unknown): InstanceConfig {
  const candidate = structuredClone(input);
  if (!validator(candidate)) {
    throw new ConfigError((validator.errors ?? []).map(toIssue));
  }
  return candidate;
}
