"use client";

import { cn } from "@livepeer/ui";
import { X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface MediaSlotProps {
  label: string;
  icon: LucideIcon;
  accept: string;
  compact?: boolean;
}

/** A drop target for one input. Shows what was chosen in place of the prompt to choose. */
export function MediaSlot({ label, icon: Icon, accept, compact = false }: MediaSlotProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; isImage: boolean } | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const choose = (file: File | undefined) => {
    if (!file) return;
    setPreview({ url: URL.createObjectURL(file), name: file.name, isImage: file.type.startsWith("image/") });
  };

  return (
    <div
      className={cn(
        "group relative flex-1 overflow-hidden rounded-media border border-dashed border-input bg-muted transition-[border-color,background-color] duration-200 hover:border-ring hover:bg-hover",
        compact ? "h-[72px]" : "h-[104px]",
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        choose(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => choose(event.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={preview ? `${label}: ${preview.name}. Press to replace.` : `Add ${label.toLowerCase()}`}
        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground transition-colors group-hover:text-foreground"
      >
        {preview?.isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL preview
          <img src={preview.url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
            <span className="max-w-full truncate px-2 text-caption font-medium">{preview?.name ?? label}</span>
          </>
        )}
      </button>
      {preview ? (
        <button
          type="button"
          onClick={() => setPreview(null)}
          aria-label={`Remove ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-transform active:scale-[0.92]"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
