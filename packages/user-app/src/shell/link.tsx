"use client";

import { createContext, useContext, type ComponentType, type ReactNode } from "react";

export interface LinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-current"?: "page" | undefined;
  "aria-label"?: string;
}

const LinkContext = createContext<ComponentType<LinkProps> | null>(null);

/** Supplies the host framework's link, so screens navigate without depending on it. */
export function LinkProvider({ Link, children }: { Link: ComponentType<LinkProps>; children: ReactNode }) {
  return <LinkContext.Provider value={Link}>{children}</LinkContext.Provider>;
}

export function useLink(): ComponentType<LinkProps> {
  const Link = useContext(LinkContext);
  if (!Link) throw new Error("useLink must be used inside LinkProvider");
  return Link;
}
