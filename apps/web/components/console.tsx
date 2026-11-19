"use client";

import { ConsoleShell, type ConsoleLinkProps } from "@aquareum/operator-console";
import type { Brand } from "@aquareum/ui";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ConsoleLink({ href, ...props }: ConsoleLinkProps) {
  return <NextLink href={href} {...props} />;
}

export function Console({ brand, appAvailable, children }: { brand: Brand; appAvailable: boolean; children: ReactNode }) {
  return (
    <ConsoleShell brand={brand} pathname={usePathname()} Link={ConsoleLink} appAvailable={appAvailable}>
      {children}
    </ConsoleShell>
  );
}
