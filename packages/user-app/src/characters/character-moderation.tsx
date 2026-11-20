"use client";

import type { Character, ReportReason } from "@aquareum/api-client/types";
import { Button, cn, Popover, PopoverClose, PopoverContent, PopoverTrigger, Sheet, Textarea } from "@aquareum/ui";
import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { useLink } from "../shell/link";
import { REPORT_NOTE_LIMIT, REPORT_REASONS } from "./report-reasons";

export interface CharacterModerationProps {
  character: Character;
  /** The instance's name, so the person knows who reads the report. */
  instanceName: string;
  /** Where a guest signs in first. Absent when someone is signed in. */
  signInHref?: string | undefined;
  report: (reason: ReportReason, note: string | null) => Promise<void>;
  block: () => Promise<void>;
}

/** Report and Block for someone else's character: what the app stores require of shared characters. */
export function CharacterModeration({ character, instanceName, signInHref, report, block }: CharacterModerationProps) {
  const Link = useLink();
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const item = "flex h-9 w-full items-center gap-2.5 rounded-field px-2.5 text-left text-body transition-colors hover:bg-hover focus-visible:bg-hover outline-none [&_svg]:size-4";

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More for ${character.name}`}><MoreHorizontal /></Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[220px]">
          {signInHref ? (
            <>
              <Link href={signInHref} className={item}><Flag />Report {character.name}…</Link>
              <Link href={signInHref} className={cn(item, "text-destructive")}><Ban />Block {character.name}</Link>
            </>
          ) : (
            <>
              <PopoverClose asChild>
                <button type="button" className={item} onClick={() => setReporting(true)}><Flag />Report {character.name}…</button>
              </PopoverClose>
              <PopoverClose asChild>
                <button type="button" className={cn(item, "text-destructive")} onClick={() => setBlocking(true)}><Ban />Block {character.name}</button>
              </PopoverClose>
            </>
          )}
        </PopoverContent>
      </Popover>

      <ReportSheet open={reporting} onOpenChange={setReporting} character={character} instanceName={instanceName} report={report} />
      <BlockSheet open={blocking} onOpenChange={setBlocking} character={character} block={block} />
    </>
  );
}

function ReportSheet({ open, onOpenChange, character, instanceName, report }: { open: boolean; onOpenChange: (open: boolean) => void; character: Character; instanceName: string; report: CharacterModerationProps["report"] }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setReason(null);
      setNote("");
      setSent(false);
      setError(null);
    }
  };
  const send = async () => {
    if (!reason) return;
    setSending(true);
    setError(null);
    try {
      await report(reason, note.trim() || null);
      setSent(true);
    } catch {
      setError("That didn't send. Check your connection and try again.");
    }
    setSending(false);
  };

  return (
    <Sheet open={open} onOpenChange={change} title={`Report ${character.name}`} description={sent ? undefined : `The people who run ${instanceName} will see it. They won't see who sent it.`}>
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-foreground">Thanks. The people who run {instanceName} will look at it. You can also block {character.name} so you don't see them again.</p>
          <Button variant="primary" onClick={() => change(false)}>Done</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="Why are you reporting this character?" className="flex flex-col divide-y divide-hairline">
            {REPORT_REASONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={reason === option.value}
                onClick={() => setReason(option.value)}
                className="flex h-11 items-center justify-between text-left text-body text-foreground outline-none focus-visible:bg-hover"
              >
                {option.label}
                <span aria-hidden className={cn("size-4 rounded-full border transition-[border-width,border-color]", reason === option.value ? "border-[5px] border-foreground" : "border-input")} />
              </button>
            ))}
          </div>
          <Textarea rows={2} value={note} maxLength={REPORT_NOTE_LIMIT} onChange={(event) => setNote(event.target.value)} placeholder="Anything to add (optional)" aria-label="Anything to add" />
          {error ? <p role="alert" className="text-caption text-destructive">{error}</p> : null}
          <Button variant="primary" disabled={!reason || sending} onClick={send}>{sending ? "Sending…" : "Send report"}</Button>
        </div>
      )}
    </Sheet>
  );
}

function BlockSheet({ open, onOpenChange, character, block }: { open: boolean; onOpenChange: (open: boolean) => void; character: Character; block: CharacterModerationProps["block"] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await block();
    } catch {
      setError(`${character.name} isn't blocked. Check your connection and try again.`);
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setError(null); }} title={`Block ${character.name}?`} description={`You won't see ${character.name} or anything else by ${character.author} again.`}>
      {error ? <p role="alert" className="mb-3 text-caption text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="destructive" className="flex-1" disabled={busy} onClick={confirm}>{busy ? "Blocking…" : "Block"}</Button>
      </div>
    </Sheet>
  );
}
