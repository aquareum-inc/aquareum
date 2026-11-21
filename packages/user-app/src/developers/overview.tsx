"use client";

import { Button, Card } from "@livepeer/ui";
import { KeyRound } from "lucide-react";

import { useLink } from "../shell/link";
import { CodeBlock } from "./code-block";
import type { DeveloperSurfaces } from "./developers-layout";

/** How to start: a key, then the API calls and the MCP setup, each shown only while the instance serves it. */
export function DevelopersOverview({ origin, instanceName, surfaces }: { origin: string; instanceName: string; surfaces: DeveloperSurfaces }) {
  const Link = useLink();
  const slug = instanceName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="flex flex-col gap-8">
      <Card className="p-5">
        <ol className="flex flex-col gap-6">
          <li>
            <h2 className="text-body font-semibold">1. Create a key</h2>
            <p className="mt-1 text-body text-muted-foreground">A key acts as you: it spends your credits and sees your library.</p>
            <Button asChild className="mt-3"><Link href="/developers/keys"><KeyRound />Manage keys</Link></Button>
          </li>
          {surfaces.api ? (
            <>
              <li>
                <h2 className="text-body font-semibold">2. See what the network offers</h2>
                <p className="mt-1 text-body text-muted-foreground">Capabilities are discovered, not fixed. List them before you run one.</p>
                <CodeBlock className="mt-3" label="List capabilities" code={`curl ${origin}/api/v1/offerings \\\n  -H "Authorization: Bearer $API_KEY"`} />
              </li>
              <li>
                <h2 className="text-body font-semibold">3. Generate a video</h2>
                <CodeBlock
                  className="mt-3"
                  label="Create a generation"
                  code={`curl ${origin}/api/v1/generations \\\n  -H "Authorization: Bearer $API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"kind":"video","app":"text-to-video","prompt":"A slow push along a harbour at first light","aspect":"16:9","duration_seconds":5,"resolution":"720p"}'`}
                />
              </li>
            </>
          ) : (
            <li>
              <h2 className="text-body font-semibold">2. Connect your agent</h2>
              <p className="mt-1 text-body text-muted-foreground">This instance is reached through its MCP server. Add it to your agent with the key, below.</p>
            </li>
          )}
        </ol>
      </Card>

      {surfaces.mcp ? (
        <section>
          <h2 className="text-body font-semibold">Connect an agent over MCP</h2>
          <p className="mb-3 mt-1 max-w-[64ch] text-body text-muted-foreground">
            The MCP server exposes the same functions as tools: generate, check a job, search the library, ask about a video. Point any MCP client at it with your key.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            <CodeBlock label="Claude Code" code={`claude mcp add --transport http ${slug} ${origin}/api/mcp \\\n  --header "Authorization: Bearer $API_KEY"`} />
            <CodeBlock label="Any MCP client (JSON)" code={JSON.stringify({ mcpServers: { [slug]: { type: "http", url: `${origin}/api/mcp`, headers: { Authorization: "Bearer YOUR_API_KEY" } } } }, null, 2)} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
