"use client";

import type { LiveDestination, LiveDestinationInput, LiveHealth, LiveLook, LiveSession, LiveSessionInput, Offering } from "@livepeer/api-client/types";
import { Badge, Button, Card, Chip, EASE_OUT_EXPO, Field, Input, Segmented, Sheet, Switch, cn, useTheme } from "@livepeer/ui";
import { Camera, CircleDot, Monitor, Plus, Radio, Trash2, VideoOff } from "lucide-react";
import { Liveline } from "liveline";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { MockArtwork } from "../media/mock-artwork";

export interface LiveScreenProps {
  header: ReactNode;
  offerings: ReadonlyArray<Offering>;
  initialLooks: LiveLook[];
  initialDestinations: LiveDestination[];
  saveLook: (input: { name: string; prompt: string }) => Promise<LiveLook>;
  addDestination: (input: LiveDestinationInput) => Promise<LiveDestination>;
  removeDestination: (id: string) => Promise<boolean>;
  start: (input: LiveSessionInput) => Promise<LiveSession>;
  update: (id: string, prompt: string) => Promise<LiveSession | null>;
  stop: (id: string) => Promise<LiveSession | null>;
  getHealth: (id: string) => Promise<LiveHealth | null>;
}

type Source = "camera" | "screen";

const PLATFORMS: Array<{ value: LiveDestination["platform"]; label: string; url: string }> = [
  { value: "youtube", label: "YouTube", url: "rtmp://a.rtmp.youtube.com/live2" },
  { value: "twitch", label: "Twitch", url: "rtmp://live.twitch.tv/app" },
  { value: "custom", label: "Custom RTMP", url: "" },
];

function elapsed(since: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

function Monitor16x9({ label, live, children }: { label: string; live?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-caption font-medium text-muted-foreground">{label}</span>
        {live ? <Badge tone="live"><span className="size-1.5 animate-breathe rounded-full bg-brand-fill" />On air</Badge> : null}
      </div>
      <div className={cn("relative aspect-video overflow-hidden rounded-media bg-muted ring-1 ring-hairline transition-shadow duration-500", live && "ring-2 ring-brand-fill/60")}>
        {children}
      </div>
    </div>
  );
}

/**
 * A light broadcast studio: one source, one look steered by a prompt, sent to one or more
 * destinations. The camera preview is real; the restyled output is a stand-in until live
 * sessions are connected.
 */
export function LiveScreen(props: LiveScreenProps) {
  const { resolved } = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [source, setSource] = useState<Source>("camera");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [hasSource, setHasSource] = useState(false);
  const [looks, setLooks] = useState(props.initialLooks);
  const [lookId, setLookId] = useState<string | null>(props.initialLooks[0]?.id ?? null);
  const [prompt, setPrompt] = useState(props.initialLooks[0]?.prompt ?? "");
  const [destinations, setDestinations] = useState(props.initialDestinations);
  const [selected, setSelected] = useState<string[]>(props.initialDestinations.filter((entry) => entry.enabled).map((entry) => entry.id));
  const [record, setRecord] = useState(true);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<LiveHealth[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [adding, setAdding] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // The chart takes a colour value, so read the brand token rather than repeating it here.
  const [brand, setBrand] = useState("currentColor");
  useEffect(() => {
    setBrand(getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "currentColor");
  }, [resolved]);

  const app = props.offerings[0]?.app ?? "live-video-to-video";
  const live = session?.state === "live";
  const look = looks.find((entry) => entry.id === lookId) ?? null;
  const latest = health[health.length - 1] ?? null;

  const stopSource = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setHasSource(false);
  }, []);

  const startSource = useCallback(
    async (kind: Source) => {
      stopSource();
      setSourceError(null);
      try {
        const stream = kind === "camera"
          ? await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setHasSource(true);
      } catch {
        setSourceError(kind === "camera" ? "Camera access was blocked. Allow it in your browser to preview." : "Screen sharing was cancelled.");
      }
    },
    [stopSource],
  );

  useEffect(() => stopSource, [stopSource]);

  useEffect(() => {
    if (!live || !session) return;
    const timer = setInterval(async () => {
      setNow(Date.now());
      const reading = await props.getHealth(session.id);
      if (reading) setHealth((current) => [...current.slice(-119), reading]);
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getHealth is a stable server action
  }, [live, session?.id]);

  const applyPrompt = async (next: string) => {
    setPrompt(next);
    if (live && session) await props.update(session.id, next);
  };

  const goLive = async () => {
    setBusy(true);
    setError(null);
    try {
      setHealth([]);
      setSession(await props.start({ app, source, prompt, destination_ids: selected, record }));
    } catch {
      setError("The session didn't start. Nothing was charged.");
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!session) return;
    setBusy(true);
    const ended = await props.stop(session.id).catch(() => null);
    setSession(null);
    setSavedNote(ended?.recording_media_id ? "The recording is in your library." : null);
    setBusy(false);
  };

  const saveCurrentLook = async () => {
    const name = prompt.split(/[,.]/)[0]?.trim().slice(0, 28) || "Untitled look";
    const saved = await props.saveLook({ name, prompt });
    setLooks((current) => [...current, saved]);
    setLookId(saved.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {props.header}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 pb-8 md:px-6">
        <p role="status" className="rounded-field bg-muted px-3.5 py-2.5 text-caption text-muted-foreground">
          Live sessions aren't connected to the network yet. Your camera preview is real; the output, stream health and destinations are simulated so you can try the controls.
        </p>

        <div className="flex flex-col gap-4 md:flex-row">
          <Monitor16x9 label="Source">
            <video ref={videoRef} autoPlay muted playsInline className={cn("absolute inset-0 size-full object-cover", !hasSource && "hidden")} />
            {hasSource ? null : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <VideoOff className="size-6 text-subtle-foreground" aria-hidden />
                <p className="text-body text-muted-foreground">{sourceError ?? "Pick a source to preview it here."}</p>
                <div className="flex gap-2">
                  <Button onClick={() => { setSource("camera"); void startSource("camera"); }}><Camera />Camera</Button>
                  <Button onClick={() => { setSource("screen"); void startSource("screen"); }}><Monitor />Screen</Button>
                </div>
              </div>
            )}
          </Monitor16x9>
          <Monitor16x9 label="Output" live={live}>
            {look ? <MockArtwork artwork={look.artwork} still={!live} /> : null}
            <AnimatePresence mode="wait">
              <motion.p
                key={prompt}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
                className="absolute inset-x-3 bottom-3 line-clamp-2 rounded-field bg-black/45 px-3 py-2 text-caption text-white backdrop-blur-md"
              >
                {prompt || "No look applied"}
              </motion.p>
            </AnimatePresence>
            {live && session ? (
              <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[11px] text-white backdrop-blur-md">
                {elapsed(session.started_at, now)}
              </span>
            ) : null}
          </Monitor16x9>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-body font-semibold">Look</h2>
                <Segmented
                  label="Source"
                  size="sm"
                  options={[{ value: "camera", label: "Camera" }, { value: "screen", label: "Screen" }]}
                  value={source}
                  onValueChange={(next) => { setSource(next); if (hasSource) void startSource(next); }}
                />
              </div>
              {/* Room on every side, so the scroller doesn't clip the tiles' rings. */}
              <div className="scrollbar-none -mx-1 -mt-1 mb-2 flex gap-2 overflow-x-auto p-1">
                {looks.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={entry.id === lookId}
                    onClick={() => { setLookId(entry.id); void applyPrompt(entry.prompt); }}
                    className={cn(
                      "relative h-[72px] w-[128px] shrink-0 overflow-hidden rounded-media text-left ring-1 ring-hairline transition-[box-shadow,transform] duration-200 ease-out-expo active:scale-[0.97]",
                      entry.id === lookId && "ring-2 ring-foreground",
                    )}
                  >
                    <MockArtwork artwork={entry.artwork} still />
                    <span className="absolute inset-x-2 bottom-1.5 truncate text-caption font-medium text-white">{entry.name}</span>
                  </button>
                ))}
              </div>
              <label htmlFor="live-prompt" className="sr-only">Describe the look</label>
              <textarea
                id="live-prompt"
                rows={2}
                value={prompt}
                onChange={(event) => { setLookId(null); setPrompt(event.target.value); }}
                onBlur={() => live && session && void props.update(session.id, prompt)}
                placeholder="Describe the look. You can change it while you're on air."
                className="block w-full resize-none rounded-field bg-muted px-3.5 py-2.5 text-body outline-none placeholder:text-subtle-foreground"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-caption text-subtle-foreground">{live ? "Changes apply to the stream as you make them." : "Saved looks switch in one press."}</p>
                <Button size="sm" variant="ghost" disabled={prompt.trim() === "" || lookId !== null} onClick={saveCurrentLook}><Plus />Save look</Button>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-body font-semibold">Stream health</h2>
                {latest ? (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {latest.fps.toFixed(1)} fps · {latest.latency_ms} ms · {latest.dropped_frames} dropped
                  </p>
                ) : null}
              </div>
              <div className="h-[140px]">
                <Liveline
                  data={health.map((reading) => ({ time: Date.parse(reading.at) / 1000, value: reading.bitrate_kbps }))}
                  value={latest?.bitrate_kbps ?? 0}
                  theme={resolved}
                  color={brand}
                  loading={live && health.length < 2}
                  emptyText="Bitrate appears here once you're on air"
                  formatValue={(value: number) => `${Math.round(value)} kbps`}
                  momentum={false}
                  window={60}
                />
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-body font-semibold">Destinations</h2>
                <Button size="sm" variant="ghost" onClick={() => setAdding(true)} disabled={live}><Plus />Add</Button>
              </div>
              {destinations.length === 0 ? (
                <p className="py-3 text-caption text-muted-foreground">Add a stream key for YouTube, Twitch or any RTMP target. Without one, the session runs here only.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {destinations.map((destination) => (
                    <li key={destination.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium">{destination.label}</p>
                        <p className="truncate font-mono text-[11px] text-subtle-foreground">{destination.url} · key ····{destination.key_hint}</p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove ${destination.label}`}
                        disabled={live}
                        onClick={async () => {
                          if (await props.removeDestination(destination.id)) {
                            setDestinations((current) => current.filter((entry) => entry.id !== destination.id));
                            setSelected((current) => current.filter((entry) => entry !== destination.id));
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                      <Switch
                        checked={selected.includes(destination.id)}
                        disabled={live}
                        onCheckedChange={(checked) => setSelected((current) => (checked ? [...current, destination.id] : current.filter((entry) => entry !== destination.id)))}
                        aria-label={`Send to ${destination.label}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-hairline pt-3">
                <span className="flex items-center gap-2 text-body"><CircleDot className="size-4 text-muted-foreground" aria-hidden />Record to library</span>
                <Switch checked={record} onCheckedChange={setRecord} disabled={live} aria-label="Record to library" />
              </div>
            </Card>

            {error ? <p role="alert" className="text-caption text-destructive">{error}</p> : null}
            {savedNote && !live ? <p role="status" className="text-caption text-muted-foreground">{savedNote}</p> : null}
            {live ? (
              <Button size="lg" variant="destructive" className="w-full" disabled={busy} onClick={end}>
                {busy ? "Ending…" : "End stream"}
              </Button>
            ) : (
              <Button variant="primary" size="lg" className="w-full" disabled={busy || prompt.trim() === ""} onClick={goLive}>
                <Radio />
                {busy ? "Starting…" : selected.length > 0 ? `Go live to ${selected.length} ${selected.length === 1 ? "destination" : "destinations"}` : "Start session"}
              </Button>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Chip className="pointer-events-none font-mono" tabIndex={-1}>{app}</Chip>
            </div>
          </div>
        </div>
      </div>

      <AddDestination
        open={adding}
        onOpenChange={setAdding}
        add={async (input) => {
          const added = await props.addDestination(input);
          setDestinations((current) => [...current, added]);
          setSelected((current) => [...current, added.id]);
        }}
      />
    </div>
  );
}

function AddDestination({ open, onOpenChange, add }: { open: boolean; onOpenChange: (open: boolean) => void; add: (input: LiveDestinationInput) => Promise<void> }) {
  const [platform, setPlatform] = useState<LiveDestination["platform"]>("youtube");
  const [url, setUrl] = useState(PLATFORMS[0]?.url ?? "");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const preset = PLATFORMS.find((entry) => entry.value === platform);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await add({ platform, label: preset?.label ?? "Custom RTMP", url, stream_key: key });
      setKey("");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a destination" description="Your stream key is stored on the server and never shown again.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Segmented
          label="Platform"
          size="sm"
          options={PLATFORMS.map(({ value, label }) => ({ value, label }))}
          value={platform}
          onValueChange={(next) => { setPlatform(next); setUrl(PLATFORMS.find((entry) => entry.value === next)?.url ?? ""); }}
          className="w-full [&>button]:flex-1"
        />
        <Field label="Server URL">
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="rtmp://…" required className="font-mono" />
        </Field>
        <Field label="Stream key" hint="From your channel's live settings.">
          <Input type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" required className="font-mono" />
        </Field>
        <Button type="submit" variant="primary" disabled={busy || key.trim() === "" || url.trim() === ""}>{busy ? "Adding…" : "Add destination"}</Button>
      </form>
    </Sheet>
  );
}
