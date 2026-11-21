/** Writes the iOS app's API models and client from docs/mobile/openapi.json. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { camel, readModel, root, type Declaration, type Field, type TypeRef } from "./model.ts";

const { declarations, operations } = readModel();

const RESERVED = new Set(["default", "private", "public", "internal", "operator", "class", "struct", "enum", "case", "in", "is", "as", "self", "extension", "protocol", "import", "return", "repeat", "switch", "where", "true", "false", "nil"]);
const ident = (name: string) => (RESERVED.has(name) ? `\`${name}\`` : name);

function type(ref: TypeRef): string {
  switch (ref.kind) {
    case "string":
      return "String";
    case "number":
      return "Double";
    case "boolean":
      return "Bool";
    case "any":
      return "JSONValue";
    case "named":
      return ref.name;
    case "array":
      return `[${type(ref.of)}]`;
    case "map":
      return `[String: ${type(ref.of)}]`;
    case "optional":
      return `${type(ref.of)}?`;
  }
}

/** "16:9" → v16x9, "single-shot" → singleShot, "720p" → v720p. */
function caseName(value: string): string {
  const name = camel(value.replace(/:/g, "x").replace(/[^\w]+/g, "_"));
  return ident(/^\d/.test(name) ? `v${name}` : name);
}

const docLines = (doc: string | null, indent = "") => (doc ? doc.split("\n").map((line) => `${indent}/// ${line}\n`).join("") : "");

function emit(declaration: Declaration): string {
  if (declaration.kind === "enum") {
    return `${docLines(declaration.doc)}enum ${declaration.name}: String, Codable, Sendable, Hashable, CaseIterable {
${declaration.values.map((value) => `    case ${caseName(value)} = ${JSON.stringify(value)}`).join("\n")}
    /// A value this build doesn't know, from a newer instance.
    case unknown = "\\u{0}unknown"

    init(from decoder: Decoder) throws {
        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown
    }
}`;
  }
  if (declaration.kind === "union") {
    const cases = declaration.variants.map((variant) => ({ ...variant, name: caseName(variant.value) }));
    return `${docLines(declaration.doc)}enum ${declaration.name}: Codable, Sendable, Hashable {
${cases.map((entry) => `    case ${entry.name}(${entry.type})`).join("\n")}

    private enum Discriminator: String, CodingKey { case ${ident(camel(declaration.discriminator))} = ${JSON.stringify(declaration.discriminator)} }

    init(from decoder: Decoder) throws {
        let kind = try decoder.container(keyedBy: Discriminator.self).decode(String.self, forKey: .${camel(declaration.discriminator)})
        switch kind {
${cases.map((entry) => `        case ${JSON.stringify(entry.value)}: self = .${entry.name}(try ${entry.type}(from: decoder))`).join("\n")}
        default: throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unknown ${declaration.name} ${declaration.discriminator}: \\(kind)"))
        }
    }

    func encode(to encoder: Encoder) throws {
        switch self {
${cases.map((entry) => `        case .${entry.name}(let value): try value.encode(to: encoder)`).join("\n")}
        }
    }
}`;
  }
  const property = (field: Field) => ident(camel(field.key));
  const renamed = declaration.fields.some((field) => camel(field.key) !== field.key);
  return `${docLines(declaration.doc)}struct ${declaration.name}: Codable, Sendable, Hashable {
${declaration.fields.map((field) => `${docLines(field.doc, "    ")}    var ${property(field)}: ${type(field.type)}`).join("\n")}${
    renamed
      ? `\n\n    enum CodingKeys: String, CodingKey {\n${declaration.fields.map((field) => `        case ${property(field)}${camel(field.key) === field.key ? "" : ` = ${JSON.stringify(field.key)}`}`).join("\n")}\n    }`
      : ""
  }
}`;
}

const header = "// Generated from docs/mobile/openapi.json by packages/mobile-codegen.\n// Do not edit: change apps/web/lib/public-api/operations.ts or the API client's types and run `pnpm mobile:generate`.\n";

const models = `${header}
import Foundation

${declarations.map(emit).join("\n\n")}
`;

function method(operation: (typeof operations)[number]): string {
  const args = operation.parameters.map((parameter) => `${ident(camel(parameter.key))}: ${type(parameter.type)}${parameter.required ? "" : "? = nil"}`).join(", ");
  const route = operation.path.replace(/\{(\w+)\}/g, (_, name: string) => `\\(APITransport.escape(${ident(camel(name))}))`);
  const entries = (kind: "query" | "body") => operation.parameters.filter((parameter) => parameter.in === kind);
  const value = (parameter: (typeof operation.parameters)[number]) => {
    const name = ident(camel(parameter.key));
    const wrap = (inner: string): string => {
      switch (parameter.type.kind) {
        case "string":
          return `.string(${inner})`;
        case "number":
          return `.number(${inner})`;
        case "boolean":
          return `.bool(${inner})`;
        case "array":
          return `.array(${inner}.map { .string($0) })`;
        default:
          return inner;
      }
    };
    return parameter.required ? wrap(name) : `${name}.map { ${wrap("$0")} }`;
  };
  const dictionary = (kind: "query" | "body") => {
    const list = entries(kind);
    return list.length === 0 ? "[:]" : `[${list.map((parameter) => `${JSON.stringify(parameter.key)}: ${value(parameter)}`).join(", ")}]`;
  };
  return `${docLines(operation.doc, "    ")}${operation.public ? "    /// Open to guests.\n" : ""}    func ${camel(operation.name)}(${args}) async throws -> ${type(operation.output)} {
        try await transport.send(${JSON.stringify(operation.method)}, "${route}", query: ${dictionary("query")}, body: ${entries("body").length > 0 ? dictionary("body") : "nil"})
    }`;
}

const client = `${header}
import Foundation

/// One function per operation in the instance's API. The same list serves REST, MCP and the web interface.
struct API: Sendable {
    let transport: APITransport

${operations.map(method).join("\n\n")}
}
`;

const directory = path.join(root, "apps/ios/Livepeer/Generated");
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, "Models.generated.swift"), models);
writeFileSync(path.join(directory, "API.generated.swift"), client);
console.log(`Wrote ${declarations.length} Swift types and ${operations.length} operations.`);
