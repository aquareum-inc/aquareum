import { cn } from "@livepeer/ui";

import { AuroraSky } from "./aurora-sky";
import { LivingStill } from "./living-still";

export interface HomeBackdropProps {
  /** A looping, silent video. */
  video?: string | null;
  /** Still shown while the video loads, and in its place for reduced motion; with the aurora, its opening frame. */
  poster?: string | null;
  /** A photograph brought gently to life, used when there is no video. */
  image?: string | null;
  /** Draw a live aurora over the photograph, in place of any coloured glow in it. */
  aurora?: boolean;
}

/** Soft drifting light, when the instance has no footage or photograph of its own. */
function LightField() {
  return (
    <div className="absolute inset-0">
      {[
        "left-[-10%] top-[-20%] h-[70%] w-[60%] bg-[color-mix(in_oklch,var(--foreground)_16%,transparent)] [animation-duration:26s]",
        "right-[-15%] top-[10%] h-[65%] w-[55%] bg-[color-mix(in_oklch,var(--brand)_14%,transparent)] [animation-duration:34s] [animation-direction:alternate-reverse]",
        "bottom-[-25%] left-[20%] h-[60%] w-[60%] bg-[color-mix(in_oklch,var(--foreground)_10%,transparent)] [animation-duration:42s]",
      ].map((blob) => (
        <span key={blob} className={cn("absolute animate-drift rounded-full blur-[90px]", blob)} />
      ))}
    </div>
  );
}

/**
 * What sits behind the home screen's composer: the instance's own footage, a photograph brought to
 * life, or soft light when it has neither. A scrim keeps the headline and composer legible in both
 * themes, and it fades into the panel so the gallery below sits on a plain surface.
 */
export function HomeBackdrop({ video, poster, image, aurora = false }: HomeBackdropProps) {
  const media = Boolean(video || image);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[min(86dvh,820px)] overflow-hidden md:rounded-t-card"
      style={{ maskImage: "linear-gradient(to bottom, black 62%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 62%, transparent)" }}
    >
      {video ? (
        <>
          <video
            src={video}
            {...(poster ? { poster } : {})}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-cover motion-reduce:hidden"
          />
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- a still for visitors who prefer reduced motion
            <img src={poster} alt="" className="absolute inset-0 hidden size-full object-cover motion-reduce:block" />
          ) : null}
        </>
      ) : image && aurora ? (
        <AuroraSky src={image} poster={poster ?? null} />
      ) : image ? (
        <LivingStill src={image} />
      ) : (
        <LightField />
      )}
      <div
        className={cn(
          "absolute inset-0",
          // The drawn aurora paints its own pale sky in the light theme, so it needs only a light veil.
          image && aurora && !video
            ? "bg-[color-mix(in_oklch,var(--panel)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--panel)_22%,transparent)]"
            : media
            ? "bg-[color-mix(in_oklch,var(--panel)_66%,transparent)] dark:bg-[color-mix(in_oklch,var(--panel)_22%,transparent)]"
            : "bg-[color-mix(in_oklch,var(--panel)_30%,transparent)]",
        )}
      />
    </div>
  );
}
