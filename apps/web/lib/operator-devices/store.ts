import "server-only";

import type { OperatorAuditEntry } from "@livepeer/api-client";

import { jsonFileStore } from "../data/json-file";
import type { StateStore } from "../data/store";

/**
 * An operator device session as the instance keeps it. The token is never stored, only a keyed hash, and
 * there is no builder key: this session can't run a job or spend credit.
 */
export interface OperatorDeviceRecord {
  id: string;
  tokenHash: string;
  userId: string;
  name: string;
  email: string | null;
  deviceName: string;
  platform: "ios" | "android";
  /** The phone's P-256 public key, as base64 of its SubjectPublicKeyInfo. The private half never leaves the phone. */
  publicKey: string;
  createdAt: string;
  lastUsedAt: string;
  lastUnlockedAt: string | null;
  /** Unix milliseconds until which reads are allowed. 0 while locked. */
  unlockedUntil: number;
  /** Proofs refused in a row. The session is revoked when this reaches the limit. */
  failedProofs: number;
}

/** A finished operator sign-in waiting for its app to collect it. Single use, and short-lived. */
export interface PendingOperatorCode {
  codeHash: string;
  /** The PKCE challenge the app sent when it started: base64url(SHA-256(verifier)). */
  challenge: string;
  platform: "ios" | "android";
  userId: string;
  name: string;
  email: string | null;
  expiresAt: number;
}

/** A nonce a phone was given to sign. Single use, and short-lived. */
export interface PendingChallenge {
  nonceHash: string;
  sessionId: string;
  /** Null for an unlock. For a change: the one operation and input the proof is good for. */
  operation: string | null;
  inputHash: string | null;
  expiresAt: number;
}

export interface OperatorDeviceContents {
  sessions: OperatorDeviceRecord[];
  codes: PendingOperatorCode[];
  challenges: PendingChallenge[];
}

export type OperatorDeviceStore = StateStore<OperatorDeviceContents>;

/** Operator device sessions live in their own file, apart from users' device sessions. */
export function fileOperatorDeviceStore(): OperatorDeviceStore {
  return jsonFileStore<OperatorDeviceContents>("operator-device-sessions.json", (value) => ({ sessions: value.sessions ?? [], codes: value.codes ?? [], challenges: value.challenges ?? [] }));
}

export interface AuditContents {
  entries: OperatorAuditEntry[];
}

export type AuditStore = StateStore<AuditContents>;

export function fileAuditStore(): AuditStore {
  return jsonFileStore<AuditContents>("operator-audit.json", (value) => ({ entries: value.entries ?? [] }));
}
