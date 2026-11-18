import { PrivacySettings, SettingsLayout } from "@aquareum/user-app";
import type { Metadata } from "next";

import { instance } from "@/lib/instance";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <SettingsLayout current="/settings/privacy">
      <PrivacySettings retainsChats={instance().privacy?.retainChats ?? false} />
    </SettingsLayout>
  );
}
