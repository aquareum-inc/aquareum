import { DataSourceBadge } from "@aquareum/user-app";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CharacterDetail } from "@/components/character";
import { api } from "@/lib/api";
import { adultContent, charactersEnabled } from "@/lib/content";
import { isDev } from "@/lib/env";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const character = await (await api()).getCharacter((await params).slug);
  return { title: character.data?.name ?? "Character" };
}

export default async function CharacterPage({ params }: Props) {
  if (!charactersEnabled()) notFound();
  const client = await api();
  const character = await client.getCharacter((await params).slug);
  if (!character.data) notFound();
  if (character.data.mature && !(await adultContent(client)).shown) notFound();
  return (
    <>
      <CharacterDetail character={character.data} />
      {isDev ? <DataSourceBadge sources={[{ name: "getCharacter", source: character.source }]} /> : null}
    </>
  );
}
