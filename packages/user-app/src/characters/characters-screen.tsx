"use client";

import type { Character } from "@aquareum/api-client/types";
import { Button, EmptyState, Input, Page } from "@aquareum/ui";
import { Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { useLink } from "../shell/link";
import { CharacterCard } from "./character-card";

export interface CharactersScreenProps {
  mine: Character[];
  publicCharacters: Character[];
}

export function CharactersScreen({ mine, publicCharacters }: CharactersScreenProps) {
  const Link = useLink();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return publicCharacters;
    return publicCharacters.filter((entry) => [entry.name, entry.tagline, ...entry.tags].some((text) => text.toLowerCase().includes(needle)));
  }, [publicCharacters, query]);

  return (
    <Page
      title="Characters"
      description="A cast for your scenes, films and live streams. Each one looks like themselves in every shot, and you can talk to them too."
      actions={
        <Button asChild variant="primary">
          <Link href="/characters/new"><Plus />New character</Link>
        </Button>
      }
    >
      <section className="mb-10">
        <h2 className="mb-3 text-body font-semibold text-foreground">Yours</h2>
        {mine.length === 0 ? (
          <EmptyState icon={Users} title="No characters of your own yet" body="Describe who they are and how they look, move and speak, then cast them in any scene. They stay private until you share them." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mine.map((character) => (
              <li key={character.slug}><CharacterCard character={character} /></li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-body font-semibold text-foreground">Shared by others</h2>
          <div className="relative w-full sm:w-[280px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
            <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search characters" aria-label="Search characters" className="rounded-full pl-10" />
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={Search} title="No one by that description" body="Try a role or a subject, like “editor” or “lighting”." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shown.map((character) => (
              <li key={character.slug}><CharacterCard character={character} /></li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
