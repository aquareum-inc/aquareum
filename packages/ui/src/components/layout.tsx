import type { ComponentType, CSSProperties, InputHTMLAttributes, ReactNode, Ref, TextareaHTMLAttributes } from "react";

import { cn } from "../lib/cn";

/** A page inside the content panel: title, optional description and actions, then content. */
export function Page({ title, description, actions, tabs, children, width = "default" }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
  width?: "default" | "wide" | "narrow";
}) {
  const max = width === "wide" ? "max-w-[1240px]" : width === "narrow" ? "max-w-[720px]" : "max-w-[1040px]";
  return (
    <div className={cn("mx-auto w-full px-4 pb-16 pt-6 md:px-8 md:pt-8", max)}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-title font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
          {description ? <p className="mt-1 max-w-[60ch] text-body text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {tabs ? <div className="mb-6">{tabs}</div> : null}
      {children}
    </div>
  );
}

export interface TabLink {
  href: string;
  label: string;
}

/** Section tabs that are links, so each tab is a route. */
export function TabNav({ tabs, current, Link, label }: {
  tabs: ReadonlyArray<TabLink>;
  current: string;
  Link: ComponentType<{ href: string; className?: string; children: ReactNode; "aria-current"?: "page" | undefined }>;
  label: string;
}) {
  return (
    <nav aria-label={label} className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
      {tabs.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-body font-medium transition-colors duration-200",
              active ? "bg-active text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** A set-in card: hairline edge, one step above the panel. */
export function Card({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={cn("rounded-card border border-hairline bg-card", className)} style={style}>
      {children}
    </div>
  );
}

/** A titled group of rows inside a card, for settings and detail lists. */
export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-body font-semibold text-foreground">{title}</h2>
      {description ? <p className="mb-3 max-w-[64ch] text-caption text-muted-foreground">{description}</p> : <div className="mb-3" />}
      <Card className="divide-y divide-hairline">{children}</Card>
    </section>
  );
}

export function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-body font-medium text-foreground">{label}</div>
        {hint ? <div className="mt-0.5 text-caption text-muted-foreground">{hint}</div> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-input px-6 py-16 text-center">
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <h2 className="text-lead font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-[380px] text-body text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const FIELD = "block w-full rounded-field border border-hairline bg-muted px-3.5 text-body text-foreground outline-none transition-colors duration-200 placeholder:text-subtle-foreground focus:border-input";

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(FIELD, "h-10", className)} {...props} />;
}

export function Textarea({ className, ref, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(FIELD, "resize-none py-2.5", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-caption font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-caption text-subtle-foreground">{hint}</span> : null}
    </label>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "live" | "warn"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium",
        tone === "neutral" && "bg-secondary text-muted-foreground",
        tone === "live" && "bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-brand",
        tone === "warn" && "bg-[color-mix(in_oklch,var(--destructive)_14%,transparent)] text-destructive",
        className,
      )}
    >
      {children}
    </span>
  );
}
