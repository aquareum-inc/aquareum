"use client";

import type { CreditPack } from "@aquareum/api-client";
import { Badge, Button, Field, Input, Sheet, Switch } from "@aquareum/ui";
import { Plus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { count, usd } from "./format";
import { Panel } from "./parts";
import { Table } from "./table";

export type SaveCreditPack = (id: string | null, input: Omit<CreditPack, "id">) => Promise<{ ok: true; packs: CreditPack[] } | { ok: false; error: string }>;

export interface CreditPacksProps {
  initial: CreditPack[];
  /** False when the provider sells no packs: the list shows, but nothing can be added or changed. */
  editable: boolean;
  providerName: string;
  /** The instance's base rate, which a pack's bonus is measured against. */
  creditsPerUsd: number;
  save: SaveCreditPack;
  /** Shown under the list: the other ways to top up. */
  children?: ReactNode;
}

const BLANK: Omit<CreditPack, "id"> = { credits: 1000, price: { amount: "10.00", currency: "USD" }, popular: false, active: true };

/** How many more credits a dollar buys in this pack than at the base rate, as a whole percentage. */
export function packBonus(pack: Pick<CreditPack, "credits" | "price">, creditsPerUsd: number): number {
  const price = Number(pack.price.amount);
  if (!(price > 0) || !(creditsPerUsd > 0)) return 0;
  return Math.round((pack.credits / (price * creditsPerUsd) - 1) * 100);
}

const bonusText = (bonus: number) => (bonus === 0 ? "—" : `${bonus > 0 ? "+" : ""}${bonus}%`);

/** The provider's credit packs, and a sheet to add one or change its credits, price, highlight and sale. */
export function CreditPacks({ initial, editable, providerName, creditsPerUsd, save, children }: CreditPacksProps) {
  const [packs, setPacks] = useState(initial);
  const [editing, setEditing] = useState<{ id: string | null; value: Omit<CreditPack, "id"> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (id: string | null, value: Omit<CreditPack, "id">) => {
    setError(null);
    setEditing({ id, value });
  };
  const set = (patch: Partial<Omit<CreditPack, "id">>) => setEditing((current) => (current ? { ...current, value: { ...current.value, ...patch } } : current));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    const value = { ...editing.value, price: { ...editing.value.price, amount: Number(editing.value.price.amount).toFixed(2) } };
    const result = await save(editing.id, value).catch(() => ({ ok: false as const, error: "The pack wasn't saved. Try again." }));
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setPacks(result.packs);
    setEditing(null);
  };

  const bonus = editing ? packBonus(editing.value, creditsPerUsd) : 0;

  return (
    <Panel
      title="Credit packs"
      description="A pack is a one-off top-up of a user's allocation."
      actions={editable ? <Button size="sm" onClick={() => open(null, BLANK)}><Plus />New pack</Button> : null}
    >
      <Table
        caption="Credit packs"
        rows={packs}
        rowKey={(pack) => pack.id}
        empty={editable ? "No packs yet. Add one so users can top up a set amount." : `${providerName} doesn't offer credit packs.`}
        columns={[
          {
            key: "credits",
            header: "Credits",
            cell: (pack) => (
              <span className="inline-flex items-center gap-2">
                {editable ? (
                  <button type="button" className="font-mono underline-offset-2 hover:underline" onClick={() => open(pack.id, { credits: pack.credits, price: pack.price, popular: pack.popular, active: pack.active })}>
                    {count(pack.credits)}
                  </button>
                ) : (
                  <span className="font-mono">{count(pack.credits)}</span>
                )}
                {pack.popular ? <Badge>Highlighted</Badge> : null}
              </span>
            ),
          },
          { key: "price", header: "Price", cell: (pack) => usd(pack.price.amount, 0), mono: true, align: "right" },
          { key: "rate", header: "Per 1,000", cell: (pack) => usd((Number(pack.price.amount) / pack.credits) * 1000), mono: true, align: "right", wide: true },
          { key: "bonus", header: "Bonus", cell: (pack) => bonusText(packBonus(pack, creditsPerUsd)), mono: true, align: "right" },
          { key: "active", header: "Offered", cell: (pack) => (pack.active ? "Yes" : "No"), align: "right" },
        ]}
      />
      {children}

      <Sheet open={editing !== null} onOpenChange={(next) => !next && setEditing(null)} title={editing?.id ? "Edit credit pack" : "New credit pack"}>
        {editing ? (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Credits">
                <Input type="number" min="1" step="1" value={editing.value.credits} onChange={(event) => set({ credits: Number(event.target.value || 0) })} className="font-mono" required />
              </Field>
              <Field label={`Price (${editing.value.price.currency})`}>
                <Input type="number" min="0.01" step="0.01" value={editing.value.price.amount} onChange={(event) => set({ price: { amount: event.target.value, currency: editing.value.price.currency } })} className="font-mono" required />
              </Field>
            </div>
            <p className="text-caption text-muted-foreground">
              {`The base rate is ${count(creditsPerUsd)} credits a dollar. `}
              {bonus > 0 ? `This pack gives ${bonus}% more.` : bonus < 0 ? `This pack gives ${-bonus}% fewer, so users pay more per credit than the base rate.` : "This pack gives the base rate."}
            </p>
            <label className="flex items-center justify-between gap-4 py-1 text-body">
              <span>
                Highlight this pack
                <span className="block text-caption text-muted-foreground">Selected first and marked Popular. Takes the highlight off any other pack.</span>
              </span>
              <Switch checked={editing.value.popular} onCheckedChange={(popular) => set({ popular })} aria-label="Highlight this pack" />
            </label>
            <label className="flex items-center justify-between gap-4 py-1 text-body">
              <span>
                Offer this pack to users
                <span className="block text-caption text-muted-foreground">Off, users stop seeing it. Past purchases keep it.</span>
              </span>
              <Switch checked={editing.value.active} onCheckedChange={(active) => set({ active })} aria-label="Offer this pack to users" />
            </label>
            {error ? <p role="alert" className="text-caption text-destructive">{error}</p> : null}
            <Button type="submit" variant="primary" disabled={busy || !(editing.value.credits > 0) || !(Number(editing.value.price.amount) > 0)}>{busy ? "Saving…" : "Save pack"}</Button>
          </form>
        ) : null}
      </Sheet>
    </Panel>
  );
}
