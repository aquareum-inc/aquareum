"use client";

import type { ExampleApp } from "@aquareum/api-client/types";
import { Badge, Card, cn } from "@aquareum/ui";
import { useState } from "react";

import { MockArtwork } from "../media/mock-artwork";
import { CodeBlock } from "./code-block";

/** A few small apps built on the real-time API, each with the code to start from. */
export function ExamplesScreen({ examples }: { examples: ExampleApp[] }) {
  const [selected, setSelected] = useState(examples[0]?.id ?? null);
  const example = examples.find((entry) => entry.id === selected) ?? null;
  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-field bg-muted px-3.5 py-2.5 text-caption text-muted-foreground">
        Real-time sessions aren't served by the engine yet, so these show the client code the session API is being built for. The REST calls that exist today are in the playground.
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {examples.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              aria-pressed={entry.id === selected}
              onClick={() => setSelected(entry.id)}
              className={cn(
                "block w-full overflow-hidden rounded-card border bg-card text-left transition-[border-color,transform] duration-200 ease-out-expo active:scale-[0.99]",
                entry.id === selected ? "border-foreground" : "border-hairline hover:border-input",
              )}
            >
              <span className="relative block aspect-[16/7]"><MockArtwork artwork={entry.artwork} still /></span>
              <span className="block p-4">
                <span className="block text-body font-semibold">{entry.name}</span>
                <span className="mt-1 block text-caption text-muted-foreground">{entry.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {example ? (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-body font-semibold">{example.name}: starter code</h2>
            <Badge className="font-mono">{example.app}</Badge>
            <Badge>{example.language}</Badge>
          </div>
          <CodeBlock code={example.code} />
        </Card>
      ) : null}
    </div>
  );
}
