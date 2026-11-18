"use client";

import { Segmented } from "@aquareum/ui";
import { Radio } from "lucide-react";

import { MEDIUMS, MEDIUM_ORDER, type Medium } from "./mediums";

export type StudioTab = Medium | "live";

const TABS = [
  ...MEDIUM_ORDER.map((value) => {
    const Icon = MEDIUMS[value].icon;
    return { value: value as StudioTab, label: MEDIUMS[value].label, icon: <Icon /> };
  }),
  { value: "live" as StudioTab, label: "Live", icon: <Radio /> },
];

/** The studio's title and its media tabs. Video leads; Live is the last tab. */
export function StudioHeader({ current, onChange }: { current: StudioTab; onChange: (tab: StudioTab) => void }) {
  return (
    <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:px-6">
      <h1 className="hidden text-lead font-semibold text-foreground sm:block">Studio</h1>
      <span className="sm:hidden" />
      <Segmented label="Media type" options={TABS} value={current} onValueChange={onChange} />
      <span />
    </header>
  );
}
