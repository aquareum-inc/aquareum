"use client";

import { Page, TabNav } from "@aquareum/ui";
import type { ReactNode } from "react";

import { useLink } from "../shell/link";

const TABS = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/general", label: "General" },
  { href: "/settings/privacy", label: "Privacy" },
  { href: "/settings/plan", label: "Plan and credits" },
  { href: "/settings/usage", label: "Usage" },
  { href: "/settings/devices", label: "Devices" },
];

export function SettingsLayout({ current, children }: { current: string; children: ReactNode }) {
  const Link = useLink();
  return (
    <Page title="Settings" width="narrow" tabs={<TabNav label="Settings" tabs={TABS} current={current} Link={Link} />}>
      {children}
    </Page>
  );
}
