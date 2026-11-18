import { NextResponse, type NextRequest } from "next/server";

import { checkAccess } from "@/lib/auth/guard";
import { SESSION_COOKIE, readSessionValue } from "@/lib/auth/session";
import { developerPathServed } from "@/lib/developers";
import { instance } from "@/lib/instance";

/**
 * Runs before every page: turns off surfaces the instance doesn't serve, and applies the role
 * guard. Layouts check again, so a route is never protected by this file alone.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { surfaces } = instance();
  const isConsole = pathname === "/operator" || pathname.startsWith("/operator/");
  const isApi = pathname.startsWith("/api/");
  const notServed =
    (isConsole && !surfaces.console) ||
    (pathname.startsWith("/api/v1/operator") && !surfaces.console && !surfaces.api) ||
    (pathname.startsWith("/api/v1") && !surfaces.api) ||
    (pathname.startsWith("/api/mcp") && !surfaces.mcp) ||
    (!isConsole && !isApi && !surfaces.app) ||
    !developerPathServed(pathname, surfaces);
  if (notServed) return new NextResponse("Not found", { status: 404 });
  if (isApi) return NextResponse.next();

  const access = checkAccess(pathname, readSessionValue(request.cookies.get(SESSION_COOKIE)?.value));
  if (access === "sign-in") {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // Hidden from users: the console looks like it doesn't exist.
  if (access === "forbidden") return new NextResponse("Not found", { status: 404 });
  // Tell layouts which page this is, so they can apply the same guard themselves.
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Static files in public/ (images, video, fonts) are served to everyone, signed in or not.
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpe?g|gif|ico|webp|avif|mp4|webm|mov|woff2?)$).*)"],
};
