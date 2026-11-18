"use client";

import type { ConversationSummary } from "@aquareum/api-client";
import { AppShell, type Account, type LinkProps } from "@aquareum/user-app";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const AVAILABLE_ROUTES = ["/", "/studio", "/characters", "/library", "/developers"];

function Link({ href, ...props }: LinkProps) {
  return <NextLink href={href} {...props} />;
}

export function Shell({
  instanceName,
  characters,
  recents,
  account,
  consoleAvailable,
  developersAvailable,
  children,
}: {
  instanceName: string;
  characters: boolean;
  recents: ConversationSummary[];
  account: Account | null;
  consoleAvailable: boolean;
  /** Whether the instance serves the API or the MCP server, which the Developers section documents. */
  developersAvailable: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <AppShell
      instanceName={instanceName}
      pathname={pathname}
      Link={Link}
      availableRoutes={AVAILABLE_ROUTES}
      features={{ characters, developers: developersAvailable }}
      account={account}
      consoleAvailable={consoleAvailable}
      signOutAction="/auth/sign-out"
      signInHref="/sign-in"
      recents={recents.map(({ id, title }) => ({ href: `/chat/${id}`, title }))}
    >
      {children}
    </AppShell>
  );
}
