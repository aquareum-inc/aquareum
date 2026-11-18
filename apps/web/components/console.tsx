"use client";

import { ConsoleShell, type ConsoleLinkProps } from "@aquareum/operator-console";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ConsoleLink({ href, ...props }: ConsoleLinkProps) {
  return <NextLink href={href} {...props} />;
}

export function Console({ appAvailable, children }: { appAvailable: boolean; children: ReactNode }) {
  return (
    <ConsoleShell pathname={usePathname()} Link={ConsoleLink} appAvailable={appAvailable}>
      {children}
    </ConsoleShell>
  );
}
