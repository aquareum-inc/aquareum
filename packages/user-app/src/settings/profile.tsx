"use client";

import { Button, Row, Section } from "@aquareum/ui";

export function ProfileSettings({ name, email, role, signOutAction }: { name: string; email: string | null; role: string; signOutAction: string }) {
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
      <form action={signOutAction} method="post">
        <Button type="submit" variant="outline">Sign out</Button>
      </form>
    </>
  );
}
