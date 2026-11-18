import type { CSSProperties } from "react";

import { cn } from "../lib/cn";

/*
 * The star field around the badge, as offsets from its centre (% of the badge box). `dx`/`dy` is how far
 * each star drifts while it twinkles, and `d` staggers them so the field shimmers rather than blinking at once.
 * Adapted from Livepeer Explorer's ExplorerBadge (MIT, Livepeer Inc).
 */
const STARS: Array<{ x: number; y: number; s: number; d: number; dx: number; dy: number; spark?: boolean }> = [
  { x: -8, y: 12, s: 2, d: 0, dx: -4, dy: -2 },
  { x: 6, y: -38, s: 1.5, d: 0.35, dx: -2, dy: -4 },
  { x: 24, y: 118, s: 1.5, d: 0.9, dx: -1, dy: 4 },
  { x: 38, y: -30, s: 5, d: 0.15, dx: 0, dy: -3, spark: true },
  { x: 55, y: 132, s: 2, d: 0.6, dx: 1, dy: 4 },
  { x: 70, y: -44, s: 1.5, d: 1.1, dx: 2, dy: -3 },
  { x: 88, y: 120, s: 4, d: 0.45, dx: 2, dy: 3, spark: true },
  { x: 104, y: -14, s: 2, d: 0.8, dx: 4, dy: -2 },
  { x: 112, y: 70, s: 1.5, d: 0.25, dx: 5, dy: 1 },
  { x: -14, y: 84, s: 3.5, d: 1.25, dx: -4, dy: 2, spark: true },
  { x: 16, y: -18, s: 1, d: 0.55, dx: -1, dy: -3 },
  { x: 82, y: -26, s: 1, d: 1.4, dx: 1, dy: -3 },
];

function Sparkle({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 10 10" width={size * 2} height={size * 2}>
      <path d="M5 0C5.4 3.2 6.8 4.6 10 5 6.8 5.4 5.4 6.8 5 10 4.6 6.8 3.2 5.4 0 5 3.2 4.6 4.6 3.2 5 0Z" fill="currentColor" />
    </svg>
  );
}

/**
 * The product's name beside the Livepeer wordmark ("Operator"): a glowing pill that comes alive, with light
 * running round its edge and a field of stars, while the link it sits in is hovered or focused. Brand
 * expression, not a control: it lives inside the wordmark's link. Styles are in tokens.css under `.brand-badge`.
 */
export function BrandBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("brand-badge", className)}>
      <span className="brand-badge-stars" aria-hidden="true">
        {STARS.map((star, index) => (
          <span
            key={index}
            className={cn("brand-badge-star", star.spark && "brand-badge-spark")}
            style={
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.spark ? undefined : star.s,
                height: star.spark ? undefined : star.s,
                "--d": `${star.d}s`,
                "--dx": `${star.dx}px`,
                "--dy": `${star.dy}px`,
              } as CSSProperties
            }
          >
            {star.spark ? <Sparkle size={star.s} /> : null}
          </span>
        ))}
      </span>
      <span className="brand-badge-text">{label}</span>
    </span>
  );
}
