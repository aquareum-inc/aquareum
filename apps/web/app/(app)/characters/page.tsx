import { CharactersScreen, DataSourceBadge } from "@aquareum/user-app";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { adultContent, charactersEnabled } from "@/lib/content";
import { isDev } from "@/lib/env";

export const metadata: Metadata = { title: "Characters" };

export default async function CharactersPage() {
  if (!charactersEnabled()) notFound();
  const client = await api();
  const signedIn = (await getSession()) !== null;
  const { shown } = await adultContent(client);
  const [mine, shared] = await Promise.all([
    client.listCharacters({ scope: "mine", includeMature: shown }),
    client.listCharacters({ scope: "public", includeMature: shown }),
  ]);
  return (
    <>
      {/* A guest has no characters of their own; they see the public ones. */}
      <CharactersScreen mine={signedIn ? mine.data : []} publicCharacters={shared.data.filter((entry) => !signedIn || !entry.mine)} />
      {isDev ? <DataSourceBadge sources={[{ name: "listCharacters", source: mine.source }]} /> : null}
    </>
  );
}
