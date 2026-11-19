# Design brief

Structure and flows come from the Venice inventory (`docs/research/venice-screen-inventory.md`). Brand
anchors come from Livepeer Explorer (`next`, commit `6fe4ff8`). Shape, spacing, depth, motion and component
design follow Benji Taylor's work. Sources: `docs/research/design-references.md`.

## 1. Brand anchors we reuse (verbatim from Explorer `app/globals.css`)

- **Semantic tokens only**: `background, foreground, card, popover, primary, secondary, muted, accent,
  destructive, border, input, ring` plus Explorer's layer `panel, surface, hairline, hover, active,
  subtle-foreground, overlay`. Dark is charcoal in three even steps (page `oklch(0.13)`, panel `0.17`, card
  `0.21`, popover `0.235`); light is a soft grey page with white cards. Theme switches on
  `html[data-theme]`, with Explorer's no-flash init script.
- **Primary is ink and paper**: the highest-contrast neutral (`--primary`), never a colour. This is our
  "one confident accent": one ink pill per view.
- **Livepeer green** (`--green-bright #40bf86` dark / `#1e9960` light, `--green-fill`) is non-interactive
  only: live dot, "finished" pulse, positive deltas, selection, caret. Never on a button or link.
- **Type**: Inter Variable (`cv11`, `ss01`) for interface text; Geist Mono for code, ids, prices and
  technical labels. Sizes 12/16 caption, 14/20 body, 26/32 page title.
- **Logo**: the instance's own marks from `logo` in the instance config, drawn by `BrandSymbol` / `BrandWordmark`; with `tint` on (the default) in `currentColor` (black or white). The flagship's are Livepeer's, in `apps/web/public/brand/`. With no logo, the name is set in type.
- **Icons**: lucide (Explorer's set), 1.75 stroke; a few custom morphing glyphs (see 3).
- **Spacing**: 4px rhythm. Chart series colours 1–7 for the console.

## 2. What we looked at, and what we take from each

| Piece | Date | Taken from it |
|-------|------|---------------|
| Stageshow | 2026-10-31 | The rule we hold every screen to: reads as a real product, simplified to what the viewer needs, and *every motion has a cause*. Real words only where the story is. Numbers roll only the digits that changed. A result *flies to where it will live*. Radii 6/8/10/12/pill, 34px fields, 40–80ms stagger, dark depth = lighter surface + 1px ring. No sparkles or purple to signal generation. |
| Drawesome | 2026-07-29 | A control surface that **changes shape instead of swapping panels**. Opinionated defaults: the default is the version you ship. A dark floating pill for tools. |
| Layout Mode / Agentation 2.0–3.1 | 2026-02 → 09 | The agent is a first-class user: MCP, HTTP API, SSE, statuses with timestamps. Popovers ask one thing and offer one primary action. Tooltips wait ~850ms then are instant. |
| Liveline | 2026-02-16 | Live numbers never jump: everything eases toward the new value together. Loading is a breathing line that *becomes* the chart. Features are opt-in. We use the MIT package for stream health and console charts. |
| Morphing icons | 2026-01-13 | Icons transform, never crossfade (send ↔ stop, play ↔ pause, plus ↔ close). |
| Honkish | 2025-05-23 | Presence made tangible (arrival, partial attention), a tray's tint carries meaning (destructive = red), delight as "little big details". Used for Live mode and character calls. |
| Family Values | 2024-07-08 | The three principles and the tray rules (below). |
| family.co | earlier | Ink pill primary + tinted pill secondary; friendly illustration held to marketing moments. |

**What changed since Family, and where we follow the newer direction.** (a) Earlier work is mobile trays and
springs; everything since 2026 ships **CSS curves and interpolation, not spring physics** — so our defaults
are his curves (`cubic-bezier(0.19, 1, 0.22, 1)` 220–360ms; exits ~40% faster than entrances) with Motion
springs kept for layout and shared-element moves only. (b) Delight has moved from illustration and confetti
toward **restraint and causality**; we keep illustration out of the product and spend delight on state
changes. (c) Controls **morph in place** more than they open sheets; our composer does this, and sheets are
kept for multi-step, transient tasks. (d) Agents are designed for explicitly, which matches our brief.

## 3. Our system (decisions beyond the anchors; logged in `design-proposals.md`)

- **Radii**: controls are pills; fields and chips 12; cards 20; composer and sheets 28; media 16.
- **Depth**: layers by lightness plus a hairline ring; shadows only on things that float.
- **Density**: user app 44px controls, 16/24 body; console 32px controls, 13/18 body, same tokens.
- **Motion tokens**: `ease-out-expo` (0.19, 1, 0.22, 1); enter 240ms, exit 150ms; press scale 0.97 (text
  buttons) / 0.92 (round); panels arrive with scale 0.97 + 6px + 4px blur; stagger 50ms; layout spring
  `stiffness 420, damping 36`. `prefers-reduced-motion` swaps movement for a 120ms fade.

## 4. The three principles, applied

**Chat (home).** *Simplicity*: one composer, one ink send button; starting points are categories that
reveal example prompts in place — they fill the composer, they never send. Video parameters (ratio,
duration) appear as chips only once the request is a video. *Fluidity*: the composer is one object that
travels from the centre of the home screen to the foot of the conversation; send morphs to stop; an agent
step expands from its own row; a gallery tile opens from its thumbnail. *Delight*: the finished video
settles with a single green pulse and the credit balance rolls only its changed digits.

**Studio.** *Simplicity*: one draft, one Generate button with its cost beside it; mode (Frames /
References / Edit) reshapes the same card instead of switching panels; advanced settings live behind one
"more" popover. *Fluidity*: pressing Generate sends the draft's summary flying to the stage where the result
will live; the placeholder breathes, then the same tile resolves into the video — no spinner replaced by a
result. Media types slide in the direction of the tab order. *Delight*: going live and a finished render are
the two marked moments; everything else is quiet.

**Operator console.** Same tokens, denser. *Simplicity*: each view answers one question (what did it cost,
who is over budget); one primary action per view; writes are fill in → review → result in a tray whose tint
carries the stakes. *Fluidity*: rows expand in place into detail; totals ease to new values with the chart;
filters morph the table rather than reload it. *Delight*: almost none — reserved for a first grant funded
and a clean `doctor` run.
