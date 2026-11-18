"use client";

import { Popover, PopoverClose, PopoverContent, PopoverTrigger, RollingNumber, cn, useTheme } from "@aquareum/ui";
import { Coins, LogIn, LogOut, Moon, Settings2, ShieldCheck, Sparkles, Sun, UserRound, Wrench, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useCredits } from "./credits";
import { useLink } from "./link";

export interface Account {
  name: string;
  email: string | null;
  role: "user" | "operator";
}

export interface AccountMenuProps {
  /** The signed-in person, or null for a guest. */
  account: Account | null;
  /** Shows the name and balance beside the avatar (the open sidebar). */
  expanded?: boolean;
  /** Where the sign-out form posts. */
  signOutAction: string;
  signInHref: string;
  /** Whether this instance serves the operator console. */
  consoleAvailable: boolean;
  side?: "top" | "bottom";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

function Avatar({ account, className }: { account: Account | null; className?: string }) {
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[12px] font-semibold text-secondary-foreground ring-1 ring-hairline", className)}>
      {account ? initials(account.name) : <UserRound className="size-[55%]" strokeWidth={1.75} aria-hidden />}
    </span>
  );
}

const ITEM = "flex h-10 w-full items-center gap-3 rounded-field px-3 text-left text-body text-foreground transition-colors duration-150 hover:bg-hover";

function Item({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: ReactNode }) {
  const Link = useLink();
  return (
    <PopoverClose asChild>
      <Link href={href} className={ITEM}>
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
        {children}
      </Link>
    </PopoverClose>
  );
}

/**
 * The account, at the foot of the sidebar: who you are, your credits, and the way to plans,
 * settings and sign-out. A guest gets the same place, with a way to sign in.
 */
export function AccountMenu({ account, expanded = false, signOutAction, signInHref, consoleAvailable, side = "top" }: AccountMenuProps) {
  const { credits } = useCredits();
  const { resolved, setPreference } = useTheme();
  const name = account?.name ?? "Guest";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Account: ${name}`}
          className={cn(
            "flex items-center gap-2.5 rounded-full text-left transition-[background-color,transform] duration-200 ease-out-expo hover:bg-hover active:scale-[0.98] data-[state=open]:bg-hover",
            expanded ? "w-full p-1.5 pr-3" : "p-1",
          )}
        >
          <Avatar account={account} />
          {expanded ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-foreground">{name}</span>
              <span className="flex items-center gap-1 font-mono text-[11px] text-subtle-foreground">
                {account ? (
                  <>
                    <Coins className="size-3" aria-hidden />
                    <RollingNumber value={credits} />
                  </>
                ) : (
                  "Not signed in"
                )}
              </span>
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align="start" className="w-[280px]">
        <div className="flex items-center gap-3 px-3 pb-2 pt-2.5">
          <Avatar account={account} className="size-10 text-body" />
          <div className="min-w-0">
            <p className="truncate text-body font-semibold">{name}</p>
            <p className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              {account ? (
                <>
                  <Coins className="size-3" aria-hidden />
                  <RollingNumber value={credits} /> credits
                </>
              ) : (
                "Sign in to generate and save your work"
              )}
            </p>
          </div>
        </div>

        {account ? (
          <>
            <div className="my-1 h-px bg-hairline" />
            <Item href="/settings/plan" icon={Coins}>Add credits</Item>
            <Item href="/settings/plan" icon={Sparkles}>Plan</Item>
            <div className="my-1 h-px bg-hairline" />
            <Item href="/settings" icon={Settings2}>Settings</Item>
            <Item href="/settings/privacy" icon={ShieldCheck}>Who can see what</Item>
            {account.role === "operator" && consoleAvailable ? <Item href="/operator" icon={Wrench}>Operator console</Item> : null}
          </>
        ) : null}

        <div className="my-1 h-px bg-hairline" />
        <button type="button" className={ITEM} onClick={() => setPreference(resolved === "dark" ? "light" : "dark")}>
          {resolved === "dark" ? <Sun className="size-4 text-muted-foreground" strokeWidth={1.75} /> : <Moon className="size-4 text-muted-foreground" strokeWidth={1.75} />}
          {resolved === "dark" ? "Light theme" : "Dark theme"}
        </button>
        <div className="my-1 h-px bg-hairline" />
        {account ? (
          <form action={signOutAction} method="post">
            <button type="submit" className={ITEM}>
              <LogOut className="size-4 text-muted-foreground" strokeWidth={1.75} />
              Sign out
            </button>
          </form>
        ) : (
          <a href={signInHref} className={ITEM}>
            <LogIn className="size-4 text-muted-foreground" strokeWidth={1.75} />
            Sign in or sign up
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
