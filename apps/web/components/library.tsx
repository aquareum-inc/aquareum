"use client";

import type { MediaItem, Offering } from "@livepeer/api-client";
import { LibraryScreen } from "@livepeer/user-app";
import { useRouter } from "next/navigation";

import { createConversationAction, deleteMediaAction, searchMediaAction } from "@/lib/actions";

export function Library({ items, actions }: { items: MediaItem[]; actions: Offering[] }) {
  const router = useRouter();
  return (
    <LibraryScreen
      initialItems={items}
      mediaActions={actions}
      search={searchMediaAction}
      remove={deleteMediaAction}
      onOpenInStudio={(item) => router.push(`/studio/${item.kind}?prompt=${encodeURIComponent(item.prompt ?? item.description)}`)}
      onUseInChat={async (item) => {
        const conversation = await createConversationAction({
          text: `Summarise “${item.title}” from my library and list the key moments with timestamps.`,
          app: null,
          aspect: item.aspect,
          duration_seconds: item.duration_seconds ?? 5,
        });
        router.push(`/chat/${conversation.id}`);
      }}
      onRunAction={(_item, app) => router.push(`/developers/models/${app}`)}
    />
  );
}
