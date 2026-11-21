"use client";

import type { ConversationSummary } from "@livepeer/api-client";
import type { Brand } from "@livepeer/ui";
import { AppShell, type Account, type LinkProps } from "@livepeer/user-app";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const AVAILABLE_ROUTES = ["/", "/studio", "/characters", "/library", "/developers"];

function Link({ href, ...props }: LinkProps) {
  return <NextLink href={href} {...props} />;
}

export function Shell({
  brand,
  characters,
  recents,
  account,
  consoleAvailable,
  developersAvailable,
  sidebarOpen,
  children,
}: {
  brand: Brand;
  characters: boolean;
  recents: ConversationSummary[];
  account: Account | null;
  consoleAvailable: boolean;
  /** Whether the instance serves the API or the MCP server, which the Developers section documents. */
  developersAvailable: boolean;
  /** From the sidebar cookie, so the first paint matches how the person left it. */
  sidebarOpen: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <AppShell
      brand={brand}
      pathname={pathname}
      Link={Link}
      availableRoutes={AVAILABLE_ROUTES}
      features={{ characters, developers: developersAvailable }}
      account={account}
      consoleAvailable={consoleAvailable}
      initialOpen={sidebarOpen}
      signOutAction="/auth/sign-out"
      signInHref="/sign-in"
      recents={recents.map(({ id, title }) => ({ href: `/chat/${id}`, title }))}
    >
      {children}
    </AppShell>
  );
}
