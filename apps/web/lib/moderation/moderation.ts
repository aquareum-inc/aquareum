import { randomUUID } from "node:crypto";

import type { Character, CharacterBlock, CharacterReport, ReportReason } from "@aquareum/api-client";

import type { StateStore } from "../data/store";

interface StoredReport extends CharacterReport {
  /** Who reported it, so one person can't flood the queue. Never sent to anyone. */
  reporter: string;
}

interface StoredBlock extends CharacterBlock {
  userId: string;
}

export interface ModerationContents {
  reports: StoredReport[];
  blocks: StoredBlock[];
  /** Characters the operator took off the instance, by slug. */
  hidden: string[];
}

export type ModerationStore = StateStore<ModerationContents>;

/** Reports, blocks and characters taken down: what the stores require of an app with characters people share. */
export interface Moderation {
  /** Files a report. A second report of the same character by the same person updates the first while it's open. */
  report(userId: string, character: Character, reason: ReportReason, note: string | null): CharacterReport;
  /** Hides a character, and everything else by its author, from this person. */
  block(userId: string, character: Character): CharacterBlock;
  /** What this person, or a guest with null, may see: nothing taken down, nothing they blocked. */
  visible(userId: string | null): (character: Character) => boolean;
  /** Every report, open ones first, newest first. */
  reports(): CharacterReport[];
  /** The operator's decision on a report. Hiding takes the character down and closes its other open reports. */
  resolve(id: string, outcome: "dismissed" | "hidden"): CharacterReport | null;
}

const publicReport = ({ reporter: _reporter, ...report }: StoredReport): CharacterReport => report;

export function moderation(store: ModerationStore, now: () => Date = () => new Date()): Moderation {
  return {
    report(userId, character, reason, note) {
      return store.update((contents) => {
        const open = contents.reports.find((entry) => entry.reporter === userId && entry.character_slug === character.slug && entry.state === "open");
        if (open) {
          open.reason = reason;
          open.note = note;
          return publicReport(open);
        }
        const report: StoredReport = { id: `rep_${randomUUID()}`, character_slug: character.slug, character_name: character.name, author: character.author, reason, note, created_at: now().toISOString(), state: "open", reporter: userId };
        contents.reports.push(report);
        return publicReport(report);
      });
    },
    block(userId, character) {
      return store.update((contents) => {
        const block = { character_slug: character.slug, author: character.author };
        if (!contents.blocks.some((entry) => entry.userId === userId && entry.character_slug === character.slug)) contents.blocks.push({ ...block, userId });
        return block;
      });
    },
    visible(userId) {
      const { blocks, hidden } = store.read();
      const taken = new Set(hidden);
      const mine = blocks.filter((entry) => entry.userId === userId);
      const slugs = new Set(mine.map((entry) => entry.character_slug));
      const authors = new Set(mine.map((entry) => entry.author));
      return (character) => !taken.has(character.slug) && (character.mine || (!slugs.has(character.slug) && !authors.has(character.author)));
    },
    reports() {
      return store
        .read()
        .reports.map(publicReport)
        .sort((a, b) => Number(b.state === "open") - Number(a.state === "open") || b.created_at.localeCompare(a.created_at));
    },
    resolve(id, outcome) {
      return store.update((contents) => {
        const report = contents.reports.find((entry) => entry.id === id);
        if (!report) return null;
        report.state = outcome;
        if (outcome === "hidden") {
          if (!contents.hidden.includes(report.character_slug)) contents.hidden.push(report.character_slug);
          for (const other of contents.reports) if (other.character_slug === report.character_slug && other.state === "open") other.state = "hidden";
        }
        return publicReport(report);
      });
    },
  };
}
