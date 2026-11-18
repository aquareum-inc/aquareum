"use client";

import type { Character, CharacterInput } from "@aquareum/api-client";
import { CallScreen, CharacterForm, CharacterScreen } from "@aquareum/user-app";
import { useRouter } from "next/navigation";

import { createCharacterAction, createConversationAction, endCallAction, startCallAction } from "@/lib/actions";

export function CharacterDetail({ character }: { character: Character }) {
  const router = useRouter();
  return (
    <CharacterScreen
      character={character}
      callHref={`/characters/${character.slug}/call`}
      videoHref={`/?with=${encodeURIComponent(character.slug)}`}
      onStartChat={async (message) => {
        const conversation = await createConversationAction({ text: message, app: null, aspect: "16:9", duration_seconds: 5 });
        router.push(`/chat/${conversation.id}`);
      }}
    />
  );
}

export function NewCharacter({ matureAllowed }: { matureAllowed: boolean }) {
  const router = useRouter();
  return (
    <CharacterForm
      matureAllowed={matureAllowed}
      onCreate={async (input: CharacterInput) => {
        const character = await createCharacterAction(input);
        router.push(`/characters/${character.slug}`);
      }}
    />
  );
}

export function CharacterCallView({ character, mode }: { character: Character; mode: "voice" | "video" }) {
  const router = useRouter();
  return <CallScreen character={character} mode={mode} start={startCallAction} end={endCallAction} onLeave={() => router.push(`/characters/${character.slug}`)} />;
}
