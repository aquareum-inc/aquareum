import { describe, expect, it } from "vitest";

import { LOGO_MAX_BYTES, cleanLogo } from "./logo";

const svg = (body: string) => `data:image/svg+xml;base64,${Buffer.from(body).toString("base64")}`;
const decode = (value: string) => Buffer.from(value.split(",")[1] ?? "", "base64").toString();
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];

describe("cleanLogo", () => {
  it("keeps paths on the site and https URLs, and removes on blank", () => {
    expect(cleanLogo("/brand/livepeer-symbol.svg")).toEqual({ ok: true, value: "/brand/livepeer-symbol.svg" });
    expect(cleanLogo("https://cdn.example.test/logo.svg")).toEqual({ ok: true, value: "https://cdn.example.test/logo.svg" });
    expect(cleanLogo("  ")).toEqual({ ok: true, value: null });
    expect(cleanLogo("http://example.test/logo.svg").ok).toBe(false);
  });

  it("accepts a plain SVG upload", () => {
    const result = cleanLogo(svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>'));
    expect(result.ok && decode(result.value ?? "")).toContain("<path");
  });

  it("strips scripts and event handlers from an SVG", () => {
    const result = cleanLogo(svg('<?xml version="1.0"?><svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script><path d="M0 0h10v10H0z"/></svg>'));
    expect(result.ok).toBe(true);
    const cleaned = result.ok ? decode(result.value ?? "") : "";
    expect(cleaned).not.toMatch(/script|onload/i);
    expect(cleaned.startsWith("<svg")).toBe(true);
  });

  it("refuses an SVG it can't make safe", () => {
    expect(cleanLogo(svg('<svg><a href="javascript:alert(1)"><path d="M0 0"/></a></svg>')).ok).toBe(false);
    expect(cleanLogo(svg('<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>')).ok).toBe(false);
    expect(cleanLogo(svg("<html><body></body></html>")).ok).toBe(false);
  });

  it("checks raster logos are what they say, and their size", () => {
    expect(cleanLogo(`data:image/png;base64,${Buffer.from(PNG).toString("base64")}`).ok).toBe(true);
    expect(cleanLogo(`data:image/png;base64,${Buffer.from("not a png").toString("base64")}`)).toEqual({ ok: false, error: "That file isn't the kind of image its name says." });
    expect(cleanLogo(`data:image/gif;base64,R0lGODlh`).ok).toBe(false);
    const big = Buffer.concat([Buffer.from(PNG), Buffer.alloc(LOGO_MAX_BYTES)]);
    expect(cleanLogo(`data:image/png;base64,${big.toString("base64")}`)).toEqual({ ok: false, error: "Logos can be up to 100 KB." });
  });
});
