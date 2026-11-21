import "server-only";

import { createHash, createPublicKey, verify, type KeyObject } from "node:crypto";

/**
 * What a phone signs. The first line says what the signature is for, so an unlock can never be replayed as a
 * change, and a change names its one operation and the hash of its one input.
 *
 *   unlock:  "livepeer-operator-unlock\n<nonce>"
 *   confirm: "livepeer-operator-confirm\n<nonce>\n<operation>\n<input hash>"
 *
 * Signatures are ECDSA P-256 over SHA-256 of these bytes, DER encoded, sent as base64url: what
 * `ecdsaSignatureMessageX962SHA256` (iOS) and `SHA256withECDSA` (Android) produce.
 */
export const unlockMessage = (nonce: string) => `livepeer-operator-unlock\n${nonce}`;
export const confirmMessage = (nonce: string, operation: string, inputHash: string) => `livepeer-operator-confirm\n${nonce}\n${operation}\n${inputHash}`;

/** JSON with object keys in order and no spacing, so a phone and the instance hash the same bytes. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * The hash a proof is bound to: base64url(SHA-256) of an operation's whole input, path values included, as
 * canonical JSON. A phone hashes what it is about to send; the instance hashes what arrived.
 */
export function inputHash(input: Record<string, unknown>): string {
  return createHash("sha256").update(canonical(input)).digest("base64url");
}

/** The fixed start of a P-256 SubjectPublicKeyInfo; the 65-byte uncompressed point follows it. */
const P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");

/**
 * Reads the public key a phone enrolled with: base64 or base64url of either the SubjectPublicKeyInfo
 * (Android) or the bare uncompressed point (iOS). Answers with base64 of the SubjectPublicKeyInfo, or null
 * unless it is a valid point on P-256. No other curve or key type is accepted.
 */
export function readPublicKey(value: string): string | null {
  if (!/^[\w+/=-]{80,200}$/.test(value)) return null;
  const bytes = Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const spki = bytes.length === 65 && bytes[0] === 4 ? Buffer.concat([P256_SPKI_PREFIX, bytes]) : bytes;
  if (spki.length !== P256_SPKI_PREFIX.length + 65 || !spki.subarray(0, P256_SPKI_PREFIX.length).equals(P256_SPKI_PREFIX)) return null;
  return keyOf(spki.toString("base64")) ? spki.toString("base64") : null;
}

function keyOf(publicKey: string): KeyObject | null {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKey, "base64"), format: "der", type: "spki" });
    return key.asymmetricKeyType === "ec" && key.asymmetricKeyDetails?.namedCurve === "prime256v1" ? key : null;
  } catch {
    return null;
  }
}

/** Whether `signature` is the key's signature of `message`. False for anything malformed. */
export function signed(publicKey: string, message: string, signature: string): boolean {
  const key = keyOf(publicKey);
  if (!key || !/^[\w-]{16,200}$/.test(signature)) return false;
  try {
    return verify("sha256", Buffer.from(message), { key, dsaEncoding: "der" }, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}
