import "server-only";

import { sessionSecret } from "../auth/session";
import { instance } from "../instance";
import { auditLog, type AuditLog } from "./audit";
import { operatorDeviceSessions, type OperatorDeviceSessions } from "./sessions";
import { fileAuditStore, fileOperatorDeviceStore } from "./store";

let log: AuditLog | null = null;
let built: { secret: string; sessions: OperatorDeviceSessions } | null = null;

/** The record of what operators' phones did and were refused. */
export function operatorAudit(): AuditLog {
  log ??= auditLog(fileAuditStore());
  return log;
}

/** The instance's operator device sessions. One object per process, so its request counts hold. */
export function operatorDevices(): OperatorDeviceSessions {
  const secret = sessionSecret();
  if (built?.secret !== secret) built = { secret, sessions: operatorDeviceSessions(fileOperatorDeviceStore(), secret, operatorAudit()) };
  return built.sessions;
}

/** Whether the instance offers the console inside the native apps. Off unless an operator turned it on. */
export function mobileConsoleEnabled(): boolean {
  return instance().surfaces.mobileConsole === true;
}
