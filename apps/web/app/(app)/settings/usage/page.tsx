import { DataSourceBadge, SettingsLayout, UsageSettings } from "@livepeer/user-app";
import type { Metadata } from "next";

import { api } from "@/lib/api";
import { isDev } from "@/lib/env";

export const metadata: Metadata = { title: "Usage" };

export default async function UsagePage() {
  const usage = await (await api()).getUsage();
  return (
    <SettingsLayout current="/settings/usage">
      <UsageSettings summary={usage.data.summary} entries={usage.data.entries} />
      {isDev ? <DataSourceBadge sources={[{ name: "getUsage", source: usage.source }]} /> : null}
    </SettingsLayout>
  );
}
