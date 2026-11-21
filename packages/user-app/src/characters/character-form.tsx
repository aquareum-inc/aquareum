"use client";

import type { CharacterInput } from "@livepeer/api-client/types";
import { Button, Field, Input, Page, Row, Section, Switch, Textarea } from "@livepeer/ui";
import { useState, type FormEvent } from "react";

export interface CharacterFormProps {
  /** Whether the instance and this user allow adult content. */
  matureAllowed: boolean;
  onCreate: (input: CharacterInput) => Promise<void>;
}

const EMPTY: CharacterInput = { name: "", tagline: "", description: "", greeting: "", visibility: "private", mature: false };

export function CharacterForm({ matureAllowed, onCreate }: CharacterFormProps) {
  const [value, setValue] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<CharacterInput>) => setValue((current) => ({ ...current, ...patch }));
  const valid = value.name.trim() !== "" && value.description.trim() !== "" && value.greeting.trim() !== "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({ ...value, name: value.name.trim() });
    } catch {
      setError("That didn't save. Try again.");
      setSaving(false);
    }
  };

  return (
    <Page title="New character" description="Who they are, how they look and move, and how they speak." width="narrow">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Name">
          <Input value={value.name} onChange={(event) => set({ name: event.target.value })} maxLength={40} placeholder="Mara" required />
        </Field>
        <Field label="One line about them" hint="Shown under their name.">
          <Input value={value.tagline} onChange={(event) => set({ tagline: event.target.value })} maxLength={80} placeholder="A film director who thinks in shots." />
        </Field>
        <Field label="Who they are" hint="How they look, move and speak, and what they care about. Every scene and conversation keeps them in character from this.">
          <Textarea rows={6} value={value.description} onChange={(event) => set({ description: event.target.value })} maxLength={2000} required />
        </Field>
        <Field label="How they open" hint="The first thing they say in a new conversation.">
          <Textarea rows={2} value={value.greeting} onChange={(event) => set({ greeting: event.target.value })} maxLength={300} required />
        </Field>
        <Section title="Sharing">
          <Row label="Share with everyone on this instance" hint="Off keeps the character private to you.">
            <Switch checked={value.visibility === "public"} onCheckedChange={(checked) => set({ visibility: checked ? "public" : "private" })} aria-label="Share with everyone" />
          </Row>
          {matureAllowed ? (
            <Row label="For adults only" hint="Hidden from anyone who hasn't switched adult content on.">
              <Switch checked={value.mature} onCheckedChange={(mature) => set({ mature })} aria-label="For adults only" />
            </Row>
          ) : null}
        </Section>
        {error ? <p role="alert" className="text-body text-destructive">{error}</p> : null}
        <Button type="submit" variant="primary" size="lg" disabled={!valid || saving} className="self-start">
          {saving ? "Saving…" : "Create character"}
        </Button>
      </form>
    </Page>
  );
}
