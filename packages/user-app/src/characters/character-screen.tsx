"use client";

import type { Character } from "@livepeer/api-client/types";
import { Badge, Button, Textarea } from "@livepeer/ui";
import { ArrowLeft, Clapperboard, Phone, Star, Video } from "lucide-react";
import { useState } from "react";

import { CharacterModeration, type CharacterModerationProps } from "./character-moderation";
import { CharacterPortrait } from "./character-portrait";
import { useLink } from "../shell/link";

export interface CharacterScreenProps {
  character: Character;
  onStartChat: (message: string) => void | Promise<void>;
  /** Present when the instance can place calls. */
  callHref?: string;
  /** Opens the composer with this character cast. */
  videoHref?: string;
  /** Report and Block, offered on someone else's character. */
  moderation?: Omit<CharacterModerationProps, "character">;
}

export function CharacterScreen({ character, onStartChat, callHref, videoHref, moderation }: CharacterScreenProps) {
  const Link = useLink();
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      await onStartChat(message.trim() || "Hello");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-16 pt-6 md:px-8">
      <Link href="/characters" className="mb-5 inline-flex h-9 items-center gap-1.5 rounded-full pr-3 text-body text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />Characters
      </Link>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-card ring-1 ring-hairline md:w-[280px]">
          <CharacterPortrait character={character} eager initialClassName="text-[96px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-title font-semibold tracking-[-0.01em]">{character.name}</h1>
            {character.mature ? <Badge tone="warn">18+</Badge> : null}
            {moderation && !character.mine ? <span className="ml-auto"><CharacterModeration character={character} {...moderation} /></span> : null}
          </div>
          <p className="mt-1 text-lead text-muted-foreground">{character.tagline}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-subtle-foreground">
            <span>by {character.author}</span>
            {character.chats > 0 ? <span className="inline-flex items-center gap-1"><Star className="size-3" aria-hidden />{character.rating.toFixed(1)}</span> : null}
          </p>
          <p className="mt-4 max-w-[60ch] text-body text-foreground">{character.description}</p>

          {/* Casting comes first: characters are for putting on screen; talking to them is the second use. */}
          {videoHref ? (
            <div className="mt-6">
              <Button variant="primary" asChild className="w-full sm:w-auto">
                <Link href={videoHref}>
                  <Clapperboard />
                  Cast {character.name} in a scene
                </Link>
              </Button>
              <p className="mt-2 text-caption text-muted-foreground">
                {character.image ? "Their portrait is the first frame, so they look like themselves in every shot." : "Describe a scene and they'll play it, in character."}
              </p>
            </div>
          ) : null}

          <h2 className="mt-8 text-body font-semibold text-foreground">Talk to {character.name}</h2>
          <div className="mt-3 rounded-card border border-hairline bg-card p-4">
            <p className="text-body italic text-muted-foreground">“{character.greeting}”</p>
            <Textarea
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={`Say something to ${character.name}…`}
              aria-label={`Message to ${character.name}`}
              className="mt-3"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={videoHref ? "secondary" : "primary"} className="flex-1" disabled={starting} onClick={start}>
                {starting ? "Starting…" : "Start chatting"}
              </Button>
              {character.calls && callHref ? (
                <>
                  <Button asChild><Link href={`${callHref}?mode=voice`} aria-label={`Voice call with ${character.name}`}><Phone />Voice</Link></Button>
                  <Button asChild><Link href={`${callHref}?mode=video`} aria-label={`Video call with ${character.name}`}><Video />Video</Link></Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
