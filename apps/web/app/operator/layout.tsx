import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Console } from "@/components/console";
import { DevRoleSwitch } from "@/components/dev-role-switch";
import { getSession } from "@/lib/auth/session";
import { isDev } from "@/lib/env";
import { brandOf, instance } from "@/lib/instance";

export const metadata: Metadata = { title: { default: "Operator console", template: "%s · Operator console" } };
export const dynamic = "force-dynamic";

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  const config = instance();
  const { surfaces } = config;
  if (!surfaces.console) notFound();
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/operator");
  // Hidden from users: to anyone who isn't an operator the console doesn't exist.
  if (session.role !== "operator") notFound();
  return (
    <>
      <Console brand={brandOf(config)} appAvailable={surfaces.app}>{children}</Console>
      {isDev ? <DevRoleSwitch role={session.role} /> : null}
    </>
  );
}
