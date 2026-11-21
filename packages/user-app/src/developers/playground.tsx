"use client";

import type { LiveSession, VideoAnalysis } from "@livepeer/api-client/types";
import { Button, Card, Field, Input, Segmented } from "@livepeer/ui";
import { Play, Square } from "lucide-react";
import { useState } from "react";

import { CodeBlock } from "./code-block";

export interface PlaygroundProps {
  origin: string;
  analyse: (input: { source: string; question: string }) => Promise<VideoAnalysis>;
  startSession: (prompt: string) => Promise<LiveSession>;
  stopSession: (id: string) => Promise<LiveSession | null>;
}

type Mode = "understand" | "realtime";
type Language = "curl" | "typescript" | "python";

const LANGUAGES = [
  { value: "curl", label: "cURL" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
] as const;

function code(language: Language, origin: string, path: string, body: unknown): string {
  const json = JSON.stringify(body, null, 2);
  if (language === "curl") {
    return `curl ${origin}${path} \\\n  -H "Authorization: Bearer $API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`;
  }
  if (language === "typescript") {
    return `const response = await fetch("${origin}${path}", {\n  method: "POST",\n  headers: {\n    Authorization: \`Bearer \${process.env.API_KEY}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(${json.replace(/\n/g, "\n  ")}),\n});\nconst result = await response.json();`;
  }
  return `import os, requests\n\nresponse = requests.post(\n    "${origin}${path}",\n    headers={"Authorization": f"Bearer {os.environ['API_KEY']}"},\n    json=${json.replace(/\n/g, "\n    ")},\n)\nresult = response.json()`;
}

/** Try video understanding and real-time sessions, see the exact request and response, copy working code. */
export function Playground({ origin, analyse, startSession, stopSession }: PlaygroundProps) {
  const [mode, setMode] = useState<Mode>("understand");
  const [language, setLanguage] = useState<Language>("curl");
  const [source, setSource] = useState("https://example.com/harbour.mp4");
  const [question, setQuestion] = useState("Summarise this video and list the key moments with timestamps.");
  const [prompt, setPrompt] = useState("Hand-painted gouache, warm palette, visible brushwork");
  const [response, setResponse] = useState<unknown>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const understand = mode === "understand";
  const path = understand ? "/api/v1/understand" : "/api/v1/sessions";
  const body = understand ? { app: "video-understanding", source, question } : { app: "live-video-to-video", input: { prompt }, record: false };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (understand) setResponse(await analyse({ source, question }));
      else if (session) {
        setResponse(await stopSession(session.id));
        setSession(null);
      } else {
        const started = await startSession(prompt);
        setSession(started);
        setResponse(started);
      }
    } catch {
      setError("The request didn't complete. Nothing was charged.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-4 p-5">
        <Segmented
          label="Playground mode"
          size="sm"
          options={[{ value: "understand", label: "Understand a video" }, { value: "realtime", label: "Real-time session" }]}
          value={mode}
          onValueChange={(next) => { setMode(next); setResponse(null); setError(null); }}
          className="self-start"
        />
        {understand ? (
          <>
            <Field label="Video" hint="A URL, or the id of something in your library.">
              <Input value={source} onChange={(event) => setSource(event.target.value)} className="font-mono" />
            </Field>
            <Field label="Question">
              <Input value={question} onChange={(event) => setQuestion(event.target.value)} />
            </Field>
          </>
        ) : (
          <Field label="Prompt" hint="A session stays open and is billed by the second until you close it.">
            <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={session !== null} />
          </Field>
        )}
        {error ? <p role="alert" className="text-caption text-destructive">{error}</p> : null}
        <Button variant="primary" className="self-start" disabled={busy} onClick={run}>
          {session && !understand ? <Square /> : <Play />}
          {busy ? "Working…" : understand ? "Run analysis" : session ? "Close session" : "Open session"}
        </Button>
        <p className="text-caption text-subtle-foreground">
          Responses here are simulated: the engine doesn't serve sessions or video understanding yet. The request shape is the one the API will accept.
        </p>
      </Card>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-caption font-medium">Request</p>
          <Segmented label="Code language" size="sm" options={LANGUAGES} value={language} onValueChange={setLanguage} />
        </div>
        <CodeBlock code={code(language, origin, path, body)} />
        <p className="text-caption font-medium">Response</p>
        <CodeBlock code={response ? JSON.stringify(response, null, 2) : "// Run it to see the response"} />
      </div>
    </div>
  );
}
