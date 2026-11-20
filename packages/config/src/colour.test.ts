import { describe, expect, it } from "vitest";

import { colourToHex, parseColour } from "./colour";

describe("CSS colours as sRGB", () => {
  it("reads hex and rgb", () => {
    expect(colourToHex("#40bf86")).toBe("#40BF86");
    expect(colourToHex("#fff")).toBe("#FFFFFF");
    expect(colourToHex("rgb(0 0 0 / 0.6)")).toBe("#00000099");
    expect(colourToHex("rgb(24 24 27 / 0.32)")).toBe("#18181B52");
  });

  it("converts oklch greys to the values browsers show", () => {
    expect(colourToHex("oklch(1 0 0)")).toBe("#FFFFFF");
    expect(colourToHex("oklch(0 0 0)")).toBe("#000000");
    expect(colourToHex("oklch(0.985 0 0)")).toBe("#FAFAFA");
    expect(colourToHex("oklch(0.205 0 0)")).toBe("#171717");
    expect(colourToHex("oklch(0.922 0 0)")).toBe("#E5E5E5");
    expect(colourToHex("oklch(0.556 0 0)")).toBe("#737373");
  });

  it("converts oklch colours, and keeps alpha", () => {
    expect(colourToHex("oklch(0.577 0.245 27.325)")).toBe("#E7000B");
    expect(colourToHex("oklch(0.704 0.191 22.216)")).toBe("#FF6467");
    expect(colourToHex("oklch(1 0 0 / 10%)")).toBe("#FFFFFF1A");
  });

  it("clips a colour outside sRGB, as browsers do", () => {
    expect(parseColour("oklch(0.7 0.4 150)")).toMatchObject({ r: 0, b: 0 });
  });

  it("mixes in oklch: with transparent it only fades, between colours it blends", () => {
    expect(colourToHex("color-mix(in oklch, oklch(0.985 0 0) 50%, transparent)")).toBe("#FAFAFA80");
    expect(colourToHex("color-mix(in oklch, oklch(1 0 0) 50%, oklch(0 0 0))")).toBe("#636363");
    expect(colourToHex("color-mix(in oklch, oklch(0.985 0 0) 4%, oklch(0.21 0 0))")).toBe("#1F1F1F");
  });

  it("answers null for what it can't resolve", () => {
    expect(colourToHex("var(--primary)")).toBeNull();
    expect(colourToHex("rebeccapurple")).toBeNull();
  });
});
