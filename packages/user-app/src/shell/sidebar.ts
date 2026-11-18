/**
 * Where the sidebar's open or closed state is kept: a cookie rather than local storage, so the server can
 * render the page with the sidebar as the person left it instead of opening it after load. Plain module,
 * so the server can read it too.
 */
export const SIDEBAR_COOKIE = "sidebar";

/** Open unless the person closed it. */
export function sidebarOpenFrom(cookie: string | undefined): boolean {
  return cookie !== "closed";
}
