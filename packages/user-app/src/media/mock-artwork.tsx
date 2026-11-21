import type { MockArtwork as Artwork } from "@livepeer/api-client/types";
import { cn } from "@livepeer/ui";

export interface MockArtworkProps {
  artwork: Artwork;
  className?: string;
  /** Still artwork for reduced motion or dense grids. */
  still?: boolean;
}

/**
 * Stand-in for a generated frame while media is mocked: three soft light sources that drift
 * slowly, so a tile reads as footage. Colours here are content, not interface tokens.
 */
export function MockArtwork({ artwork, className, still = false }: MockArtworkProps) {
  const [a, b, c] = artwork.hues;
  const x = 20 + (artwork.seed % 5) * 12;
  const y = 25 + (artwork.seed % 3) * 18;
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{ backgroundColor: `hsl(${c} 30% 9%)` }}
    >
      <div
        className={cn("absolute -inset-[20%]", !still && "animate-drift")}
        style={{
          backgroundImage: [
            `radial-gradient(42% 46% at ${x}% ${y}%, hsl(${a} 78% 62% / 0.95), transparent 70%)`,
            `radial-gradient(38% 42% at ${100 - x}% ${y + 30}%, hsl(${b} 82% 58% / 0.85), transparent 72%)`,
            `radial-gradient(60% 55% at 50% 110%, hsl(${c} 70% 40% / 0.9), transparent 70%)`,
          ].join(","),
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, transparent 55%, rgb(0 0 0 / 0.45)), radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(0 0 0 / 0.35))",
        }}
      />
    </div>
  );
}
