import type { Character } from "@livepeer/api-client/types";
import { cn } from "@livepeer/ui";

import { MockArtwork } from "../media/mock-artwork";

export interface CharacterPortraitProps {
  character: Pick<Character, "name" | "image" | "artwork">;
  /** Hold the stand-in artwork still, for lists. */
  still?: boolean;
  /** Load straight away, for a portrait that is on screen when the page opens. */
  eager?: boolean;
  /** Sizes the initial shown when there is no portrait. */
  initialClassName?: string;
}

/**
 * A character's face: its portrait, or the stand-in artwork with the name's initial when it has none
 * (a character someone has just made). Fills its frame, which reserves the size, so nothing shifts.
 */
export function CharacterPortrait({ character, still = false, eager = false, initialClassName }: CharacterPortraitProps) {
  if (character.image) {
    return (
      <span aria-hidden className="absolute inset-0 bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- a plain image; the frame already reserves its size */}
        <img src={character.image} alt="" loading={eager ? "eager" : "lazy"} decoding="async" className="size-full object-cover" />
      </span>
    );
  }
  return (
    <>
      <MockArtwork artwork={character.artwork} still={still} />
      <span aria-hidden className={cn("absolute inset-0 flex items-center justify-center font-semibold text-white/90", initialClassName)}>
        {character.name.charAt(0)}
      </span>
    </>
  );
}
