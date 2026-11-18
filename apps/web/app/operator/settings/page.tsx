import { SettingsView } from "@aquareum/operator-console";
import type { Metadata } from "next";

import { saveInstanceSettingsAction } from "@/lib/operator/actions";
import { operatorApi } from "@/lib/operator/client";
import { currentSettings } from "@/lib/operator/settings";

export const metadata: Metadata = { title: "Instance settings" };

export default async function SettingsPage() {
  await operatorApi();
  const { settings, file } = currentSettings();
  return <SettingsView initial={settings} file={file} save={saveInstanceSettingsAction} />;
}
