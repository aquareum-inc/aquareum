import "server-only";

import { sessionSecret } from "../auth/session";
import { instance } from "../instance";
import { deviceSessions, type DeviceSessions, type Platform } from "./sessions";
import { fileDeviceSessionStore, type DeviceSessionStore } from "./store";

let store: DeviceSessionStore | null = null;

/** The instance's device sessions. */
export function devices(): DeviceSessions {
  store ??= fileDeviceSessionStore();
  return deviceSessions(store, sessionSecret());
}

/** Whether the instance serves the native apps at all. */
export function mobileEnabled(): boolean {
  return instance().surfaces.mobile === true;
}

/**
 * Where a finished sign-in returns to: `<identifier>://auth` for the app built for this instance. Null when
 * the instance names no app for that platform, so a sign-in can't be handed to an app it doesn't know.
 */
export function appCallback(platform: Platform): string | null {
  const apps = instance().mobile;
  const identifier = platform === "ios" ? apps?.ios?.bundleId : apps?.android?.applicationId;
  return identifier ? `${identifier.toLowerCase()}://auth` : null;
}
