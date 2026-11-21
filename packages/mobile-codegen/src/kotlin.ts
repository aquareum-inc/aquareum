/** Writes the Android app's API models and client from docs/mobile/openapi.json. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { camel, pascal, readModel, root, type Declaration, type TypeRef } from "./model.ts";

const { declarations, operations } = readModel();

const RESERVED = new Set(["as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is", "null", "object", "package", "return", "super", "this", "throw", "true", "try", "typealias", "typeof", "val", "var", "when", "while"]);
const ident = (name: string) => (RESERVED.has(name) ? `\`${name}\`` : name);

function type(ref: TypeRef): string {
  switch (ref.kind) {
    case "string":
      return "String";
    case "number":
      return "Double";
    case "boolean":
      return "Boolean";
    case "any":
      return "JsonElement";
    case "named":
      return ref.name;
    case "array":
      return `List<${type(ref.of)}>`;
    case "map":
      return `Map<String, ${type(ref.of)}>`;
    case "optional":
      return `${type(ref.of)}?`;
  }
}

/** The serializer for a type, for the transport to decode a response with. */
function serializer(ref: TypeRef): string {
  switch (ref.kind) {
    case "string":
      return "String.serializer()";
    case "number":
      return "Double.serializer()";
    case "boolean":
      return "Boolean.serializer()";
    case "any":
      return "JsonElement.serializer()";
    case "named":
      return `${ref.name}.serializer()`;
    case "array":
      return `ListSerializer(${serializer(ref.of)})`;
    case "map":
      return `MapSerializer(String.serializer(), ${serializer(ref.of)})`;
    case "optional":
      return `${serializer(ref.of)}.nullable`;
  }
}

/** "16:9" → V16x9, "single-shot" → SingleShot, "720p" → V720p. */
function entryName(value: string): string {
  const name = pascal(value.replace(/:/g, "x").replace(/[^\w]+/g, "_"));
  return /^\d/.test(name) ? `V${name}` : name;
}

const docBlock = (doc: string | null, indent = "") => (doc ? `${indent}/** ${doc.replace(/\*\//g, "* /").split("\n").join(`\n${indent} * `)} */\n` : "");

function emit(declaration: Declaration): string {
  if (declaration.kind === "enum") {
    return `${docBlock(declaration.doc)}@Serializable(with = ${declaration.name}.Serializer::class)
enum class ${declaration.name}(val value: String) {
${declaration.values.map((value) => `    ${entryName(value)}(${JSON.stringify(value)}),`).join("\n")}

    /** A value this build doesn't know, from a newer instance. */
    Unknown("");

    object Serializer : KSerializer<${declaration.name}> {
        override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("${declaration.name}", PrimitiveKind.STRING)
        override fun deserialize(decoder: Decoder): ${declaration.name} = decoder.decodeString().let { value -> entries.firstOrNull { it.value == value } ?: Unknown }
        override fun serialize(encoder: Encoder, value: ${declaration.name}) = encoder.encodeString(value.value)
    }
}`;
  }
  if (declaration.kind === "union") {
    const cases = declaration.variants.map((variant) => ({ ...variant, name: entryName(variant.value) }));
    return `${docBlock(declaration.doc)}@Serializable(with = ${declaration.name}.Serializer::class)
sealed interface ${declaration.name} {
${cases.map((entry) => `    data class ${entry.name}(val value: ${entry.type}) : ${declaration.name}`).join("\n")}

    object Serializer : KSerializer<${declaration.name}> {
        override val descriptor: SerialDescriptor = buildClassSerialDescriptor("${declaration.name}")

        override fun deserialize(decoder: Decoder): ${declaration.name} {
            val input = decoder as? JsonDecoder ?: throw SerializationException("${declaration.name} is read from JSON only")
            val element = input.decodeJsonElement()
            return when (val kind = element.jsonObject[${JSON.stringify(declaration.discriminator)}]?.jsonPrimitive?.content) {
${cases.map((entry) => `                ${JSON.stringify(entry.value)} -> ${entry.name}(input.json.decodeFromJsonElement(${entry.type}.serializer(), element))`).join("\n")}
                else -> throw SerializationException("Unknown ${declaration.name} ${declaration.discriminator}: $kind")
            }
        }

        override fun serialize(encoder: Encoder, value: ${declaration.name}) = when (value) {
${cases.map((entry) => `            is ${entry.name} -> encoder.encodeSerializableValue(${entry.type}.serializer(), value.value)`).join("\n")}
        }
    }
}`;
  }
  return `${docBlock(declaration.doc)}@Serializable
data class ${declaration.name}(
${declaration.fields
  .map((field) => `${docBlock(field.doc, "    ")}    @SerialName(${JSON.stringify(field.key)}) val ${ident(camel(field.key))}: ${type(field.type)}${field.type.kind === "optional" ? " = null" : ""},`)
  .join("\n")}
)`;
}

const header = "// Generated from docs/mobile/openapi.json by packages/mobile-codegen.\n// Do not edit: change apps/web/lib/public-api/operations.ts or the API client's types and run `pnpm mobile:generate`.\n";

const models = `${header}
package org.livepeer.app.generated

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

${declarations.map(emit).join("\n\n")}
`;

function method(operation: (typeof operations)[number]): string {
  const args = operation.parameters.map((parameter) => `${ident(camel(parameter.key))}: ${type(parameter.type)}${parameter.required ? "" : "? = null"}`).join(", ");
  const route = operation.path.replace(/\{(\w+)\}/g, (_, name: string) => `\${ApiTransport.escape(${ident(camel(name))})}`);
  const entries = (kind: "query" | "body") => operation.parameters.filter((parameter) => parameter.in === kind);
  const value = (parameter: (typeof operation.parameters)[number]) => {
    const name = ident(camel(parameter.key));
    const wrap = (inner: string) => (parameter.type.kind === "array" ? `JsonArray(${inner}.map(::JsonPrimitive))` : parameter.type.kind === "any" ? inner : `JsonPrimitive(${inner})`);
    return parameter.required ? wrap(name) : `${name}?.let { ${wrap("it")} }`;
  };
  const map = (kind: "query" | "body") => {
    const list = entries(kind);
    return list.length === 0 ? "emptyMap()" : `mapOf(${list.map((parameter) => `${JSON.stringify(parameter.key)} to ${value(parameter)}`).join(", ")})`;
  };
  return `${docBlock(`${operation.doc}${operation.public ? " Open to guests." : ""}`, "    ")}    suspend fun ${camel(operation.name)}(${args}): ${type(operation.output)} =
        transport.send(${serializer(operation.output)}, ${JSON.stringify(operation.method)}, "${route}", query = ${map("query")}, body = ${entries("body").length > 0 ? map("body") : "null"})`;
}

const client = `${header}
package org.livepeer.app.generated

import org.livepeer.app.api.ApiTransport
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

/** One function per operation in the instance's API. The same list serves REST, MCP and the web interface. */
@Suppress("unused")
class Api(private val transport: ApiTransport) {
${operations.map(method).join("\n\n")}
}
`;

const directory = path.join(root, "apps/android/app/src/main/kotlin/org/livepeer/app/generated");
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, "Models.kt"), models);
writeFileSync(path.join(directory, "Api.kt"), client);
console.log(`Wrote ${declarations.length} Kotlin types and ${operations.length} operations.`);
