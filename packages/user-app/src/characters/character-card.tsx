"use client";

import type { Character } from "@aquareum/api-client/types";
import { Badge } from "@aquareum/ui";
import { Star } from "lucide-react";

import { CharacterPortrait } from "./character-portrait";
import { useLink } from "../shell/link";

export function CharacterCard({ character }: { character: Character }) {
  const Link = useLink();
  return (
    <Link
      href={`/characters/${character.slug}`}
      className="group flex gap-3.5 rounded-card border border-hairline bg-card p-3 transition-[background-color,transform] duration-200 ease-out-expo hover:bg-hover active:scale-[0.99]"
    >
      <span className="relative size-[72px] shrink-0 overflow-hidden rounded-media ring-1 ring-hairline">
        <CharacterPortrait character={character} still initialClassName="text-title" />
      </span>
      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-body font-semibold text-foreground">{character.name}</span>
          {character.mature ? <Badge tone="warn">18+</Badge> : null}
          {character.visibility === "private" ? <Badge>Private</Badge> : null}
        </span>
        <span className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">{character.tagline}</span>
        {character.chats > 0 ? (
          <span className="mt-1.5 flex items-center gap-2.5 font-mono text-[11px] text-subtle-foreground">
            <span className="inline-flex items-center gap-1"><Star className="size-3" aria-hidden />{character.rating.toFixed(1)}</span>
            <span>{new Intl.NumberFormat("en", { notation: "compact" }).format(character.chats)} chats</span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}
