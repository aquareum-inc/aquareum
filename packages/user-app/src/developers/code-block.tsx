"use client";

import { cn } from "@aquareum/ui";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlock({ code, label, className }: { code: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={cn("relative overflow-hidden rounded-media border border-hairline bg-muted", className)}>
      {label ? <p className="border-b border-hairline px-4 py-2 font-mono text-[11px] text-subtle-foreground">{label}</p> : null}
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12.5px] leading-5 text-foreground"><code>{code}</code></pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy"}
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-[background-color,color,transform] duration-200 hover:bg-hover hover:text-foreground active:scale-[0.92]"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
