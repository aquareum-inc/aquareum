import type { MockArtwork as Artwork } from "@livepeer/api-client/types";
import { cn } from "@livepeer/ui";

import { MockArtwork } from "./mock-artwork";

export interface MediaStillProps {
  /** A still of the media, when there is one. */
  image: string | null;
  /** Shown in place of the still when there is none. */
  artwork: Artwork;
  /** Hold the stand-in artwork still, for dense grids. */
  still?: boolean;
  /** Load straight away, for a still that is on screen when it opens. */
  eager?: boolean;
  className?: string;
}

/**
 * What a media tile shows: its still, or the stand-in artwork when it has none. The still is a plain
 * image painted over a quiet surface as soon as it arrives, with no script in the way, so a refresh
 * never flashes the stand-in first. The tile reserves its size, so nothing shifts.
 */
export function MediaStill({ image, artwork, still = false, eager = false, className }: MediaStillProps) {
  if (!image) return <MockArtwork artwork={artwork} still={still} {...(className ? { className } : {})} />;
  return (
    <div aria-hidden className={cn("absolute inset-0 overflow-hidden bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a plain image; the tile already reserves its size */}
      <img
        src={image}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-[1.03]"
      />
      {/* A soft shade at the foot, so a title laid over the still stays legible. */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-55% to-black/45" />
    </div>
  );
}
