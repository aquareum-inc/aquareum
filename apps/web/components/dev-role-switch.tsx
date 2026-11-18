"use client";

import { useTransition } from "react";

import { switchRoleAction } from "@/lib/auth/actions";
import type { Role } from "@/lib/auth/types";

/** Development only: flip the signed-in role to check the role guard. Never rendered for end users. */
export function DevRoleSwitch({ role }: { role: Role }) {
  const [pending, start] = useTransition();
  const next: Role = role === "operator" ? "user" : "operator";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => switchRoleAction(next))}
      title={`Development only. Switch to the ${next} role.`}
      className="fixed bottom-[136px] right-4 z-30 inline-flex h-7 items-center gap-2 rounded-full border border-hairline bg-popover px-2.5 font-mono text-[11px] text-muted-foreground shadow-float transition-colors hover:text-foreground md:bottom-14 md:right-5"
    >
      role: {role}
    </button>
  );
}
