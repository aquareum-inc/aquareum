import { ProfileSettings, SettingsLayout } from "@aquareum/user-app";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return (
    <SettingsLayout current="/settings">
      <ProfileSettings name={session.name} email={session.email} role={session.role} signOutAction="/auth/sign-out" />
    </SettingsLayout>
  );
}
