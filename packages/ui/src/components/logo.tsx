"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

import { cn } from "../lib/cn";

/** The instance's identity as the config sets it: its name, and paths or URLs to its marks. */
export interface Brand {
  name: string;
  /** A square mark, for small places: the collapsed sidebar, sign-in, the agent's avatar. */
  symbol?: string | undefined;
  /** The full logo, for the open sidebar and headers. */
  wordmark?: string | undefined;
  /** Draw the marks in the text colour (black in the light theme, white in the dark), for one-colour logos. */
  tint: boolean;
}

const BrandContext = createContext<Brand | null>(null);

export function BrandProvider({ brand, children }: { brand: Brand; children: ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

function useBrand(override: Brand | undefined): Brand {
  const provided = useContext(BrandContext);
  const brand = override ?? provided;
  if (!brand) throw new Error("Wrap the page in a BrandProvider, or pass `brand`.");
  return brand;
}

/**
 * An image mark. Tinted, the image only gives the shape: it sizes the box invisibly and masks a fill in
 * the current colour, so a one-colour logo follows the theme. Untinted, it shows as drawn.
 */
function Mark({ src, label, tint, className }: { src: string; label: string; tint: boolean; className?: string | undefined }) {
  if (!tint) {
    // eslint-disable-next-line @next/next/no-img-element -- a small vector mark; no optimisation to gain
    return <img src={src} alt={label} className={className} />;
  }
  const mask: CSSProperties = { maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" };
  return (
    <span role="img" aria-label={label} className="relative inline-flex shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- sizes the box to the mark's own proportions */}
      <img src={src} alt="" aria-hidden className={cn("invisible", className)} />
      <span aria-hidden className="absolute inset-0 bg-current" style={mask} />
    </span>
  );
}

/** The instance's full logo, or its name set in type when it has none. Size it with a height class. */
export function BrandWordmark({ brand, className }: { brand?: Brand; className?: string }) {
  const { name, wordmark, tint } = useBrand(brand);
  if (wordmark) return <Mark src={wordmark} label={name} tint={tint} className={className} />;
  return <span className={cn("inline-flex items-center whitespace-nowrap text-[15px] font-semibold leading-none tracking-[-0.01em]", className, "w-auto")}>{name}</span>;
}

/** The instance's square mark, or the first letter of its name when it has none. Size it with a height class. */
export function BrandSymbol({ brand, className }: { brand?: Brand; className?: string }) {
  const { name, symbol, tint } = useBrand(brand);
  if (symbol) return <Mark src={symbol} label={name} tint={tint} className={className} />;
  return (
    <svg viewBox="0 0 20 20" role="img" aria-label={name} className={cn("aspect-square w-auto", className)}>
      <text x="10" y="15.5" textAnchor="middle" fontSize="17" fontWeight="600" fill="currentColor">
        {Array.from(name.trim())[0]?.toUpperCase() ?? ""}
      </text>
    </svg>
  );
}
