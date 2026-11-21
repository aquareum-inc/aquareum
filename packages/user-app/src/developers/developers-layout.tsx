"use client";

import { Page, TabNav } from "@livepeer/ui";
import type { ReactNode } from "react";

import { useLink } from "../shell/link";

const TABS = [
  { href: "/developers", label: "Overview" },
  { href: "/developers/keys", label: "Keys" },
  { href: "/developers/models", label: "Models" },
  { href: "/developers/playground", label: "Playground" },
  { href: "/developers/examples", label: "Examples" },
];

/** The instance surfaces this section documents. */
export interface DeveloperSurfaces {
  api: boolean;
  mcp: boolean;
}

function describe({ api, mcp }: DeveloperSurfaces): string {
  if (api && mcp) return "Everything the app does is in the API and the MCP server, so your code or an agent can do it too.";
  return api ? "Everything the app does is in the API, so your own code can do it too." : "Everything the app does is in the MCP server, so an agent can do it too.";
}

export function DevelopersLayout({ current, available, surfaces, actions, children }: { current: string; available: ReadonlyArray<string>; surfaces: DeveloperSurfaces; actions?: ReactNode; children: ReactNode }) {
  const Link = useLink();
  return (
    <Page
      title="Developers"
      description={describe(surfaces)}
      actions={actions}
      tabs={<TabNav label="Developers" tabs={TABS.filter((tab) => available.includes(tab.href))} current={current} Link={Link} />}
    >
      {children}
    </Page>
  );
}
