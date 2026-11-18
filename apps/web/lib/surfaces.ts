/** The surfaces an instance can serve, as the instance config sets them. */
export interface Surfaces {
  app: boolean;
  console: boolean;
  api: boolean;
  mcp: boolean;
}

/** Sign-in and the auth flow: needed by the app and by the console, so served while either is. */
export function isAuthPath(pathname: string): boolean {
  return pathname === "/sign-in" || pathname === "/auth" || pathname.startsWith("/auth/");
}

/**
 * Whether the instance serves a path, by the surfaces it has on. The console and the API keep their own
 * prefixes; sign-in serves whichever of the app and the console is on; everything else is the app.
 */
export function surfacePathServed(pathname: string, surfaces: Surfaces): boolean {
  if (pathname === "/operator" || pathname.startsWith("/operator/")) return surfaces.console;
  if (pathname.startsWith("/api/v1")) return surfaces.api;
  if (pathname.startsWith("/api/mcp")) return surfaces.mcp;
  if (pathname.startsWith("/api/")) return true;
  if (isAuthPath(pathname)) return surfaces.app || surfaces.console;
  return surfaces.app;
}

/** Where to send someone with nothing in particular to open: the app if there is one, otherwise the console. */
export function homePath(surfaces: Surfaces): string {
  return !surfaces.app && surfaces.console ? "/operator" : "/";
}
