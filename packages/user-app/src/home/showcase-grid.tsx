"use client";

import type { ShowcaseItem } from "@aquareum/api-client/types";
import { cn } from "@aquareum/ui";
import { AudioLines, Image as ImageIcon, Play, Radio } from "lucide-react";

import { MediaStill } from "../media/media-still";

export interface ShowcaseGridProps {
  items: ReadonlyArray<ShowcaseItem>;
  onUse: (item: ShowcaseItem) => void;
}

const ASPECT_CLASS: Record<ShowcaseItem["aspect"], string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
};

function kindMeta(item: ShowcaseItem) {
  if (item.app.startsWith("live")) return { icon: Radio, label: "Live" };
  if (item.kind === "image") return { icon: ImageIcon, label: "Image" };
  if (item.kind === "audio") return { icon: AudioLines, label: "Audio" };
  return { icon: Play, label: item.duration_seconds ? `${item.duration_seconds}s` : "Video" };
}

/** Examples, mostly video. A tile hands its prompt to the composer; it never sends. */
export function ShowcaseGrid({ items, onUse }: ShowcaseGridProps) {
  return (
    <ul className="columns-2 gap-3 md:columns-3 lg:columns-4 [&>li]:mb-3">
      {items.map((item) => {
        const meta = kindMeta(item);
        return (
          <li key={item.id} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => onUse(item)}
              aria-label={`Use the prompt for “${item.title}”`}
              className={cn(
                "group relative block w-full overflow-hidden rounded-media text-left ring-1 ring-hairline transition-transform duration-300 ease-out-expo active:scale-[0.985]",
                ASPECT_CLASS[item.aspect],
              )}
            >
              <MediaStill image={item.image} artwork={item.artwork} />
              <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              <span className="absolute left-2.5 top-2.5 inline-flex h-6 items-center gap-1 rounded-full bg-black/45 px-2 font-mono text-[11px] text-white backdrop-blur-md">
                <meta.icon className="size-3" aria-hidden />
                {meta.label}
              </span>
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3 text-white">
                <span className="text-body font-medium leading-5">{item.title}</span>
                <span className="line-clamp-2 max-h-0 text-caption text-white/75 opacity-0 transition-[max-height,opacity] duration-300 ease-out-expo group-hover:max-h-10 group-hover:opacity-100 group-focus-visible:max-h-10 group-focus-visible:opacity-100">
                  {item.prompt}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
