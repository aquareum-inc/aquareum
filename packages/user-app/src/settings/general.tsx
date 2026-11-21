"use client";

import type { Preferences } from "@livepeer/api-client/types";
import { Button, Chip, Row, Section, Sheet, Switch, useTheme, type ThemePreference } from "@livepeer/ui";
import { useState } from "react";

export interface GeneralSettingsProps {
  initial: Preferences;
  /** Whether the operator has switched adult content on for this instance. */
  adultContentOffered: boolean;
  update: (patch: Partial<Preferences>) => Promise<Preferences>;
}

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];
const ASPECTS: Preferences["defaultAspect"][] = ["16:9", "9:16", "1:1"];
const DURATIONS = [5, 10, 15];

export function GeneralSettings({ initial, adultContentOffered, update }: GeneralSettingsProps) {
  const [preferences, setPreferences] = useState(initial);
  const [confirmingAge, setConfirmingAge] = useState(false);
  const [error, setError] = useState(false);
  const { preference, setPreference } = useTheme();

  const save = async (patch: Partial<Preferences>) => {
    const previous = preferences;
    setPreferences({ ...preferences, ...patch });
    setError(false);
    try {
      setPreferences(await update(patch));
    } catch {
      setPreferences(previous);
      setError(true);
    }
  };

  const toggle = (key: keyof Preferences, label: string, hint?: string) => (
    <Row label={label} hint={hint}>
      <Switch checked={Boolean(preferences[key])} onCheckedChange={(checked) => save({ [key]: checked })} aria-label={label} />
    </Row>
  );

  return (
    <>
      {error ? <p role="alert" className="mb-4 text-body text-destructive">That change didn't save. Try again.</p> : null}
      <Section title="Appearance">
        <Row label="Theme">
          {THEMES.map((theme) => (
            <Chip key={theme.value} selected={preference === theme.value} aria-pressed={preference === theme.value} onClick={() => setPreference(theme.value)}>
              {theme.label}
            </Chip>
          ))}
        </Row>
      </Section>

      <Section title="Chat">
        {toggle("enterSends", "Enter sends the message", "Off, Enter adds a line and ⌘Enter sends.")}
        {toggle("saveChats", "Save my conversations", "Off, new conversations disappear when you close them.")}
      </Section>

      <Section title="Generating">
        {toggle("confirmBeforeSpending", "Ask before spending credits in chat", "The agent shows the cost and waits for you before it generates video.")}
        {toggle("completionNotifications", "Tell me when a render finishes")}
        <Row label="Default shape">
          {ASPECTS.map((aspect) => (
            <Chip key={aspect} className="font-mono" selected={preferences.defaultAspect === aspect} aria-pressed={preferences.defaultAspect === aspect} onClick={() => save({ defaultAspect: aspect })}>
              {aspect}
            </Chip>
          ))}
        </Row>
        <Row label="Default length">
          {DURATIONS.map((seconds) => (
            <Chip key={seconds} className="font-mono" selected={preferences.defaultDuration === seconds} aria-pressed={preferences.defaultDuration === seconds} onClick={() => save({ defaultDuration: seconds })}>
              {seconds}s
            </Chip>
          ))}
        </Row>
      </Section>

      {adultContentOffered ? (
        <Section title="Adult content" description="Off by default. Switching it on shows characters and outputs meant for adults.">
          <Row label="Show adult content" hint={preferences.ageConfirmed ? "You've confirmed you're 18 or over." : "You'll be asked to confirm your age first."}>
            <Switch
              checked={preferences.adultContent}
              onCheckedChange={(checked) => {
                if (checked && !preferences.ageConfirmed) setConfirmingAge(true);
                else void save({ adultContent: checked });
              }}
              aria-label="Show adult content"
            />
          </Row>
        </Section>
      ) : null}

      <Sheet open={confirmingAge} onOpenChange={setConfirmingAge} title="Are you 18 or over?" description="Adult content is only for adults. Confirming is recorded on your account.">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setConfirmingAge(false)}>No</Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              setConfirmingAge(false);
              void save({ ageConfirmed: true, adultContent: true });
            }}
          >
            Yes, I'm 18 or over
          </Button>
        </div>
      </Sheet>
    </>
  );
}
