"use client";

import { Button, Row, Section, Sheet } from "@livepeer/ui";
import { useState } from "react";

export interface ProfileSettingsProps {
  name: string;
  email: string | null;
  role: string;
  signOutAction: string;
  /** Deletes the account and signs out. */
  deleteAccount: () => Promise<void>;
}

export function ProfileSettings({ name, email, role, signOutAction, deleteAccount }: ProfileSettingsProps) {
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch {
      setError("Your account wasn't deleted. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <Section title="Account">
        <Row label="Name">
          <span className="text-body text-muted-foreground">{name}</span>
        </Row>
        <Row label="Email">
          <span className="text-body text-muted-foreground">{email ?? "Not provided"}</span>
        </Row>
        <Row label="Role" hint="Operators can also open the operator console.">
          <span className="font-mono text-caption text-muted-foreground">{role}</span>
        </Row>
      </Section>
      <form action={signOutAction} method="post" className="mb-10">
        <Button type="submit" variant="outline">Sign out</Button>
      </form>

      <Section title="Delete account" description="Removes your account, your characters and what you've made here, and signs out every device. Credits left on it are lost.">
        <Button variant="destructive" className="self-start" onClick={() => setDeleting(true)}>Delete account…</Button>
      </Section>

      <Sheet open={deleting} onOpenChange={(open) => { setDeleting(open); if (!open) setError(null); }} title="Delete your account?" description="Your characters, conversations and library go, every device is signed out, and credits left on the account are lost. This can't be undone.">
        {error ? <p role="alert" className="mb-3 text-caption text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setDeleting(false)}>Keep my account</Button>
          <Button variant="destructive" className="flex-1" disabled={busy} onClick={confirm}>{busy ? "Deleting…" : "Delete account"}</Button>
        </div>
      </Sheet>
    </>
  );
}
