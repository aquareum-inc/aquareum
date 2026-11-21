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

type Operation = (typeof operations)[number];
type Param = Operation["parameters"][number];

const argument = (parameter: Param) => `${ident(camel(parameter.key))}: ${type(parameter.type)}${parameter.required ? "" : "? = nil"}`;

function value(parameter: Param): string {
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
}

const dictionary = (list: Param[]) => (list.length === 0 ? "[:]" : `[${list.map((parameter) => `${JSON.stringify(parameter.key)}: ${value(parameter)}`).join(", ")}]`);

/** One function for an operation. A change the console confirms also takes its proof, so it can't be called without one. */
function method(operation: Operation): string {
  const confirm = operation.mobile === "confirm";
  const args = [...operation.parameters.map(argument), ...(confirm ? ["proof: OperatorProof"] : [])].join(", ");
  const route = operation.path.replace(/\{(\w+)\}/g, (_, name: string) => `\\(APITransport.escape(${ident(camel(name))}))`);
  const entries = (kind: "query" | "body") => operation.parameters.filter((parameter) => parameter.in === kind);
  const proof = operation.operator ? `, proof: ${confirm ? "proof" : "nil"}` : "";
  return `${docLines(operation.doc, "    ")}${operation.public ? "    /// Open to guests.\n" : ""}${operation.mobile === "read" ? "    /// Needs the console unlocked on this phone.\n" : ""}${confirm ? "    /// Needs its own proof: a nonce for exactly this input, signed after a face or fingerprint.\n" : ""}    func ${camel(operation.name)}(${args}) async throws -> ${type(operation.output)} {
        try await transport.send(${JSON.stringify(operation.method)}, "${route}", query: ${dictionary(entries("query"))}, body: ${entries("body").length > 0 ? dictionary(entries("body")) : "nil"}${proof})
    }`;
}

/** The whole input of a change, path values included: what the phone hashes when it asks for a nonce. */
function confirmInput(operation: Operation): string {
  return `    /// The input of \`${camel(operation.name)}\` as the instance hashes it, for \`createOperatorChallenge\`.
    static func ${camel(operation.name)}Input(${operation.parameters.map(argument).join(", ")}) -> [String: JSONValue] {
        (${dictionary(operation.parameters)} as [String: JSONValue?]).compactMapValues { $0 }
    }`;
}

const userOperations = operations.filter((operation) => !operation.operator);
const operatorOperations = operations.filter((operation) => operation.operator);

const client = `${header}
import Foundation

/// One function per operation in the instance's API. The same list serves REST, MCP and the web interface.
struct API: Sendable {
    let transport: APITransport

${userOperations.map(method).join("\n\n")}
}
`;

const operatorClient = `${header}
import Foundation

/// A confirmation of one change: the nonce the instance gave for exactly that operation and input, and the
/// phone key's signature over it, made after a face or fingerprint. Good once, for 60 seconds.
struct OperatorProof: Sendable {
    let nonce: String
    let signature: String

    /// The value of the X-Operator-Proof header.
    var header: String { "\\(nonce).\\(signature)" }
}

/// What carries the console's requests: the operator device session's token, and a proof when there is one.
/// Only the console's own session implements it; the user app's transport does not.
protocol OperatorTransport: Sendable {
    func send<Output: Decodable>(_ method: String, _ path: String, query: [String: JSONValue?], body: [String: JSONValue?]?, proof: OperatorProof?) async throws -> Output
}

/// The operator console's operations a phone may call. It is made from an operator session and nothing else,
/// and every change takes a proof.
struct OperatorAPI<Transport: OperatorTransport>: Sendable {
    private let transport: Transport

    init(session transport: Transport) {
        self.transport = transport
    }

${operatorOperations.map(method).join("\n\n")}

${operatorOperations.filter((operation) => operation.mobile === "confirm").map(confirmInput).join("\n\n")}
}
`;

const directory = path.join(root, "apps/ios/Livepeer/Generated");
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, "Models.generated.swift"), models);
writeFileSync(path.join(directory, "API.generated.swift"), client);
writeFileSync(path.join(directory, "OperatorAPI.generated.swift"), operatorClient);
console.log(`Wrote ${declarations.length} Swift types, ${userOperations.length} operations and ${operatorOperations.length} operator operations.`);
