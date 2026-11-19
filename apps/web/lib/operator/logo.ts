/** The largest logo the console accepts, decoded. Logos are small; this keeps the config file small too. */
export const LOGO_MAX_BYTES = 100 * 1024;

const TYPES = ["image/svg+xml", "image/png", "image/webp"] as const;
type LogoType = (typeof TYPES)[number];

export type CleanedLogo = { ok: true; value: string | null } | { ok: false; error: string };

/** What an SVG may not carry: anything that runs code, pulls in another document or defines entities. */
const UNSAFE = /<script|<foreignObject|<!ENTITY|<!DOCTYPE|javascript:|\son[a-z]+\s*=|<iframe|<embed|<object/i;

/** Takes out scripts, embedded documents and event handlers. The logo is only ever drawn as an image, where none of them run; this keeps the stored file clean regardless. */
function cleanSvg(svg: string): string | null {
  const cleaned = svg
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|foreignObject|iframe|embed|object)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|foreignObject|iframe|embed|object)\b[^>]*\/>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .trim();
  if (!/^<svg[\s>]/i.test(cleaned) || UNSAFE.test(cleaned)) return null;
  return cleaned;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function matchesType(type: LogoType, bytes: Uint8Array): boolean {
  if (type === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  return true;
}

/**
 * Checks a logo before it's written to the instance config. A path on this site or an https URL is kept
 * as it is. An upload arrives as a data URL: SVG, PNG or WebP, up to LOGO_MAX_BYTES, with SVGs cleaned.
 * Blank removes the logo.
 */
export function cleanLogo(input: string): CleanedLogo {
  const value = input.trim();
  if (!value) return { ok: true, value: null };
  if (!value.startsWith("data:")) {
    if (value.startsWith("/") || /^https:\/\//i.test(value)) return { ok: true, value };
    return { ok: false, error: "Use an uploaded image, a path on this site or an https URL." };
  }
  const match = /^data:([a-z0-9.+/-]+)(;base64)?,(.*)$/is.exec(value);
  const type = match?.[1]?.toLowerCase() as LogoType | undefined;
  if (!match || !type || !TYPES.includes(type)) return { ok: false, error: "Logos can be SVG, PNG or WebP." };
  const payload = match[3] ?? "";
  let bytes: Uint8Array;
  try {
    bytes = match[2] ? Uint8Array.from(Buffer.from(payload, "base64")) : new TextEncoder().encode(decodeURIComponent(payload));
  } catch {
    return { ok: false, error: "That image couldn't be read." };
  }
  if (bytes.byteLength === 0) return { ok: false, error: "That image is empty." };
  if (bytes.byteLength > LOGO_MAX_BYTES) return { ok: false, error: `Logos can be up to ${LOGO_MAX_BYTES / 1024} KB.` };
  if (!matchesType(type, bytes)) return { ok: false, error: "That file isn't the kind of image its name says." };
  if (type !== "image/svg+xml") return { ok: true, value: `data:${type};base64,${Buffer.from(bytes).toString("base64")}` };
  const svg = cleanSvg(new TextDecoder().decode(bytes));
  if (!svg) return { ok: false, error: "That SVG couldn't be used. Export it again as a plain SVG, without scripts or embedded content." };
  return { ok: true, value: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` };
}
