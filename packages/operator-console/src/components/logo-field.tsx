"use client";

import { BrandSymbol, BrandWordmark, Button, type Brand } from "@aquareum/ui";
import { ImageUp } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";

/** Matches the server's limit; checked here too so a large file is turned away before it's sent. */
const MAX_BYTES = 100 * 1024;
const ACCEPT = "image/svg+xml,image/png,image/webp";

/** The two themes side by side, in their own colours, so the preview shows the mark in both whatever the console is set to. */
const THEMES = [
  { label: "Dark theme", className: "bg-[oklch(0.13_0_0)] text-[oklch(0.985_0_0)]" },
  { label: "Light theme", className: "bg-[oklch(0.993_0.001_286)] text-[oklch(0.235_0.006_286)]" },
];

function read(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("unreadable")));
    reader.onerror = () => reject(reader.error ?? new Error("unreadable"));
    reader.readAsDataURL(file);
  });
}

export interface LogoFieldProps {
  kind: "symbol" | "wordmark";
  label: string;
  hint: string;
  value: string;
  /** The instance's brand as it would be saved, so the preview matches the shells, fallback included. */
  brand: Brand;
  onChange: (value: string) => void;
}

/** One of the instance's marks: a preview in both themes, and an upload. */
export function LogoField({ kind, label, hint, value, brand, onChange }: LogoFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
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
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p id={id} className="text-caption font-medium text-foreground">{label}</p>
        <p className="text-caption text-subtle-foreground">{hint}</p>
      </div>
      <div className="flex items-stretch gap-2" role="group" aria-labelledby={id}>
        {THEMES.map((theme) => (
          <div key={theme.label} title={theme.label} className={`flex h-14 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-field px-3 ring-1 ring-hairline ${theme.className}`}>
            {kind === "symbol" ? <BrandSymbol brand={brand} className="h-6 w-auto" /> : <BrandWordmark brand={brand} className="h-[14px] w-auto max-w-full" />}
          </div>
        ))}
        <div className="flex shrink-0 flex-col justify-center gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
            <ImageUp />
            {value ? "Replace" : "Upload"}
          </Button>
          {value ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={choose} />
      {error ? <p role="alert" className="mt-1.5 text-caption text-destructive">{error}</p> : null}
    </div>
  );
}
