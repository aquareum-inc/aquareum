"use client";

import type { CapabilityRun, Offering } from "@livepeer/api-client/types";
import { Badge, Button, Card, EmptyState, Input, Textarea } from "@livepeer/ui";
import { ArrowLeft, Blocks, Play, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { offeringLabel } from "../lib/offering";
import { useLink } from "../shell/link";
import { CodeBlock } from "./code-block";

export interface CatalogueEntry {
  offering: Offering;
  /** Where the instance presents it: "Chat, Studio", or "Catalogue only". */
  placement: string;
  kind: string;
}

/** A readable price range. Per-second rates are shown per hour, as operators register them. */
function price(offering: Offering): string {
  const low = offering.rate_low?.price_usd;
  const high = offering.rate_high?.price_usd;
  if (!low) return "Price not reported";
  const perSecond = offering.rate_low?.unit === "seconds";
  const unit = perSecond ? "/hr" : " each";
  const format = (value: string) => {
    const amount = Number(value) * (perSecond ? 3600 : 1);
    return `$${amount < 0.01 ? amount.toPrecision(1) : amount.toFixed(2)}`;
  };
  return low === high || !high ? `${format(low)}${unit}` : `${format(low)}–${format(high)}${unit}`;
}

export function ModelsScreen({ entries }: { entries: CatalogueEntry[] }) {
  const Link = useLink();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? entries.filter((entry) => `${entry.offering.app} ${entry.kind} ${entry.placement}`.toLowerCase().includes(needle)) : entries;
  }, [entries, query]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-muted-foreground">
          <span className="font-mono text-foreground">{entries.length}</span> capabilities on the network right now, registered by compute operators.
        </p>
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
          <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search capabilities" aria-label="Search capabilities" className="rounded-full pl-10" />
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Blocks} title={entries.length === 0 ? "Nothing discovered yet" : "No capability matches"} body={entries.length === 0 ? "The engine hasn't reported any capabilities. Check the engine connection in the operator console." : "Try part of a name, like “video” or “transcode”."} />
      ) : (
        <Card className="divide-y divide-hairline">
          {shown.map(({ offering, placement, kind }) => (
            <Link key={`${offering.app}:${offering.rate_low?.unit ?? ""}`} href={`/developers/models/${offering.app}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-hover">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-body font-medium">
                  {offeringLabel(offering.app.split("/").pop() ?? offering.app)}
                  {offering.modes.includes("persistent") ? <Badge>Session</Badge> : null}
                  {offering.stale ? <Badge tone="warn">Stale</Badge> : null}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-subtle-foreground">{offering.app} · {kind} · {placement}</p>
              </div>
              <div className="text-right font-mono text-[11px] text-muted-foreground">
                <p>{price(offering)}</p>
                <p className="text-subtle-foreground">{offering.ready_count}/{offering.runner_count} runners ready</p>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}

export interface ModelScreenProps {
  entry: CatalogueEntry;
  origin: string;
  run: (app: string, request: unknown) => Promise<CapabilityRun>;
  /** Whether the instance serves its REST API. Without it there is no request to show, only the response. */
  api: boolean;
}

/**
 * A capability's page with a generic run form. Discovery doesn't describe inputs yet, so the form
 * is the request body itself; when a schema is published this becomes generated fields.
 */
export function ModelScreen({ entry, origin, run, api }: ModelScreenProps) {
  const Link = useLink();
  const { offering } = entry;
  const [body, setBody] = useState('{\n  "prompt": "A slow push along a harbour at first light"\n}');
  const [result, setResult] = useState<CapabilityRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const session = !offering.modes.includes("single-shot");

  const submit = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      setError("The request body isn't valid JSON.");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      setResult(await run(offering.app, parsed));
    } catch {
      setError("The run didn't complete. Nothing was charged.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Link href="/developers/models" className="mb-4 inline-flex h-9 items-center gap-1.5 text-body text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />All capabilities
      </Link>
      <div className="mb-6">
        <h2 className="text-lead font-semibold">{offeringLabel(offering.app.split("/").pop() ?? offering.app)}</h2>
        <p className="mt-1 font-mono text-caption text-muted-foreground">{offering.app} · {offering.modes.join(", ")} · {price(offering)} · {offering.ready_count}/{offering.runner_count} runners ready</p>
        <p className="mt-2 text-body text-muted-foreground">Presented in: {entry.placement}.</p>
      </div>
      {session ? (
        <EmptyState icon={Play} title="This capability runs as a live session" body={`It can't be run as a single request. Sessions are opened from Live mode in the studio${api ? ", or from the playground" : ""}.`} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <label htmlFor="run-body" className="text-caption font-medium">Request body</label>
            <Textarea id="run-body" rows={10} value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false} className="font-mono text-[12.5px] leading-5" />
            {error ? <p role="alert" className="text-caption text-destructive">{error}</p> : null}
            <Button variant="primary" onClick={submit} disabled={running} className="self-start"><Play />{running ? "Running…" : "Run"}</Button>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-caption font-medium">{result ? `Response · ${result.status} · ${result.elapsed_ms} ms · ${result.credits_charged} credits` : api ? "Request" : "Response"}</p>
            {result ? (
              <CodeBlock code={JSON.stringify(result.response, null, 2)} />
            ) : api ? (
              <CodeBlock code={`curl ${origin}/api/v1/run \\\n  -H "Authorization: Bearer $API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"app":"${offering.app}","request":${body.replace(/\s+/g, " ")}}'`} />
            ) : (
              <p className="text-body text-muted-foreground">Run it to see what comes back.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
