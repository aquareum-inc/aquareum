import "server-only";

import { jsonFileStore } from "../data/json-file";
import type { StateStore } from "../data/store";

/** A device session as the instance keeps it. The token itself is never stored, only a keyed hash. */
export interface DeviceRecord {
  id: string;
  tokenHash: string;
  userId: string;
  name: string;
  email: string | null;
  deviceName: string;
  platform: "ios" | "android";
  /** The user's builder key, sealed with SESSION_SECRET, as the browser session cookie holds it. */
  builderKey: string | null;
  createdAt: string;
  lastUsedAt: string;
}

/** A finished sign-in waiting for its app to collect it. Single use, and short-lived. */
export interface PendingCode {
  codeHash: string;
  /** The PKCE challenge the app sent when it started: base64url(SHA-256(verifier)). */
  challenge: string;
  platform: "ios" | "android";
  userId: string;
  name: string;
  email: string | null;
  builderKey: string | null;
  expiresAt: number;
}

export interface Contents {
  sessions: DeviceRecord[];
  codes: PendingCode[];
}

/** Where device sessions live: revocation needs state. It holds sessions and pending sign-ins only, never balances. */
export type DeviceSessionStore = StateStore<Contents>;

export function fileDeviceSessionStore(): DeviceSessionStore {
  return jsonFileStore<Contents>("device-sessions.json", (value) => ({ sessions: value.sessions ?? [], codes: value.codes ?? [] }));
}
