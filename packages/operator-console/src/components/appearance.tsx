"use client";

import { BrandSymbol, BrandWordmark, Button, Input, cn, type Brand } from "@aquareum/ui";
import { ImageUp, X } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

/** Matches the server's limit; checked here too so a large file is turned away before it's sent. */
const MAX_BYTES = 100 * 1024;
const ACCEPT = "image/svg+xml,image/png,image/webp";
const KIND: Record<string, string> = { "image/svg+xml": "SVG", "image/png": "PNG", "image/webp": "WebP" };

/**
 * The two themes' own colours, from tokens.css, so the preview shows both whatever the console is set
 * to. `primary` is the default the instance's primary colour replaces.
 */
const THEMES = [
  { key: "dark", label: "Dark", surface: "oklch(0.17 0 0)", ink: "oklch(0.985 0 0)", primary: "oklch(0.922 0 0)", onPrimary: "oklch(0.205 0 0)" },
  { key: "light", label: "Light", surface: "oklch(0.993 0.001 286)", ink: "oklch(0.235 0.006 286)", primary: "oklch(0.205 0.006 286)", onPrimary: "oklch(0.985 0 0)" },
] as const;

/** One look at the whole brand, as the sidebar draws it, in both themes. */
export function BrandPreview({ brand, primary }: { brand: Brand; primary: { dark: string; light: string } }) {
  return (
    <div className="grid grid-cols-2 self-start overflow-hidden rounded-card ring-1 ring-hairline">
      {THEMES.map((theme) => (
        <div key={theme.key} className="flex min-w-0 flex-col gap-5 p-4" style={{ background: theme.surface, color: theme.ink }}>
          <div className="flex min-w-0 items-center gap-3">
            <BrandSymbol brand={brand} className="h-[20px] w-auto shrink-0" />
            <BrandWordmark brand={brand} className="h-[14px] w-auto min-w-0 max-w-full" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex h-7 items-center rounded-full px-3 text-[12px] font-medium"
              style={{ background: primary[theme.key] || theme.primary, color: theme.onPrimary }}
            >
              Generate
            </span>
            <span className="text-[11px] opacity-55">{theme.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function read(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("unreadable")));
    reader.onerror = () => reject(reader.error ?? new Error("unreadable"));
    reader.readAsDataURL(file);
  });
}

/** "SVG · 2.1 KB" for an upload, the file name for a path or URL. */
function describe(value: string): string {
  const upload = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(value);
  if (!upload) return value.split("/").pop() || value;
  const payload = upload[3] ?? "";
  const bytes = upload[2] ? Math.floor((payload.length * 3) / 4) - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0) : decodeURIComponent(payload).length;
  return `${KIND[upload[1] ?? ""] ?? "Image"} · ${(bytes / 1024).toFixed(1)} KB`;
}

export interface MarkRowProps {
  kind: "symbol" | "wordmark";
  label: string;
  /** What shows in its place when there's none. */
  fallback: string;
  value: string;
  brand: Brand;
  onChange: (value: string) => void;
}

/** One of the instance's marks: a thumbnail, what it is, and an upload. */
export function MarkRow({ kind, label, fallback, value, brand, onChange }: MarkRowProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) return setError("Logos can be SVG, PNG or WebP.");
    if (file.size > MAX_BYTES) return setError("Logos can be up to 100 KB.");
    setError(null);
    onChange(await read(file).catch(() => ""));
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* A checkerboard behind the mark, so a transparent image reads as one. */}
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-field bg-[repeating-conic-gradient(var(--hover)_0%_25%,transparent_0%_50%)] bg-[length:10px_10px] ring-1 ring-hairline">
        {kind === "symbol" ? <BrandSymbol brand={brand} className="h-5 w-auto" /> : <BrandWordmark brand={brand} className="h-2 w-auto max-w-[32px]" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{label}</p>
        <p className={cn("truncate text-[12px]", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
          {error ?? (value ? describe(value) : `Not set: ${fallback}`)}
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
        <ImageUp />
        {value ? "Replace" : "Upload"}
      </Button>
      {value ? (
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => onChange("")}>
          <X />
        </Button>
      ) : null}
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={choose} />
    </div>
  );
}

/** A colour field with a chip of the colour it holds. */
export function ColourInput({ value, placeholder, label, onChange }: { value: string; placeholder: string; label: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 rounded-full ring-1 ring-hairline" style={{ background: value || placeholder }} />
      <Input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-9 font-mono" />
    </div>
  );
}
