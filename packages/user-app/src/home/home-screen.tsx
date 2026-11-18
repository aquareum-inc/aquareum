"use client";

import type { AgentModel, Character, CharacterCast, MediaItem, Offering, PromptStarter, ShowcaseItem } from "@aquareum/api-client/types";
import { Chip, EASE_OUT_EXPO, STAGGER } from "@aquareum/ui";
import { CornerDownLeft, Film, ImagePlay, Radio, ScanSearch, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Composer, type ComposerValue } from "./composer";
import { HomeBackdrop } from "./home-backdrop";
import { ShowcaseGrid } from "./showcase-grid";

export interface HomeScreenProps {
  starters: ReadonlyArray<PromptStarter>;
  showcase: ReadonlyArray<ShowcaseItem>;
  offerings: ReadonlyArray<Offering>;
  /** The language models the agent can run on, for its model menu. */
  agentModels: ReadonlyArray<AgentModel>;
  /** Hands the request to the next screen. */
  onSubmit: (value: ComposerValue) => void | Promise<void>;
  /** Footage behind the composer, from the instance config. */
  backdrop?: { video?: string | null; poster?: string | null; image?: string | null; aurora?: boolean };
  /** Absent for guests, who have no library. */
  loadLibrary?: () => Promise<MediaItem[]>;
  /** Absent for guests, and when the instance has characters switched off. */
  loadCharacters?: () => Promise<Character[]>;
  /** A character already put on screen, arriving from their page. */
  cast?: CharacterCast | null;
}

const STARTER_ICONS: Record<string, LucideIcon> = {
  "make-video": Film,
  "animate-image": ImagePlay,
  "understand-video": ScanSearch,
  "restyle-live": Radio,
};

const EMPTY: ComposerValue = { attachments: [], cast: null, prompt: "", app: null, model: null, aspect: "16:9", durationSeconds: 5 };

export function HomeScreen({ starters, showcase, offerings, agentModels, onSubmit, loadLibrary, loadCharacters, cast = null, backdrop }: HomeScreenProps) {
  const [value, setValue] = useState<ComposerValue>(() =>
    cast ? { ...EMPTY, cast, app: offerings.some((offering) => offering.app === "image-to-video") ? "image-to-video" : null } : EMPTY,
  );
  const [openStarter, setOpenStarter] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Arriving with a character cast, the next thing to do is describe the scene.
  const arrivedWithCast = cast !== null;
  useEffect(() => {
    if (arrivedWithCast) textareaRef.current?.focus();
  }, [arrivedWithCast]);
  const starter = starters.find((entry) => entry.id === openStarter) ?? null;
  const known = (app: string) => (offerings.some((offering) => offering.app === app) ? app : null);

  const fill = (prompt: string, app: string) => {
    setValue((current) => ({ ...current, prompt, app: known(app) }));
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto">
      <HomeBackdrop video={backdrop?.video ?? null} poster={backdrop?.poster ?? null} image={backdrop?.image ?? null} aurora={backdrop?.aurora ?? false} />
      <section className="relative mx-auto flex w-full max-w-[720px] flex-col items-center px-4 pb-10 pt-[12vh] md:px-6 md:pt-[16vh]">
        <h1 className="text-balance text-center text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground md:text-display">
          Direct anything.
        </h1>
        <p className="mt-3 max-w-[460px] text-balance text-center text-lead text-muted-foreground">
          Describe a scene and watch it play out. Then edit it, restyle it, or take it live.
        </p>

        <div className="mt-8 w-full">
          <Composer
            value={value}
            onChange={setValue}
            onSubmit={onSubmit}
            offerings={offerings}
            agentModels={agentModels}
            textareaRef={textareaRef}
            {...(loadLibrary ? { loadLibrary } : {})}
            {...(loadCharacters ? { loadCharacters } : {})}
          />
        </div>

        <div className="mt-4 flex w-full flex-wrap justify-center gap-2">
          {starters.map((entry) => {
            const Icon = STARTER_ICONS[entry.id] ?? Film;
            const selected = entry.id === openStarter;
            return (
              <Chip
                key={entry.id}
                selected={selected}
                aria-expanded={selected}
                onClick={() => {
                  setOpenStarter(selected ? null : entry.id);
                  setValue((current) => ({ ...current, app: selected ? current.app : known(entry.app) }));
                }}
                className="glass h-9 border-glass-edge px-3.5 text-body text-foreground/85"
              >
                <Icon aria-hidden />
                {entry.label}
              </Chip>
            );
          })}
        </div>

        <AnimatePresence initial={false} mode="wait">
          {starter ? (
            <motion.ul
              key={starter.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
              className="mt-3 w-full overflow-hidden"
            >
              {starter.examples.map((example, index) => (
                <motion.li
                  key={example}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * STAGGER, duration: 0.24, ease: EASE_OUT_EXPO }}
                >
                  <button
                    type="button"
                    onClick={() => fill(example, starter.app)}
                    className="group flex w-full items-center gap-3 rounded-field px-4 py-2.5 text-left text-body text-muted-foreground transition-colors duration-150 hover:bg-hover hover:text-foreground"
                  >
                    <span className="min-w-0 flex-1">{example}</span>
                    <CornerDownLeft className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </section>

      <section aria-labelledby="examples-heading" className="relative mx-auto w-full max-w-[1120px] px-4 pb-16 md:px-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="examples-heading" className="text-body font-semibold text-foreground">
            Made here
          </h2>
          <p className="text-caption text-subtle-foreground">Pick one to start from its prompt</p>
        </div>
        <ShowcaseGrid items={showcase} onUse={(item) => fill(item.prompt, item.app)} />
      </section>
    </div>
  );
}
