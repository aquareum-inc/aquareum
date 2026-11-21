/**
 * Writes the native apps' design tokens from the web's own sources, so no value is retyped:
 * colours, radii and type sizes from packages/ui/src/styles/tokens.css, motion from
 * packages/ui/src/lib/motion.ts. Run with `pnpm --filter @livepeer/mobile-codegen tokens`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseColour, type Rgba } from "../../config/src/colour.ts";
import { DURATION, EASE_OUT_EXPO, LAYOUT_SPRING, STAGGER } from "../../ui/src/lib/motion.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const css = readFileSync(path.join(root, "packages/ui/src/styles/tokens.css"), "utf8");

/** The custom properties declared in the first block that starts with `selector {`. */
function declarations(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`tokens.css has no "${selector}" block`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const found = new Map<string, string>();
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) found.set(match[1] as string, (match[2] as string).trim());
  return found;
}

const dark = declarations(":root");
const light = new Map([...dark, ...declarations('html[data-theme="light"]')]);
const theme = declarations("@theme inline");

function resolve(value: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 8) throw new Error(`tokens.css: var() cycle in "${value}"`);
  return value.replace(/var\(--([\w-]+)\)/g, (_, name: string) => {
    const next = vars.get(name);
    if (next === undefined) throw new Error(`tokens.css: --${name} is not defined`);
    return resolve(next, vars, depth + 1);
  });
}

const camel = (name: string) => name.replace(/-+(\w)/g, (_, char: string) => char.toUpperCase());

/** Every token that is a colour in both themes, in the order the stylesheet declares them. */
const colours = [...dark.keys()].flatMap((name) => {
  const inDark = parseColour(resolve(dark.get(name) as string, dark));
  const inLight = parseColour(resolve(light.get(name) as string, light));
  return inDark && inLight ? [{ name, dark: inDark, light: inLight }] : [];
});

const px = (name: string): number => {
  const value = theme.get(name);
  if (!value?.endsWith("px")) throw new Error(`tokens.css: --${name} should be a px length`);
  return Number(value.slice(0, -2));
};
const radii = ["field", "media", "card", "sheet"].map((name) => ({ name, value: px(`radius-${name}`) }));
const type = ["caption", "body", "lead", "title", "display"].map((name) => ({ name, size: px(`text-${name}`), line: px(`text-${name}--line-height`) }));

const curve = /cubic-bezier\(([^)]+)\)/.exec(theme.get("ease-out-expo") ?? "")?.[1]?.split(",").map(Number);
if (!curve || curve.length !== 4 || curve.some((value, index) => value !== EASE_OUT_EXPO[index])) {
  throw new Error("tokens.css --ease-out-expo and motion.ts EASE_OUT_EXPO disagree");
}

const byte = (value: number) => Math.round(value * 255).toString(16).padStart(2, "0").toUpperCase();
const header = (comment: string) => `${comment} Generated from packages/ui/src/styles/tokens.css and packages/ui/src/lib/motion.ts\n${comment} by packages/mobile-codegen. Do not edit: change the sources and run \`pnpm mobile:generate\`.\n`;

// ── Swift ────────────────────────────────────────────────────────────────
const swiftColour = (c: Rgba) => `Color(rgba: 0x${byte(c.r)}${byte(c.g)}${byte(c.b)}${byte(c.a)})`;
const swift = `${header("//")}
import SwiftUI

/// The colours of one theme. Token names match the web's CSS custom properties.
struct Palette: Equatable, Sendable {
${colours.map(({ name }) => `    var ${camel(name)}: Color`).join("\n")}

    static let dark = Palette(
${colours.map(({ name, dark: c }) => `        ${camel(name)}: ${swiftColour(c)}`).join(",\n")}
    )

    static let light = Palette(
${colours.map(({ name, light: c }) => `        ${camel(name)}: ${swiftColour(c)}`).join(",\n")}
    )

    /// Sets a token by its CSS name, for an instance's theme overrides. Unknown names are ignored.
    mutating func set(_ token: String, to colour: Color) {
        switch token {
${colours.map(({ name }) => `        case "${name}": ${camel(name)} = colour`).join("\n")}
        default: break
        }
    }
}

enum Radius {
${radii.map(({ name, value }) => `    static let ${name}: CGFloat = ${value}`).join("\n")}
}

/// A text size and its line height, in points at the default Dynamic Type size.
struct TypeSize: Sendable {
    let size: CGFloat
    let line: CGFloat

${type.map(({ name, size, line }) => `    static let ${name} = TypeSize(size: ${size}, line: ${line})`).join("\n")}
}

enum Motion {
    /// Seconds.
    static let enter: Double = ${DURATION.enter}
    static let exit: Double = ${DURATION.exit}
    static let morph: Double = ${DURATION.morph}
    static let stagger: Double = ${STAGGER}
    /// The control points of the one curve: cubic-bezier(${EASE_OUT_EXPO.join(", ")}).
    static let curve: (Double, Double, Double, Double) = (${EASE_OUT_EXPO.join(", ")})
    static let springStiffness: Double = ${LAYOUT_SPRING.stiffness}
    static let springDamping: Double = ${LAYOUT_SPRING.damping}
    static let springMass: Double = ${LAYOUT_SPRING.mass}
}
`;

// ── Kotlin ───────────────────────────────────────────────────────────────
const kotlinColour = (c: Rgba) => `Color(0x${byte(c.a)}${byte(c.r)}${byte(c.g)}${byte(c.b)})`;
const kotlin = `${header("//")}
package org.livepeer.app.generated

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/** The colours of one theme. Token names match the web's CSS custom properties. */
@Immutable
data class Palette(
${colours.map(({ name }) => `    val ${camel(name)}: Color,`).join("\n")}
) {
    /** Sets a token by its CSS name, for an instance's theme overrides. Unknown names are ignored. */
    fun with(token: String, colour: Color): Palette = when (token) {
${colours.map(({ name }) => `        "${name}" -> copy(${camel(name)} = colour)`).join("\n")}
        else -> this
    }

    companion object {
        val Dark = Palette(
${colours.map(({ name, dark: c }) => `            ${camel(name)} = ${kotlinColour(c)},`).join("\n")}
        )

        val Light = Palette(
${colours.map(({ name, light: c }) => `            ${camel(name)} = ${kotlinColour(c)},`).join("\n")}
        )
    }
}

/** Corner radii, in dp. */
object Radius {
${radii.map(({ name, value }) => `    const val ${name[0]?.toUpperCase()}${name.slice(1)} = ${value}`).join("\n")}
}

/** A text size and its line height, in sp at the default font scale. */
data class TypeSize(val size: Int, val line: Int) {
    companion object {
${type.map(({ name, size, line }) => `        val ${name[0]?.toUpperCase()}${name.slice(1)} = TypeSize(${size}, ${line})`).join("\n")}
    }
}

object Motion {
    /** Milliseconds. */
    const val Enter = ${Math.round(DURATION.enter * 1000)}
    const val Exit = ${Math.round(DURATION.exit * 1000)}
    const val Morph = ${Math.round(DURATION.morph * 1000)}
    const val Stagger = ${Math.round(STAGGER * 1000)}
    /** The control points of the one curve: cubic-bezier(${EASE_OUT_EXPO.join(", ")}). */
    val Curve = floatArrayOf(${EASE_OUT_EXPO.map((value) => `${value}f`).join(", ")})
    const val SpringStiffness = ${LAYOUT_SPRING.stiffness}f
    const val SpringDamping = ${LAYOUT_SPRING.damping}f
    const val SpringMass = ${LAYOUT_SPRING.mass}f
}
`;

const outputs: Array<[string, string]> = [
  ["apps/ios/Livepeer/Generated/Tokens.generated.swift", swift],
  ["apps/android/app/src/main/kotlin/org/livepeer/app/generated/Tokens.kt", kotlin],
];
for (const [file, content] of outputs) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}
console.log(`Wrote ${colours.length} colours, ${radii.length} radii and ${type.length} type sizes for iOS and Android.`);
