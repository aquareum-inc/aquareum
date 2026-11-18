"use client";

import type { Character, CharacterCall } from "@aquareum/api-client/types";
import { Button, EASE_OUT_EXPO, cn } from "@aquareum/ui";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { MockArtwork } from "../media/mock-artwork";
import { CharacterPortrait } from "./character-portrait";

export interface CallScreenProps {
  character: Character;
  mode: CharacterCall["mode"];
  start: (slug: string, mode: CharacterCall["mode"]) => Promise<CharacterCall>;
  end: (id: string) => Promise<CharacterCall | null>;
  onLeave: () => void;
}

function clock(since: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * A call reduced to the person, their voice and three controls. Presence is shown, not stated:
 * the ring fills as the character joins and the waveform moves while they speak.
 */
export function CallScreen({ character, mode, start, end, onLeave }: CallScreenProps) {
  const [call, setCall] = useState<CharacterCall | null>(null);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(mode === "video");
  const [now, setNow] = useState(() => Date.now());
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start(character.slug, mode).then(setCall, () => setFailed(true));
  }, [character.slug, mode, start]);

  useEffect(() => {
    if (!call) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [call]);

  const hangUp = async () => {
    if (call) await end(call.id).catch(() => null);
    onLeave();
  };

  const connected = call?.state === "connected";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-10">
      {mode === "video" && connected ? (
        character.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- the portrait, softened behind the call
          <img src={character.image} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl" />
        ) : (
          <MockArtwork artwork={character.artwork} className="opacity-60" />
        )
      ) : null}
      <div className="relative flex flex-col items-center text-center">
        <div className="relative">
          <span className="relative block size-40 overflow-hidden rounded-full ring-1 ring-hairline">
            <CharacterPortrait character={character} still={!connected} eager initialClassName="text-[64px]" />
          </span>
          <svg aria-hidden viewBox="0 0 100 100" className="absolute -inset-2 -rotate-90">
            <motion.circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="var(--brand-fill)"
              strokeWidth="1.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: connected ? 1 : 0.12 }}
              transition={{ duration: connected ? 0.9 : 0.4, ease: EASE_OUT_EXPO }}
            />
          </svg>
        </div>
        <h1 className="mt-6 text-title font-semibold tracking-[-0.01em]">{character.name}</h1>
        <p className="mt-1 font-mono text-caption text-muted-foreground" role="status" aria-live="polite">
          {failed ? "The call didn't connect" : connected && call ? clock(call.started_at, now) : "Calling…"}
        </p>

        <div aria-hidden className="mt-6 flex h-10 items-center gap-[3px]">
          {Array.from({ length: 28 }, (_, index) => (
            <span
              key={index}
              className={cn("w-[3px] rounded-full bg-foreground/70", connected && "animate-breathe")}
              style={{ height: connected ? `${24 + ((index * 37) % 70)}%` : "12%", animationDelay: `${(index % 7) * 120}ms`, transition: "height 400ms var(--ease-out-expo)" }}
            />
          ))}
        </div>

        <p className="mt-6 max-w-[380px] text-caption text-muted-foreground">
          Calls aren't connected to the network yet, so {character.name} can't hear or answer. This shows how a call will look and work.
        </p>
      </div>

      <div className="relative mt-8 flex items-center gap-2 rounded-full border border-hairline bg-popover p-2 shadow-float">
        <Button size="icon" variant={muted ? "primary" : "secondary"} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} onClick={() => setMuted((value) => !value)} className="size-12">
          {muted ? <MicOff /> : <Mic />}
        </Button>
        <Button size="icon" variant={camera ? "secondary" : "primary"} aria-label={camera ? "Turn camera off" : "Turn camera on"} aria-pressed={!camera} onClick={() => setCamera((value) => !value)} className="size-12">
          {camera ? <Video /> : <VideoOff />}
        </Button>
        <Button size="icon" aria-label="End call" onClick={hangUp} variant="destructive" className="size-12">
          <PhoneOff />
        </Button>
      </div>
    </div>
  );
}
