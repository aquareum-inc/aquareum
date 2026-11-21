"use client";

import type { OperatorAuditEntry, OperatorDeviceSession } from "@livepeer/api-client";
import { Button, Sheet } from "@livepeer/ui";
import { useState, type ComponentType } from "react";

import { ago, dateTime } from "../components/format";
import { Panel, Status } from "../components/parts";
import { Table } from "../components/table";
import type { ConsoleLinkProps } from "../shell/console-shell";

export interface OperatorPhonesProps {
  phones: OperatorDeviceSession[];
  /** Whether the instance offers the console on phones at all. */
  offered: boolean;
  /** Each answers with the phones still enrolled. */
  revoke: (id: string) => Promise<OperatorDeviceSession[]>;
  revokeAll: () => Promise<OperatorDeviceSession[]>;
}

const PLATFORM: Record<OperatorDeviceSession["platform"], string> = { ios: "iOS", android: "Android" };

/** The phones enrolled for the console. Listing and revoking them is done here on the web, never from a phone. */
export function OperatorPhonesPanel({ phones: initial, offered, revoke, revokeAll }: OperatorPhonesProps) {
  const [phones, setPhones] = useState(initial);
  const [asking, setAsking] = useState<OperatorDeviceSession | "all" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!asking) return;
    setBusy(true);
    setError(null);
    try {
      setPhones(asking === "all" ? await revokeAll() : await revoke(asking.id));
    } catch {
      setError("That didn't go through. Nothing was revoked.");
    }
    setBusy(false);
    setAsking(null);
  };

  return (
    <Panel
      title={phones.length === 0 ? "Operator phones" : `Operator phones (${phones.length})`}
      description="Phones that can open this console in the app, behind a face or fingerprint. Revoke one when a phone is lost or an operator leaves; removing their role alone doesn't end a session."
      actions={phones.length > 1 ? <Button size="sm" variant="ghost" onClick={() => setAsking("all")}>Revoke all</Button> : null}
    >
      <div id="operator-phones" className="scroll-mt-6">
        {error ? <p role="alert" className="mb-2 text-caption text-destructive">{error}</p> : null}
        <Table
          caption="Operator phones"
          rows={phones}
          rowKey={(phone) => phone.id}
          empty={offered ? "No phones are enrolled. An operator adds one by opening the console in the app and signing in." : "The console on phones is off. Turn it on under Settings, in Surfaces."}
          columns={[
            {
              key: "phone",
              header: "Phone",
              cell: (phone) => (
                <span className="flex flex-col">
                  <span className="font-medium">{phone.name}</span>
                  <span className="font-mono text-[11px] text-subtle-foreground">{PLATFORM[phone.platform]}</span>
                </span>
              ),
            },
            { key: "person", header: "Operator", cell: (phone) => phone.user_name },
            { key: "added", header: "Added", cell: (phone) => dateTime(phone.created_at), mono: true, wide: true },
            { key: "used", header: "Last used", cell: (phone) => ago(phone.last_used_at), mono: true },
            { key: "unlocked", header: "Last unlocked", cell: (phone) => (phone.last_unlocked_at ? ago(phone.last_unlocked_at) : "never"), mono: true, wide: true },
            { key: "expires", header: "Signs in again", cell: (phone) => dateTime(phone.expires_at), mono: true, wide: true },
            { key: "act", header: "", align: "right", cell: (phone) => <Button size="sm" variant="destructive" onClick={() => setAsking(phone)}>Revoke</Button> },
          ]}
        />
      </div>

      <Sheet
        open={asking !== null}
        onOpenChange={(value) => !value && setAsking(null)}
        title={asking === "all" ? "Revoke every operator phone?" : `Revoke ${asking?.name ?? "this phone"}?`}
        description={asking === "all" ? "The console stops on every phone at its next request. Each operator signs in again on their phone to get it back. The user app on those phones isn't affected." : `The console stops on it at its next request. ${asking?.user_name ?? "They"} can sign in again on the phone if they are still an operator. The user app on it isn't affected.`}
      >
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setAsking(null)}>Keep {asking === "all" ? "them" : "it"}</Button>
          <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => void confirm()}>{asking === "all" ? "Revoke all" : "Revoke"}</Button>
        </div>
      </Sheet>
    </Panel>
  );
}

const EVENT: Record<OperatorAuditEntry["event"], string> = { sign_in: "signed in", sign_out: "signed out", unlock: "unlocked", change: "changed", refused: "refused", revoked: "revoked" };

/** What operators' phones did and were refused, newest first. */
export function PhoneActivityPanel({ entries }: { entries: OperatorAuditEntry[] }) {
  return (
    <Panel title="Phone activity" description="Every sign-in, unlock, change, refusal and revocation from an operator's phone. Kept on this server.">
      <Table
        caption="Phone activity"
        rows={entries}
        rowKey={(entry) => entry.id}
        empty="Nothing yet. Activity from operators' phones appears here."
        columns={[
          { key: "at", header: "When", cell: (entry) => dateTime(entry.at), mono: true },
          { key: "event", header: "What", cell: (entry) => <Status value={EVENT[entry.event]} /> },
          { key: "who", header: "Operator", cell: (entry) => entry.user_name },
          { key: "phone", header: "Phone", cell: (entry) => entry.device_name ?? <span className="text-subtle-foreground">web console</span>, wide: true },
          { key: "operation", header: "Operation", cell: (entry) => entry.operation ?? <span className="text-subtle-foreground">—</span>, mono: true, wide: true },
          { key: "target", header: "On", cell: (entry) => entry.target ?? <span className="text-subtle-foreground">—</span>, mono: true, wide: true },
          { key: "detail", header: "Detail", cell: (entry) => entry.detail?.replace(/_/g, " ") ?? <span className="text-subtle-foreground">—</span>, wide: true },
        ]}
      />
    </Panel>
  );
}

/** Said on every console page for two days after a phone is enrolled, so an addition nobody expected is seen. */
export function NewPhoneNotice({ phones, Link }: { phones: OperatorDeviceSession[]; Link: ComponentType<ConsoleLinkProps> }) {
  const [latest] = phones;
  if (!latest) return null;
  return (
    <div role="status" className="mx-auto mt-4 flex w-full max-w-[1232px] flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card border border-hairline bg-card px-4 py-2.5 text-[13px]">
      <p>
        {phones.length === 1 ? (
          <>
            <span className="font-medium">{latest.user_name}</span> added <span className="font-medium">{latest.name}</span> as an operator phone {ago(latest.created_at)}.
          </>
        ) : (
          <>{phones.length} operator phones were added in the last two days, the latest {ago(latest.created_at)}.</>
        )}{" "}
        <span className="text-muted-foreground">If you didn't expect {phones.length === 1 ? "it, revoke it" : "them, revoke them"}.</span>
      </p>
      <Link href="/operator/system#operator-phones" className="shrink-0 font-medium underline underline-offset-4">Operator phones</Link>
    </div>
  );
}
