import { DataSourceBadge, DevelopersLayout, KeysScreen } from "@aquareum/user-app";
import type { Metadata } from "next";

import { createApiKeyAction, revokeApiKeyAction } from "@/lib/actions";
import { api } from "@/lib/api";
import { developerTabs } from "@/lib/developers";
import { instance } from "@/lib/instance";
import { isDev } from "@/lib/env";

export const metadata: Metadata = { title: "API keys" };

export default async function KeysPage() {
  const { surfaces } = instance();
  const keys = await (await api()).listApiKeys();
  return (
    <DevelopersLayout current="/developers/keys" available={developerTabs(surfaces)} surfaces={surfaces}>
      <KeysScreen initialKeys={keys.data} create={createApiKeyAction} revoke={revokeApiKeyAction} />
      {isDev ? <DataSourceBadge sources={[{ name: "listApiKeys", source: keys.source }]} /> : null}
    </DevelopersLayout>
  );
}
