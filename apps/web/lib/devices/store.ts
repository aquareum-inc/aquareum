import "server-only";

import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { env } from "../env";

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

interface Contents {
  sessions: DeviceRecord[];
  codes: PendingCode[];
}

/**
 * Where device sessions live. Revocation needs state, and the instance has no database yet, so this is a
 * JSON file in the instance's data directory; a database implementation replaces it behind the same
 * interface. It holds sessions and pending sign-ins only, never balances.
 */
export interface DeviceSessionStore {
  /** Reads, changes and writes the contents as one step. */
  update<T>(change: (contents: Contents) => T): T;
  read(): Contents;
}

/** The directory the instance writes its state to: DATA_DIR, or `.data` at the repository root. */
export function dataDirectory(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..", env("DATA_DIR") || ".data");
}

/**
 * The file-backed store. It re-reads the file whenever it changed on disk, so every server module sees the
 * same sessions, and writes through a temporary file so a crash never leaves half a file.
 */
export function fileDeviceSessionStore(file = path.join(dataDirectory(), "device-sessions.json")): DeviceSessionStore {
  let cache: { contents: Contents; stamp: number } | null = null;

  const stamp = () => {
    try {
      return statSync(/* turbopackIgnore: true */ file).mtimeMs;
    } catch {
      return 0;
    }
  };

  const read = (): Contents => {
    const current = stamp();
    if (cache && cache.stamp === current) return cache.contents;
    let contents: Contents = { sessions: [], codes: [] };
    if (current !== 0) {
      const parsed = JSON.parse(readFileSync(/* turbopackIgnore: true */ file, "utf8")) as Partial<Contents>;
      contents = { sessions: parsed.sessions ?? [], codes: parsed.codes ?? [] };
    }
    cache = { contents, stamp: current };
    return contents;
  };

  return {
    read: () => structuredClone(read()),
    update(change) {
      const contents = structuredClone(read());
      const result = change(contents);
      mkdirSync(/* turbopackIgnore: true */ path.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = `${file}.${process.pid}.tmp`;
      writeFileSync(/* turbopackIgnore: true */ temporary, JSON.stringify(contents), { mode: 0o600 });
      renameSync(/* turbopackIgnore: true */ temporary, file);
      cache = { contents, stamp: stamp() };
      return result;
    },
  };
}
