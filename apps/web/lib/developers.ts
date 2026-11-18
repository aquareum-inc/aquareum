/** The instance surfaces the Developers section depends on. */
export interface DeveloperSurfaces {
  api: boolean;
  mcp: boolean;
}

/**
 * The developer tabs this instance serves. Keys, the catalogue and the overview serve both the API
 * and the MCP server; the playground and the examples are API code. With both off there is no section.
 */
export function developerTabs({ api, mcp }: DeveloperSurfaces): string[] {
  if (!api && !mcp) return [];
  return ["/developers", "/developers/keys", "/developers/models", ...(api ? ["/developers/playground", "/developers/examples"] : [])];
}

/** Whether a page is served: a section path is, if its tab is. Paths outside the section always are. */
export function developerPathServed(pathname: string, surfaces: DeveloperSurfaces): boolean {
  if (pathname !== "/developers" && !pathname.startsWith("/developers/")) return true;
  const tabs = developerTabs(surfaces);
  return tabs.some((tab) => (tab === "/developers" ? pathname === tab : pathname === tab || pathname.startsWith(`${tab}/`)));
}
