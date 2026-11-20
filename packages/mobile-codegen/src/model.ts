/**
 * Reads docs/mobile/openapi.json into a small language-neutral model: named types and operations.
 * Each platform's emitter turns this into source, so the two clients can't drift apart.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

type Json = Record<string, unknown>;

export type TypeRef =
  | { kind: "string" | "number" | "boolean" | "any" }
  | { kind: "named"; name: string }
  | { kind: "array"; of: TypeRef }
  | { kind: "map"; of: TypeRef }
  | { kind: "optional"; of: TypeRef };

export interface Field {
  /** The JSON key. */
  key: string;
  type: TypeRef;
  doc: string | null;
}

export type Declaration =
  | { kind: "object"; name: string; doc: string | null; fields: Field[] }
  | { kind: "enum"; name: string; doc: string | null; values: string[] }
  /** One of several objects, told apart by a property each sets to its own constant. */
  | { kind: "union"; name: string; doc: string | null; discriminator: string; variants: Array<{ value: string; type: string }> };

export interface Parameter {
  key: string;
  type: TypeRef;
  in: "path" | "query" | "body";
  required: boolean;
  doc: string | null;
}

export interface ApiOperation {
  name: string;
  doc: string;
  method: string;
  path: string;
  parameters: Parameter[];
  output: TypeRef;
  public: boolean;
}

/** A type that may be absent. Wrapping twice says nothing more, so it never does. */
const optional = (type: TypeRef): TypeRef => (type.kind === "optional" ? type : { kind: "optional", of: type });

export const pascal = (text: string) => text.replace(/(^|[_\-\s])(\w)/g, (_, __, char: string) => char.toUpperCase());
export const camel = (text: string) => {
  const name = pascal(text);
  return name.charAt(0).toLowerCase() + name.slice(1);
};

export function readModel(): { declarations: Declaration[]; operations: ApiOperation[] } {
  const document = JSON.parse(readFileSync(path.join(root, "docs/mobile/openapi.json"), "utf8")) as {
    paths: Record<string, Record<string, Json>>;
    components: { schemas: Record<string, Json> };
  };
  const schemas = document.components.schemas;
  const declarations: Declaration[] = [];
  const doc = (schema: Json) => (typeof schema.description === "string" ? schema.description : null);
  const refName = (schema: Json) => (typeof schema.$ref === "string" ? schema.$ref.split("/").pop() ?? null : null);

  /** The type of a schema. `hint` names any object or enum it has to declare along the way. */
  function typeOf(schema: Json, hint: string): TypeRef {
    const named = refName(schema);
    if (named) return { kind: "named", name: named };

    const types = Array.isArray(schema.type) ? (schema.type as string[]) : typeof schema.type === "string" ? [schema.type] : [];
    const options = (schema.anyOf as Json[] | undefined) ?? null;
    if (options) {
      const rest = options.filter((option) => option.type !== "null");
      if (rest.length === 1 && rest.length < options.length) return optional(typeOf(rest[0] as Json, hint));
      throw new Error(`${hint}: a union inside a property isn't supported; give it a name in types.ts`);
    }
    if (types.includes("null")) return optional(typeOf({ ...schema, type: types.filter((type) => type !== "null")[0] }, hint));

    if (Array.isArray(schema.enum)) {
      const values = (schema.enum as unknown[]).filter((value): value is string => typeof value === "string");
      const nullable = (schema.enum as unknown[]).includes(null);
      declarations.push({ kind: "enum", name: hint, doc: doc(schema), values });
      return nullable ? optional({ kind: "named", name: hint }) : { kind: "named", name: hint };
    }
    switch (types[0]) {
      case "string":
        return { kind: "string" };
      case "number":
      case "integer":
        return { kind: "number" };
      case "boolean":
        return { kind: "boolean" };
      case "array":
        return { kind: "array", of: typeOf((schema.items as Json | undefined) ?? {}, hint) };
      case "object": {
        if (schema.properties) {
          declare(hint, schema);
          return { kind: "named", name: hint };
        }
        const values = schema.additionalProperties;
        return values && typeof values === "object" ? { kind: "map", of: typeOf(values as Json, hint) } : { kind: "any" };
      }
      default:
        return { kind: "any" };
    }
  }

  function declare(name: string, schema: Json): void {
    const options = schema.anyOf as Json[] | undefined;
    if (options) {
      const variants = options.map((option) => refName(option));
      const shared = Object.keys((schemas[variants[0] ?? ""]?.properties as Json | undefined) ?? {}).find((key) =>
        variants.every((variant) => typeof ((schemas[variant ?? ""]?.properties as Record<string, Json> | undefined)?.[key]?.const) === "string"),
      );
      if (!shared || variants.some((variant) => !variant)) throw new Error(`${name}: a union needs variants that share a constant property`);
      declarations.push({
        kind: "union",
        name,
        doc: doc(schema),
        discriminator: shared,
        variants: variants.map((variant) => ({ value: String((schemas[variant as string]?.properties as Record<string, Json>)[shared]?.const), type: variant as string })),
      });
      return;
    }
    if (Array.isArray(schema.enum)) {
      declarations.push({ kind: "enum", name, doc: doc(schema), values: schema.enum as string[] });
      return;
    }
    const required = new Set((schema.required as string[] | undefined) ?? []);
    const fields = Object.entries((schema.properties as Record<string, Json> | undefined) ?? {}).map(([key, property]): Field => {
      const type = typeOf(property, `${name}${pascal(key)}`);
      return { key, type: required.has(key) ? type : optional(type), doc: doc(property) };
    });
    declarations.push({ kind: "object", name, doc: doc(schema), fields });
  }

  for (const [name, schema] of Object.entries(schemas)) if (name !== "Error") declare(name, schema);

  const operations: ApiOperation[] = [];
  for (const [route, methods] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const name = String(operation.operationId);
      const input = (kind: "path" | "query") => ((operation.parameters as Json[] | undefined) ?? []).filter((parameter) => parameter.in === kind);
      const body = ((((operation.requestBody as Json | undefined)?.content as Json | undefined)?.["application/json"] as Json | undefined)?.schema as Json | undefined) ?? null;
      const bodyRequired = new Set((body?.required as string[] | undefined) ?? []);
      /** Inputs are loose JSON Schema written by hand: enums and numbers travel as plain values. */
      const inputType = (schema: Json): TypeRef => {
        const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type];
        if (schema.enum || types.includes("string")) return { kind: "string" };
        if (types.includes("number")) return { kind: "number" };
        if (types.includes("boolean")) return { kind: "boolean" };
        if (types.includes("array")) return { kind: "array", of: { kind: "string" } };
        return { kind: "any" };
      };
      const parameters: Parameter[] = [
        ...input("path").map((parameter): Parameter => ({ key: String(parameter.name), type: { kind: "string" }, in: "path", required: true, doc: (parameter.description as string | undefined) ?? null })),
        ...input("query").map((parameter): Parameter => ({ key: String(parameter.name), type: inputType(parameter.schema as Json), in: "query", required: parameter.required === true, doc: ((parameter.schema as Json).description as string | undefined) ?? null })),
        ...Object.entries((body?.properties as Record<string, Json> | undefined) ?? {}).map(([key, schema]): Parameter => ({ key, type: inputType(schema), in: "body", required: bodyRequired.has(key), doc: (schema.description as string | undefined) ?? null })),
      ];
      const response = ((((operation.responses as Json)["200"] as Json).content as Json)["application/json"] as Json).schema as Json;
      operations.push({
        name,
        doc: String(operation.summary),
        method: method.toUpperCase(),
        path: route,
        parameters: [...parameters.filter((parameter) => parameter.required), ...parameters.filter((parameter) => !parameter.required)],
        output: typeOf(response, pascal(name)),
        public: Array.isArray(operation.security) && operation.security.length === 0,
      });
    }
  }
  return { declarations, operations };
}
