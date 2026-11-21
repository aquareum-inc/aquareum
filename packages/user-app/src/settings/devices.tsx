"use client";

import type { DeviceSession } from "@livepeer/api-client/types";
import { Button, Card, EmptyState, Sheet } from "@livepeer/ui";
import { Smartphone } from "lucide-react";
import { useState } from "react";

const when = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const PLATFORM: Record<DeviceSession["platform"], string> = { ios: "iPhone or iPad", android: "Android" };

export interface DevicesSettingsProps {
  devices: DeviceSession[];
  /** Signs a device out; answers whether it was signed in. */
  revoke: (id: string) => Promise<boolean>;
}

/** The phones and tablets signed in to this account, each of which can be signed out from here. */
export function DevicesSettings({ devices: initial, revoke }: DevicesSettingsProps) {
  const [devices, setDevices] = useState(initial);
  const [signingOut, setSigningOut] = useState<DeviceSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (devices.length === 0) {
    return <EmptyState icon={Smartphone} title="No phones signed in" body="When you sign in on the iPhone or Android app, the device shows up here, and you can sign it out from anywhere." />;
  }
  return (
    <>
      {error ? <p role="alert" className="mb-3 text-body text-destructive">{error}</p> : null}
      <Card className="divide-y divide-hairline">
        {devices.map((device) => (
          <div key={device.id} className="flex items-center gap-4 px-4 py-3">
            <Smartphone className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium">{device.name}</p>
              <p className="font-mono text-caption text-subtle-foreground">{PLATFORM[device.platform]} · last used {when(device.last_used_at)}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSigningOut(device)}>Sign out</Button>
          </div>
        ))}
      </Card>
      <Sheet open={signingOut !== null} onOpenChange={(open) => !open && setSigningOut(null)} title={`Sign out “${signingOut?.name ?? ""}”?`} description="It's signed out the next time it's used. Signing in again on it brings it back.">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setSigningOut(null)}>Cancel</Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={async () => {
              const device = signingOut;
              setSigningOut(null);
              if (!device) return;
              setError(null);
              const done = await revoke(device.id).catch(() => false);
              if (done) setDevices((current) => current.filter((entry) => entry.id !== device.id));
              else setError(`“${device.name}” wasn't signed out. Try again.`);
            }}
          >
            Sign out
          </Button>
        </div>
      </Sheet>
    </>
  );
}
