/**
 * CSS colours resolved to sRGB, for clients that can't read CSS: the native apps' generated tokens and
 * the theme overrides the instance sends them. Handles what the tokens and the console use: hex,
 * rgb(), oklch() and color-mix(in oklch, …). Anything else resolves to null.
 */

/** sRGB, each channel 0 to 1, not premultiplied. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface Oklch {
  l: number;
  c: number;
  h: number;
  a: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

function oklabToLinear(l: number, a: number, b: number): [number, number, number] {
  const l_ = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m_ = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s_ = Math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** Channels outside sRGB are clipped, which is what browsers do on an sRGB screen, so the apps match the web. */
function oklchToRgba({ l, c, h, a }: Oklch): Rgba {
  const rgb = oklabToLinear(l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180));
  return { r: clamp(toGamma(clamp(rgb[0]))), g: clamp(toGamma(clamp(rgb[1]))), b: clamp(toGamma(clamp(rgb[2]))), a };
}

function rgbaToOklch({ r, g, b, a }: Rgba): Oklch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const l = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360, a };
}

/** "50%" → 0.5, "0.5" → 0.5 (or 0.5 × scale for channels where a bare number isn't a fraction). */
function amount(text: string, bare = 1): number {
  return text.endsWith("%") ? Number(text.slice(0, -1)) / 100 : Number(text) / bare;
}

/** Splits on commas that aren't inside brackets. */
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

function parseOklch(value: string): Oklch | null {
  const rgba = parseColour(value);
  if (!rgba) return null;
  const direct = /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)$/i.exec(value.trim());
  // Keep the authored lightness, chroma and hue when there are some: converting through sRGB would clip them.
  if (direct) return { l: amount(direct[1] as string), c: amount(direct[2] as string, 1) * (String(direct[2]).endsWith("%") ? 0.4 : 1), h: Number(direct[3]), a: direct[4] ? amount(direct[4]) : 1 };
  return rgbaToOklch(rgba);
}

/** `color-mix(in oklch, A p%, B)`, with premultiplied alpha so mixing with `transparent` only fades. */
function mix(body: string): Rgba | null {
  const [space, first, second] = splitTop(body);
  if (!space || !first || !second || !/^in\s+oklch$/i.test(space)) return null;
  const part = (text: string) => {
    const match = /^(.*?)(?:\s+([\d.]+)%)?$/.exec(text.trim());
    return { colour: (match?.[1] ?? text).trim(), share: match?.[2] ? Number(match[2]) / 100 : null };
  };
  const a = part(first);
  const b = part(second);
  const shareA = a.share ?? (b.share !== null ? 1 - b.share : 0.5);
  const shareB = b.share ?? 1 - shareA;
  const total = shareA + shareB;
  if (total <= 0) return null;
  const [wa, wb] = [shareA / total, shareB / total];
  const ca = parseOklch(a.colour);
  const cb = parseOklch(b.colour);
  if (!ca || !cb) return null;
  const alpha = ca.a * wa + cb.a * wb;
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const pa = (ca.a * wa) / alpha;
  const pb = (cb.a * wb) / alpha;
  // A colour without chroma has no hue of its own: it takes the other's, so greys don't drag the hue.
  const ha = ca.c < 0.0001 ? cb.h : ca.h;
  const hb = cb.c < 0.0001 ? ca.h : cb.h;
  const delta = ((hb - ha + 540) % 360) - 180;
  return oklchToRgba({ l: ca.l * pa + cb.l * pb, c: ca.c * pa + cb.c * pb, h: (ha + delta * pb + 360) % 360, a: alpha * Math.min(1, total) });
}

/** A CSS colour as sRGB, or null when it isn't one this resolves. */
export function parseColour(input: string): Rgba | null {
  const value = input.trim().toLowerCase();
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (value === "white") return { r: 1, g: 1, b: 1, a: 1 };
  if (value === "black") return { r: 0, g: 0, b: 0, a: 1 };

  const hex = /^#([0-9a-f]{3,8})$/.exec(value)?.[1];
  if (hex && [3, 4, 6, 8].includes(hex.length)) {
    const full = hex.length <= 4 ? [...hex].map((char) => char + char).join("") : hex;
    const channel = (index: number) => parseInt(full.slice(index * 2, index * 2 + 2), 16) / 255;
    return { r: channel(0), g: channel(1), b: channel(2), a: full.length === 8 ? channel(3) : 1 };
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[/,]\s*([\d.]+%?))?\s*\)$/.exec(value);
  if (rgb) return { r: clamp(Number(rgb[1]) / 255), g: clamp(Number(rgb[2]) / 255), b: clamp(Number(rgb[3]) / 255), a: rgb[4] ? amount(rgb[4]) : 1 };

  const oklch = /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)$/.exec(value);
  if (oklch) {
    const chroma = String(oklch[2]).endsWith("%") ? (Number(String(oklch[2]).slice(0, -1)) / 100) * 0.4 : Number(oklch[2]);
    return oklchToRgba({ l: amount(oklch[1] as string), c: chroma, h: Number(oklch[3]), a: oklch[4] ? amount(oklch[4]) : 1 });
  }

  const mixed = /^color-mix\((.*)\)$/.exec(value);
  if (mixed) return mix(mixed[1] as string);
  return null;
}

/** `#RRGGBB`, or `#RRGGBBAA` when not opaque. */
export function toHex({ r, g, b, a }: Rgba): string {
  const byte = (v: number) => Math.round(clamp(v) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${byte(r)}${byte(g)}${byte(b)}${a < 0.999 ? byte(a) : ""}`;
}

/** A CSS colour as hex, or null. */
export function colourToHex(input: string): string | null {
  const rgba = parseColour(input);
  return rgba ? toHex(rgba) : null;
}
