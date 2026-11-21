import type { Character } from "@livepeer/api-client";
import { describe, expect, it } from "vitest";

import { memoryStore } from "../data/store";
import { moderation, type ModerationContents } from "./moderation";

const character = (slug: string, author: string, extra: Partial<Character> = {}): Character => ({
  slug, name: slug, tagline: "", description: "", greeting: "", author, visibility: "public", mature: false, calls: false, tags: [], rating: 0, chats: 0, mine: false, image: null, artwork: { hues: [0, 0, 0], seed: 0 }, ...extra,
});

const fresh = () => moderation(memoryStore<ModerationContents>({ reports: [], blocks: [], hidden: [] }), () => new Date("2026-11-20T12:00:00Z"));

describe("moderation", () => {
  it("files a report without saying who sent it, and a second one from the same person updates it", () => {
    const desk = fresh();
    const mara = character("mara", "studio-north");
    const first = desk.report("u1", mara, "spam", null);
    expect(first).not.toHaveProperty("reporter");
    const second = desk.report("u1", mara, "hateful", "Slurs in the greeting");
    expect(second.id).toBe(first.id);
    expect(desk.reports()).toEqual([expect.objectContaining({ reason: "hateful", note: "Slurs in the greeting", state: "open" })]);
    desk.report("u2", mara, "spam", null);
    expect(desk.reports()).toHaveLength(2);
  });

  it("hides a blocked character and everything by its author, for that person only", () => {
    const desk = fresh();
    desk.block("u1", character("vesper", "after-hours"));
    const forU1 = desk.visible("u1");
    expect(forU1(character("vesper", "after-hours"))).toBe(false);
    expect(forU1(character("nocturne", "after-hours"))).toBe(false);
    expect(forU1(character("mara", "studio-north"))).toBe(true);
    expect(desk.visible("u2")(character("vesper", "after-hours"))).toBe(true);
    expect(desk.visible(null)(character("vesper", "after-hours"))).toBe(true);
  });

  it("never hides a person's own character from them by a block", () => {
    const desk = fresh();
    desk.block("u1", character("vesper", "me"));
    expect(desk.visible("u1")(character("mine", "me", { mine: true }))).toBe(true);
  });

  it("takes a character down for everyone when the operator hides it, closing its other reports", () => {
    const desk = fresh();
    const lumen = character("lumen", "open-lens");
    const report = desk.report("u1", lumen, "impersonation", null);
    desk.report("u2", lumen, "spam", null);
    desk.resolve(report.id, "hidden");
    expect(desk.visible(null)(lumen)).toBe(false);
    expect(desk.visible("u3")(lumen)).toBe(false);
    expect(desk.reports().every((entry) => entry.state === "hidden")).toBe(true);
  });

  it("keeps a dismissed character up, and lists open reports first", () => {
    const desk = fresh();
    const dismissed = desk.report("u1", character("okon", "cutting-room"), "spam", null);
    desk.report("u1", character("juno", "relay-club"), "violent", null);
    desk.resolve(dismissed.id, "dismissed");
    expect(desk.visible(null)(character("okon", "cutting-room"))).toBe(true);
    expect(desk.reports().map((entry) => entry.state)).toEqual(["open", "dismissed"]);
    expect(desk.resolve("rep_missing", "hidden")).toBeNull();
  });
});
