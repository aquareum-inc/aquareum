import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";

import { memoryStore } from "../data/store";
import type { AuditContents, OperatorDeviceContents } from "./store";

/** What a phone holds in tests: a P-256 key pair standing in for the one in its secure hardware. */
export interface TestPhone {
  privateKey: KeyObject;
  /** The bare uncompressed point, as iOS exports it. */
  rawPublicKey: string;
  /** The SubjectPublicKeyInfo, as Android exports it. */
  spkiPublicKey: string;
  sign(message: string): string;
}

export function testPhone(): TestPhone {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spki = publicKey.export({ format: "der", type: "spki" });
  return {
    privateKey,
    rawPublicKey: spki.subarray(spki.length - 65).toString("base64"),
    spkiPublicKey: spki.toString("base64url"),
    sign: (message) => sign("sha256", Buffer.from(message), { key: privateKey, dsaEncoding: "der" }).toString("base64url"),
  };
}

export const TEST_SECRET = "s".repeat(32);
export const TEST_VERIFIER = "a-verifier-the-app-made-and-kept-to-itself-0123";
export const TEST_CHALLENGE = createHash("sha256").update(TEST_VERIFIER).digest("base64url");

export const emptyOperatorDevices = () => memoryStore<OperatorDeviceContents>({ sessions: [], codes: [], challenges: [] });
export const emptyAudit = () => memoryStore<AuditContents>({ entries: [] });
