# Benji Taylor: design research notes

Researched 17 November 2026. Sources are his own site and essays, the Family marketing site, and the source code of his public repositories (Agentation, Liveline, Drawesome, and the Stageshow skill). Everything below is paraphrased; numeric values are taken from the cited files or measured from the live pages. Where a value is an estimate from a screenshot it is marked "(est.)".

How to use this file: sections 1 to 5 describe what he does and why. Section 6 turns it into original recommendations for our three surfaces. Section 7 lists what to avoid and what must not be copied. Section 8 is the source list.

Who he is, briefly: born in London, based in Los Angeles. Founded Los Feliz Engineering, which made Honk (a real-time messaging app) and Family (a self-custody crypto wallet for iOS). LFE was acquired by Aave Labs, where he was CPO; he then led design at Base, and is now Head of Design for X at SpaceX. He co-runs Dip (interface tools, with Dennis Jin, Alex Vanderzon and Paco Coursey) and maintains Agentation, Liveline, Drawesome and the Stageshow agent skill.

---

## 1. The Family Values essay

Source: https://benji.org/family-values (8 July 2024). Read in full.

### Framing

The essay is explicitly not a tutorial. It explains how a complex product (a crypto wallet with hundreds of possible paths) was made to feel welcoming. Three principles emerged from team discussion and early iterations, and he presents them in this order with these jobs:

| Principle | Its job | His sub-heading for the implementation |
| --- | --- | --- |
| Simplicity | Makes the product accessible | Gradual revelation |
| Fluidity | Keeps the experience continuous | Seamless transitions |
| Delight | Builds a connection with the person | Selective emphasis |

He frames all three as forms of respect for the user's time, intelligence and experience. Utility, performance and security are treated as table stakes that the essay deliberately does not cover. He also says plainly that this approach cost launch speed, and that the team accepted that trade.

### 1.1 Simplicity, through gradual revelation

The problem he names: complex products show every feature all the time. The alternative: keep the fundamentals within reach and let everything else appear when it becomes relevant, so newcomers are not overwhelmed and experienced users lose no power. Onboarding was the hardest case because of its many branches and edge cases.

The mechanism is the **dynamic tray system** (he credits the Craft app as part inspiration). The rules he gives:

- **What a tray is.** A container that expands, contracts and adapts to what the user does. It behaves like a condensed version of the app with its own constraints.
- **How trays start.** Always from a user action: tapping a button or icon, or opening a push notification. A tray can sit on top of any screen as a standalone layer, or grow out of another component such as a button.
- **Each tray in a sequence has a different height.** This is a deliberate constraint so that every step is visibly a change. The team sometimes rewrites copy or adjusts a tray's design purely to make the height differ.
- **Fixed header.** Every tray has a short title that names its function, plus one icon. The icon closes the tray if it is the first one, and steps back if the tray is part of a sequence.
- **One thing per tray.** Either one piece of content (for example an explanation of a term) or one primary action (for example a checklist to complete before a transaction).
- **Theme follows context.** Inside a dark flow the tray is dark.
- **Trays versus full screens.** Trays are for transient things that do not need to stay on display: confirmations, warnings, short explanations. Full screens are for content that persists. A tray may also be the first step of a longer flow that then grows into a full screen.
- **Context is kept.** A tray overlays the current screen instead of replacing it, so the user never loses where they were. His example is the swap approval, which unfolds from the swap screen itself; even the first-time tutorial for that feature is folded into the same tray.
- **Compactness is a signal.** A small surface tells the user the task is small. Long flows are broken into steps that each feel manageable, without the commitment of a full-screen takeover.
- **No limit on content type or step count,** provided each tray keeps to one focus.

His metaphor is seeing a room through a doorway: you get a glimpse from a distance and the detail arrives as you approach. The interface unfolds as you act, so you see where you are going while you go there.

### 1.2 Fluidity, through seamless transitions

His definition: the whole app is one continuously changing space in which any element may turn into another, provided there is a good enough reason. Moving through it should feel like floating through water. Every animation has an architectural purpose, which is to show the path from A to B. The app is treated as having physical rules that are never broken. Internally the team's shorthand for this was a rule against static transitions, and he argues that motion applied well can feel as fast as no motion while being clearer.

Techniques and examples, in his order:

1. **Onboarding as a moving stack.** After the splash screen a stack of cards animates to map out the journey, showing both where the user is heading and that another choice would lead elsewhere.
2. **Direction-aware tab switching.** Tapping a tab to the left moves the view left, and the reverse for the right. In his words: "We fly instead of teleport."
3. **Morphing glyphs.** In a multi-step flow the close icon becomes a back chevron as the screen changes, so the icon itself explains the navigation.
4. **Text morphing on buttons.** A label changing from Continue to Confirm is animated, using the letters the two words share, so the user notices that the next press is the significant one.
5. **Counting labels.** When adding wallets from a list, the number and wording on the button update smoothly as each one is selected.
6. **No redundant animation.** If a component is on screen and will still be there in the next state, it stays as the same object; it never duplicates or re-enters. Wallet cards travel between screens as themselves (a shared-element transition).
7. **Partial text updates.** In empty states, only the words that change are animated; the unchanged part of the sentence stays put. He treats this as the same idea as the button label morph, applied to anything that travels between screens.
8. **Trays join in.** Trays morph into full screens, buttons glide across trays, buttons become trays and return.

He stresses that a fluid interface is the sum of very many small decisions (he corrects his own count upward by an order of magnitude in a margin note), that one good transition does not make an interface fluid, and that the work is tedious.

He then shows the same interactions with the motion removed:

- **Swap approval.** Without the unfold, the tray loses its link to the swap screen.
- **Wallet grouping.** Addresses visibly sort themselves into groups by seed phrase. Without the motion the result is abrupt and the intent unclear.
- **Price charts.** Using another finance app as the contrast, he argues smooth chart motion makes an app feel faster.
- **Send flow.** The entered amount travels from the entry screen into the confirmation, so the user can see that what they typed is what will be sent.

Two loading and status techniques close the section, and they matter most for us:

- **The spinner travels to where the result will live.** After a transaction is confirmed, the spinner moves into the bottom navigation and settles on the Activity tab, showing where the pending item can be found.
- **A follow-up action lands on its parent.** Speeding up a pending transaction moves that action's spinner into the original pending tray, showing the change applied to that item.

The essay's opening illustration of fluidity is a single status pill that changes in place from an analysing state to a safe or warning state: one object, with its colour, icon and label morphing.

His argument for why this matters is trust. Smooth, consistent motion reassures the user that the app understood them; a glitchy animation in a banking app makes him doubt it will carry out the action correctly.

### 1.3 Delight, through selective emphasis

Delight is defined as making software feel human and responsive, and valuing how someone feels while using it. Two preconditions:

- **Polish must be even.** Delight can only be added anywhere if the baseline is high everywhere. Rarely used features get the same care; a neglected corner makes the whole product feel unfinished (his analogy is an expensive restaurant with a dirty bathroom).
- **Delight is rationed by frequency.** He draws a curve (he names it the Delight-Impact Curve and credits Rauno Freiberg's related idea): the potential for delight rises as a feature is used less often, and falls for features used constantly, because a special moment wears out with repetition. Intensity varies; nothing is left without care.

Examples, grouped by how often the feature is used:

| Frequency | Feature | What happens |
| --- | --- | --- |
| Rare | Creating a wallet | An interactive animation that marks the occasion |
| Rare | Backing up a wallet | Confetti fills the screen briefly as a reward for a security task |
| Occasional | Moving tokens to the trash | Items tumble into a skeuomorphic bin, with a sound on completion |
| Occasional | First use of the in-app browser | An animated arrow in the empty state points at creating a tab |
| Occasional | Reordering tokens | Smooth drag and drop with stacking animations (he credits Things) |
| Occasional | Stealth mode | A soft shimmer over hidden balances, signalling they still update |
| Occasional | QR code screen | Tapping makes a ripple; swiping turns the dots into a sequin-like shimmer. Hidden in plain sight, found by accident |
| Frequent | Scrubbing a price chart | The direction arrow flips as the numbers change |
| Daily | Sending tokens | Only small things: thousands separators slide into position as digits are typed |
| Daily | Sending more than the balance | A small surprise when the amount exceeds what is available |

The rule to take from the table: on a daily action the delight is a detail that helps (the moving comma keeps the number readable); on a rare action it can be a moment. Surprise is a tool, used where a feature is seen often enough to be discovered and seldom enough not to grate. He notes entertainment is a side effect, not the aim, though it can bring an occasional user back.

---

## 2. Observable visual qualities

### 2.1 His own site (benji.org)

Measured from the served CSS (`/_next/static/css/a4d51f91eeccf2ca.css`, `7d964f8148235f88.css`) and the live page.

**Layout and density**
- Single column, max width 36.375rem (582px), centred, 5rem top padding (2rem on mobile). Articles cap at 70ch.
- Spacing scale as tokens: 0.5, 1, 1.5, 2, 2.5, 3, 3.5rem (8 to 56px in 8px steps).
- A fixed 8rem fade at the top of the viewport, built from a 13-stop eased gradient to the page colour, so content dissolves as it scrolls under.
- Scrollbars are 6px, invisible until hover.

**Colour**
- Page `#fdfdfc` (warm off-white, not pure white). Ink `#111`. Secondary text is the ink at 40% (`rgba(0,0,0,.4)`), with 65%, 50%, 30% steps for other roles.
- Hairlines `#f2f2f2` and `#ededed`. A short 50px rule is used as a section marker instead of a full-width divider.
- One accent blue (`#3e9fff`, with a Display-P3 override) and one secondary orange (`#f09637`). Link blue `#2480ed`. On the page itself these appear only in links and a few highlights.
- Selection `#ededed` on `#111`. A yellow marker highlight (`#fef9c0`, bottom 45% of the line) and a multiply-blended `#ffa` flash that fades over 5s on an anchored target.

**Type**
- Inter (variable) for everything. Body is 14px, weight 460, line height 20px, tracking -0.09px. He uses in-between variable weights throughout: 430, 460, 550, 560.
- Page title 19px / 500 / -0.3px. Section headings 15px / 600 / -0.13px. Article h2 14px / 560. Small caps-style label 12px uppercase at 40% opacity with slightly positive tracking.
- Emphasis switches family: italic Newsreader at 15px / 430 with optical size 10. Hand-written annotations use a custom script face. Code is SF Mono at 0.9em on a 4%-black rounded chip (radius 4px); code blocks are `#f8f8f8`, radius 8px, 13px text at 1.55 line height.
- Headings use `text-wrap: balance`.

**Depth**
- Almost no shadows on the page. The one floating control (a 40px round button) uses `0 2px 8px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.04)` plus an inset 1px ring at 6% black.
- Overlay token: white at 80% with a 1rem backdrop blur, and a shadow made of a `0 0 0 1px` ring plus six layers, each only 1 to 4% black, with shrinking offset/blur pairs (26/54, 16/32, 10/16, 5/8, 2/4, 0/2px). Depth comes from many faint layers, never one dark one.
- Demo cards in essays are a white surface with a 1px hairline border and about 12px radius (est.), on the off-white page.

### 2.2 Family (app, as shown in the essay videos, and family.co)

Family app, from stills of the essay's embedded recordings (values are estimates at phone scale):
- **Tray.** White surface, very large corner radius (about 32 to 36pt, est.), inset from the screen edges by about 16pt and floating above the home indicator instead of touching the bottom edge. The screen behind is dimmed, not blurred.
- **Tray header.** Title left in a semibold of about 19pt; a small circular grey close button (about 30pt) right; a hairline under the header.
- **Tray body.** Either muted grey explanatory text, or a short stack of option rows. Rows are filled light-grey rounded rectangles (about 12 to 14pt radius) with an outline icon and a medium-weight label, not divided list rows.
- **Destructive option.** Same row shape, tinted pale red with red text and icon.
- **Buttons.** Fully rounded pills. A grey secondary and an accent-blue primary sit side by side at equal height at the bottom of a tray.
- **Status pill.** Tinted background at low saturation with a saturated icon and label in the same hue (the green all-clear state).
- **Step progress.** A row of short dashes at the top centre of a flow, the current one in accent blue.
- **Selection.** A filled blue circle with a white check on the right of the row.
- **Colour.** White and near-white surfaces, dark grey ink, one blue for actions. Saturated colour is reserved for the user's own objects (wallet cards in soft blue, pink, gold and so on) and for status.

family.co, from inline styles in the served HTML:
- Fonts: Inter, plus custom faces named "Family" and "LFE Sans" for display.
- Palette tokens: page beige `#FBFAF9`, light grey `#f2f0ed`, heading `#343433`, body `#494440`, muted `#848281`. Action blue `#3784F4` (also `#1A88F8`, app blue `#018DFF`). Supporting hues for illustration only: green `#44C67F`, yellow `#FFBE4C`, orange `#FF5310`, purple `#9553F9`, pink `#F966AC`. Every colour has a Display-P3 override.
- Warm neutrals throughout: greys lean brown, never blue.
- Type sizes cluster at 15 and 17px for text, 44 and 68px for display; weight 500 dominates; tracking is always negative and scales with size (-0.09px at small sizes to -1.35px at display).
- Radii: 8 and 12px for cards and controls, 32 and 40px for large panels and device frames, pills for buttons.
- Shadows: `0 1px 6px rgba(0,0,0,.04), 0 0 24px rgba(0,0,0,.05)`; borders as inset 1px rings in the light grey.
- Illustration: phone mock-ups as the main imagery, plus a set of flat, rounded, emoji-like spot illustrations in the supporting hues with a brown-grey outline colour (`#B2A79A`).

### 2.3 Agentation (toolbar and docs site)

From `package/src/components/page-toolbar-css/styles.module.scss`, `annotation-popup-css/styles.module.scss`, `switch/`, `checkbox/` and `package/example/src/app/globals.scss`.

- **Toolbar.** A 44px-high pill, radius 22px, `#1a1a1a`, white icons at 85% opacity. Controls are 34px circles inside 5px padding (a code comment notes this keeps the end controls concentric with the pill), 6px gap. Collapsed it is a 44px circle; expanded it is 297px wide (337px with a server connected).
- **Shadow.** `0 2px 8px rgba(0,0,0,.2), 0 4px 16px rgba(0,0,0,.1)`.
- **States.** Hover is a 12% white fill and full-white icon. Active is the accent colour for the icon with a 25% tint of the same colour behind it (`color-mix`). Disabled is 35% opacity. Focus ring is 2px accent with a 3px offset.
- **Badge.** 18px high, radius 9px, 10px / 600 text, accent fill, `0 1px 3px rgba(0,0,0,.15)` plus an inset 1px ring at 4% white.
- **Markers.** 22px accent circles with an 11px / 600 number; multi-select markers are 26px rounded squares (radius 6px) in green.
- **Popup.** 280px wide, radius 16px, padding 12px 16px, `#1a1a1a`, shadow `0 4px 24px rgba(0,0,0,.3)` with a 1px ring at 8% white. Text field radius 8px on 5% white. Action buttons are pills (radius 16px), 12px / 500, padding 6px 14px.
- **Settings panel.** Radius 16px, min width 205px, 13px text, 1px ring instead of a border. Edges carry 16px gradient masks so sliding pages fade at the sides.
- **Small controls.** Switch 24x16px with a 12px thumb. Checkbox 14px, radius 4px, 1px border at 20% ink.
- **Accent choices.** Seven hues that match Apple's system colours, each with a P3 variant: indigo `#6155F5`, blue `#0088FF`, cyan `#00C3D0`, green `#34C759`, yellow `#FFCC00`, orange `#FF8D28`, red `#FF383C`. Only one is the accent at a time; green, red and yellow otherwise mean status.
- **Docs site.** Same language as benji.org: `#fdfdfc` page, `#333` body, Inter at 13 to 15px with weights 450, 500, 550, a 36rem column, dotted hairline rows for key-value tables, a script wordmark, a small left navigation in muted grey.
- **Docs select menu** (`components/Select/Select.module.css`): trigger 34px high (30 small, 42 large), radius 10px (8 / 12), 1px border; menu radius 11px, 5px padding, 30px rows, border `rgb(0 0 0 / 8%)`, shadow `0 2px 4px #00000005, 0 8px 24px #0000000a, 0 24px 56px #0000000d`. Touch targets grow to 44px on coarse pointers.

### 2.4 Liveline (chart)

From `src/theme.ts`, `src/Liveline.tsx`, `src/draw/*.ts`.

- A single accent colour generates the whole palette: line at 2px; area fill from 8% (light) or 12% (dark) of the accent down to 0; dashed current-value line at 40%; grid lines at 6% ink; axis labels at 30 to 40% ink.
- Momentum is always semantic and separate from the accent: green `#22c55e`, red `#ef4444`, with 18% glows.
- Chart text is 11px SF Mono; the large value overlay is 20px / 500 mono with -0.01em tracking.
- Live dot: 6.5px surface-coloured disc with a soft 6px shadow and a coloured centre, plus a 1.5px ring that expands from 9 to 21px.
- Value badge: a pill (10px horizontal, 3px vertical padding, 16px line) with a small curved tail pointing at the line; a quieter white variant exists.
- Time-window switcher: 11px labels, a 2 to 3px padded track, radius 4 to 6px or full pill, with a sliding highlight at 3.5% black or 6% white.
- Default multi-series colours: `#3b82f6`, `#ef4444`, `#22c55e`, `#f59e0b`, `#8b5cf6`, `#ec4899`, `#06b6d4`, `#f97316`.
- Dark background is `rgb(10,10,10)`; tooltip is 95% opaque surface with a 1px border at 8 to 10%.
- No chart frame, no axis lines, no legend box. Edges fade over 40px.

### 2.5 Stageshow kit tokens (his stated defaults for product UI)

From `stageshow/kit/stage.css` and `stageshow/references/craft.md` in `benjitaylor/skills`. These are the nearest thing to a published design-system spec from him.

- **Radii:** 6px (menu row, segment thumb, small button), 8px (field, segmented track, large button), 10px (popover, toast), 12px (window), 999px (badges, chips). Rule: an outer radius equals the inner radius plus the padding between them.
- **Control heights:** field 34px, menu row 26px, button 28px (24 small, 32 large), button padding 12px (9px on a side that holds an icon), icon 14px, gap 6px.
- **Neutrals (light):** canvas `#f6f5f4`, surface `#fff`, ink steps as black at 4, 6, 8, 10, 15%, text `#7a7a7d`, strong text `#262628`, faint `#9a9a9d`, lines at 6% and 4%.
- **Neutrals (dark):** canvas `#111113`, surface `#1a1a1d`, raised `#26262a`, well `#0a0a0b`, ink steps as white at 5, 7, 10, 13, 20%, text `#9d9da1`, strong `#ececee`, lines at 8% and 5%.
- **Status:** soft tint backgrounds at 10 to 18% with a darker (light theme) or lighter (dark theme) text of the same hue.
- **Shadows (light):** card `0 1px 2px rgba(0,0,0,.04)`; window `0 0 0 1px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.08)`; floating `0 0 0 1px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.12), 0 12px 32px rgba(0,0,0,.08)`. Every elevated surface pairs a 1px ring with its shadow.
- **Dark depth:** his rule is that on dark themes depth comes from a lighter surface, not a shadow. Dark shadows keep only the 1px white ring (8 to 10%).
- **Written rules worth adopting as-is:** five inks and one accent; no redundant tonal borders (try the fill alone first); status colours mean status only; 11 to 15px UI text; one type family, with monospace only for code, identifiers and aligned numbers; sentence case; hierarchy from spacing and one weight step; words keep a 12px inset from any edge; row padding 12px, 8px for dense lists; gaps of 8 to 12px, never edges 1 to 3px apart; one icon family, one stroke weight, one size (14 to 16px) per view; icons at 14px and below are filled; a filled button's hover is one step of its own colour, never a swap to grey; a trigger keeps its pressed look while its popover is open; one number per view gets to be big; no sparkle, wand or purple as a stand-in for machine intelligence.

### 2.6 Summary of the visual sensibility

- Quiet, warm neutrals; one accent; saturated colour only for the user's own content and for status.
- Small type (13 to 15px) set with unusual care: intermediate weights, slightly negative tracking, a serif italic for voice.
- Pills and circles for controls; 6 to 12px radii for dense desktop UI; 16px for floating panels; 32px and up for mobile trays and hero cards.
- Hairlines and 1px rings instead of borders; stacks of very faint shadows instead of one heavy one; fills instead of outlines.
- Few elements per view, each aligned optically, with nested shapes kept concentric.
- Outline icons at 1.5 to 2px stroke for navigation, filled at small sizes; icons built from few strokes so they can morph.
- Illustration is flat, rounded and friendly, used sparingly; the product's real objects are the imagery.

---

## 3. Motion specifics

### 3.1 Libraries

- **Family (iOS):** native. The essay does not name a framework.
- **His web prototypes and docs sites:** Framer Motion / Motion. `package/example/package.json` in Agentation pins `framer-motion ^12.43.0`; the morphing icons post names Motion (motion.dev) as the tweening engine. The docs site wraps it in a small `Height` helper that animates from 0 to measured content height with opacity (`package/example/src/components/Motion.tsx`).
- **Shipped packages:** no animation library at all. Agentation's toolbar header comment states it is the CSS-only version, and a `usePanelPresence` hook keeps a panel mounted until its real CSS transitions finish (`package/src/hooks/use-panel-presence.ts`). Liveline drives everything from one `requestAnimationFrame` loop. Drawesome uses CSS transitions.
- Takeaway: a motion library appears in his prototypes and docs sites; what he ships is mostly decelerating cubic-bezier curves with short durations, and interpolation toward a target for live data. No spring stiffness or damping values were found in any of the public code.

### 3.2 Easing curves he reuses

| Curve | Character | Where, and duration |
| --- | --- | --- |
| `cubic-bezier(0.19, 1, 0.22, 1)` | Expo-out. His default "smooth" | benji.org `--ease-smooth` 300ms; family.co transforms 220ms; Agentation toolbar width and position 360ms, content scale 420ms; Drawesome `--ease-smooth` |
| `cubic-bezier(0.22, 1, 0.36, 1)` | Quint-out | Agentation icon stroke morph 300ms, marker entrance 250ms; text glyph motion 200ms; Stageshow button padding 220ms |
| `cubic-bezier(0.175, 0.885, 0.32, 1.1)` | Slight overshoot, "snappy" | benji.org `--ease-snappy` 220ms; Drawesome |
| `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Larger overshoot, "swift" | benji.org `--ease-swift` 800ms |
| `cubic-bezier(0.34, 1.56, 0.64, 1)` | Back-out, clear overshoot | Agentation popup entrance 200ms; theme icon 350ms |
| `cubic-bezier(0.34, 1.2, 0.64, 1)` | Back-out, mild | Agentation toolbar entrance 500ms; badge entrance 300ms after a 400ms delay |
| `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Quad-out | Agentation shared panel motion, 160ms in and 120ms out |
| `cubic-bezier(0.2, 0.8, 0.2, 1)` | Quick settle | Agentation annotation card 200ms; select menu 160ms; Stageshow button press 180ms |
| `cubic-bezier(0.16, 1, 0.3, 1)` | Expo-out for height | Accordions via `grid-template-rows`, 250 to 300ms |
| `cubic-bezier(0.32, 0.72, 0, 1)` | iOS-sheet-like | Agentation settings back button 120 to 180ms |
| `cubic-bezier(0.22, 0.9, 0.16, 1)` | Long settle | Drawesome bar morph: width and height 520ms, radius 440ms, position and scale 540ms |
| `cubic-bezier(0.4, 0, 0.2, 1)` | Standard in-out | Liveline segmented highlight slide 250ms |
| `cubic-bezier(0.45, 0, 0.1, 1)` and `cubic-bezier(0.25, 0.8, 0.25, 1)` | Travel, and arrival from nowhere (0.8 to 1s) | Stageshow `references/motion.md`, for storytelling motion only |

Plain `ease` at 100 to 200ms is used for colour, opacity and background changes everywhere.

### 3.3 Durations by job

- Hover and colour: 100 to 150ms. Tooltip fade 135ms.
- Press feedback: 100ms transform.
- Small panel in: 160 to 200ms. Out: 100 to 150ms. Exits are consistently faster than entrances (settings panel 200ms in and 100ms out; popup 200ms in and 150ms out; shared panel 160ms in and 120ms out; select menu 160ms in and 100ms out).
- Layout change of a container (width, height): 360 to 540ms on an expo-out or long-settle curve.
- Glyph and text morphs: 200 to 300ms.
- State set by a click (selected tool, active filter): fades in over about 150ms and out the same.
- Colour change between distant hues: about 200ms.
- Page entrance: 500ms.
- In-app touch responses in his phone demos: 500ms on `cubic-bezier(0.3, 0.75, 0.1, 1)`.

### 3.4 Press, hover and scale values

- Round 34px icon button press: `scale(0.92)`.
- 40 to 44px floating round button: hover `scale(1.05)`, press `scale(0.95)`.
- Text button press: `scale(0.97)`, with the note that the label must not shift inside it.
- Marker hover: `scale(1.1)`, with its tooltip counter-scaled to 0.909 so the text does not grow.
- A select trigger deliberately does not scale on press, because its resting bounds anchor the menu; shrinking it would make the menu jump on release (`Select/README.md`).
- A dragged card: scale 1.03, a deeper shadow and 1 to 2 degrees of tilt, the whole card including its text; it settles flat on drop.

### 3.5 Blur, opacity and scale crossfades

He rarely fades alone. Things arrive with a small scale, a small offset and a blur together:

- Shared panel (`package/src/styles/_panel-motion.scss`): from opacity 0, `translateY(4px) scale(0.98)`, `blur(2px)`, origin at the corner nearest its trigger.
- Settings panel: exit to `translateY(8px) scale(0.95)`, `blur(5px)`.
- Annotation popup: `scale(0.95) translateY(4px)` with a back-out curve.
- Toolbar controls when the pill collapses: opacity 0, `blur(6px)`, `scale(0.4)`; out in 140ms, back in over 240 to 420ms as the pill widens.
- Toolbar first appearance: `scale(0.5) rotate(90deg)` to rest over 500ms.
- Drawesome panels: outgoing content goes to `blur(8px) scale(0.86)`; incoming delays its opacity and blur by 60ms while its scale starts with the container, so content never reaches full size inside a bar that is still widening. A code comment explains that opacity and blur run on separate timings on purpose.
- Menu surface: `scale(0.96)` and opacity only, opacity linear over 80ms.
- Tooltip: `scale(0.95)` to 1.
- Icon swaps (copy to check, send): two stacked glyphs crossfade with `scale(0.8)` over 150 to 200ms (`icon-transitions.module.scss`).

### 3.6 Stagger patterns

- benji.org home entrance: each block rises 8px and fades over 500ms, 50ms apart, capped after the ninth item; sections and footer follow at 450 to 550ms. It plays once per visit, not on return navigation.
- Stageshow guidance: 40 to 80ms between items of a group in reading order (default 60ms); 80 to 120ms between tiles of a grid; a reverse stagger about 70ms apart when undoing; a column of status words changing together should cascade about 60ms apart, because a unison change reads as flicker.
- Text glyphs: incoming characters are spread across 30% of the duration.

### 3.7 Text and number motion

From `package/example/src/app/components/TextMotion/model.ts` (the download counter on agentation.com):

- Default duration 200ms on the quint-out curve.
- Per character: enters from `y: 0.35em, scale: 0.6, rotate: 2deg, blur: 0.1em, opacity: 0`; leaves to the same pose mirrored upward (`y: -0.35em`). Direction flips with the sign of the change, so a rising number rolls one way and a falling one the other.
- Per word: `scale: 0.94, blur: 0.08em`, no vertical travel. For shared runs: `scale: 0.9` and opacity only, no stagger.
- Unchanged glyphs are kept as the same nodes and slide to their new x position; only changed glyphs animate. Leaving glyphs finish in 40% of the duration when the handoff is a clear.
- A hidden "ruler" copy of the text holds layout width while the painted glyphs are absolutely positioned.
- A simpler cycle label elsewhere drops in from 6px above over 200ms; a renumbered marker slides in from the left over 200ms.

From the morphing icons post: every icon is drawn with exactly three SVG lines; icons that need fewer collapse the spare lines to an invisible point at the centre; any icon can then tween into any other. Icons that are the same shape rotated (four arrows, four chevrons, plus and cross) rotate as a group instead of interpolating coordinates, which he found looked warped. A plain crossfade was rejected because it fades and does not transform. The Agentation toggle uses the same idea in pure CSS: three strokes rotate and scale into a cross over 300ms, with non-scaling stroke width.

### 3.8 Live-data interpolation (Liveline)

From `src/math/lerp.ts` and constants at the top of `src/useLivelineEngine.ts`.

- **Frame-rate independent lerp.** `factor = 1 - (1 - speed)^(dt / 16.67)`, then `current += (target - current) * factor`. Delta time is clamped to 50ms.
- **Speeds (fraction per 60fps frame):** line and value 0.08 (plus up to 0.2 adaptive boost when far behind); Y range 0.15; badge Y 0.35; badge width 0.15; scrub fade 0.12; momentum colour 0.12; series toggle 0.10; candle bodies 0.25.
- **Range rule.** The Y range eases toward its target but snaps outward at once when a value would clip. Margin is 12% of the visible range.
- **Window change:** 750ms, cosine ease, interpolated in log space so zooming feels even.
- **Line to candlestick morph:** 500ms; candle width change 300ms; a wrapper crossfade between chart types is 300ms.
- **Pause:** progress eases at 0.12; on resume the chart catches up at 0.08, or 0.22 when far behind.
- **Live dot pulse:** every 1500ms a ring grows for 900ms, alpha 0.35 to 0, and is suppressed while scrubbing.
- **Momentum:** compares the last 5 points against 12% of the range of the last 20; one arrow fully fades out before the other fades in.
- **Value overlay:** written straight to the DOM each frame, bypassing React; its colour transitions over 300ms.
- **Reduced motion:** targets are applied without interpolation.

### 3.9 Loading that becomes the result (Liveline)

From `src/draw/loading.ts`, `loadingShape.ts`, `draw/index.ts`.

- The loading state is a slowly drifting wavy line: three summed sine waves, amplitude 7% of chart height, drawn in the accent colour at an alpha that breathes between 0.14 and 0.30 over a 2.4s cycle.
- It is drawn by the same spline routine and the same sample density as the real line, so at the moment data arrives there is no shape difference to hide.
- A single `reveal` value eases from 0 to 1 (0.09 per frame forward, 0.14 in reverse). The line morphs from the wave to the data as it rises. Other parts join on staged ramps of that one value: grid and time axis from 15 to 70%, live dot from 30%, badge from 25 to 50%, momentum arrows from 60%, pulse after 60%, particles after 90%.
- The same path runs backward into the empty state, which shows a message over the wave.

### 3.10 Layout animation techniques

- Height via `grid-template-rows: 0fr` to `1fr` with an `overflow: hidden` inner wrapper (annotation popup accordion).
- Height via measurement and animate (the `Height` helper on the docs site).
- Width via explicit pixel widths on a transitioning container, with contents cross-fading inside (toolbar; Drawesome bar).
- A control that appears inside a row opens its own width and margin together (send button: width 0 to 34px, negative margin to 0, opacity and scale 0.8 to 1, all 360ms), so neighbours move continuously.
- Sliding sub-pages inside a fixed panel: 24px horizontal shift with opacity over 200ms, with edge gradients so content fades at the sides instead of being cut.
- Presence: keep the node mounted, flip a data attribute, wait for `getAnimations()` to finish before unmounting; reversing mid-transition continues from the current value.
- `@starting-style` for first-paint entrance of the menu.
- Rules from `stageshow/references/motion.md`: a resizing surface moves size, position and content as one transition and never stretches its text; nothing pops in or out; a moving edge must not slice through readable text (fade content while the height moves); a dashed border is faded, never resized; a popup is sized before its first frame and never corrects while opening; an open surface stays pinned to the edge it opened from; after a motion ends nothing moves again.

---

## 4. Interaction patterns

**Trays and sheets.** See 1.1 for the rules. In practice: a floating rounded surface over a dimmed screen; one title, one close-or-back icon; one task. Moving between steps changes the tray's height while old content leaves and new content arrives inside the same surface. The dismiss icon morphs to a back chevron on later steps. Emil Kowalski published a web recreation (linked from the essay); his page is an interactive demo and its code was not readable from the page, so no values are quoted from it here.

**Stacking.** Trays do not pile up as overlapping cards. A sequence is one surface that resizes, and "back" reverses the resize. A tray may hand off to a full screen by growing into it.

**Popovers and menus.** Small, radius 10 to 16px, 1px ring plus soft shadow, scale from 0.95 to 0.98 toward the trigger corner, with a touch of blur. The trigger keeps its hover or pressed look while open. Menus fade their scroll edges with a mask instead of showing a hard cut.

**Expanding panels.** The Agentation toolbar is the model: a circle that widens into a pill, its contents un-blurring and scaling up as it grows; on collapse the contents leave faster than the container shrinks. Drawesome goes further: one bar changes shape into a palette, a pair of sliders, or a minimised disc, instead of opening separate panels.

**Morphing buttons.** A button whose meaning changes stays the same element; its label morphs using shared letters, its width eases, and an icon slot opens its own width when an icon arrives. His kit rule: never swap in a second button for the new state.

**Status pills.** One pill moves through states (working, safe, warning) by changing tint, icon and word in place.

**Number tickers.** Digits roll individually, direction follows the sign of the change, unchanged digits stay still, and the number has a reserved slot so neighbours do not jiggle. Separators slide to their new position as digits are typed. A centred amount centres its digits, with the currency sign hung outside.

**Toasts and transient feedback.** In Family, feedback tends to travel to where the result lives (the spinner flying to the Activity tab) instead of appearing as a detached toast. In his kit, toasts and pills arrive whole from just above, radius 10px. A timed notification in Honk showed its remaining time as an animated border.

**Validation.** A 250ms horizontal shake of 3px then 2px on the popup when submitted empty.

**Empty states.** A sentence in which only the variable words animate; a single animated pointer toward the first action; Liveline's drifting line with a short message. Never a blank panel.

**Hover and press.** Hover is a faint inset rounded fill (4 to 12% of ink), never an outline. Press is a small scale (0.92 to 0.97). Focus is a 2px accent ring with offset. Tooltips wait 850ms the first time, then appear instantly for the rest of the session once one has been shown.

**Selection indicators.** A highlight that slides between segments or tabs (250ms), not one that blinks from one to the next.

**Drag.** Free-drag of the toolbar follows the pointer with no transition; only the automatic correction back inside the viewport eases (360ms). Reordering uses lifted cards (scale 1.03, tilt, deeper shadow) and neighbours that make room continuously. In Honk, a slider's thumb changed expression with its value.

**Keyboard.** Single-key shortcuts while a tool is open (Agentation: L, P, H, C, S, X; Escape to close), disabled while typing, and shown in tooltips.

**Sound and haptics.** Used in Honk and Family for completion moments (the trash sound, arrival and departure sounds), tied to specific interactions.

---

## 5. Agentation and Liveline

### 5.1 Agentation

- **What it is.** A React component that overlays a running web app so a person can click elements, select text, drag over areas and attach notes, then hand the result to a coding agent as structured Markdown (selectors, source paths, component tree, computed styles, the note). An MCP server lets agents read, answer and resolve annotations. Made by Benji Taylor, Dennis Jin and Alex Vanderzon. Site: https://www.agentation.com (agentation.dev redirects there). Repo: https://github.com/benjitaylor/agentation. Licence is PolyForm Shield 1.0.0, not MIT.
- **How it looks.** A dark 44px pill in the bottom-right corner with round icon controls and a count badge; numbered accent markers on the page; a small dark popup with a text field and two pill buttons; a compact settings panel above the toolbar. Details in 2.3.
- **How it behaves.** Opens from a circle to a pill with the contents un-blurring. Hovering page elements draws a 2px accent outline at 50% with a 4% fill that scales in from 0.98 over 120ms, with a name tooltip. Clicking drops a marker (250ms scale-in) and opens the popup with a slight overshoot. Markers preview their note on hover and renumber with a small roll when one is removed. A pause control freezes page animations so a mid-transition frame can be annotated. The toolbar can be dragged anywhere. Detail level cycles through four settings with a label that drops in and a column of three dots showing position.
- **What is transferable.**
  - A single floating pill as the home for a tool's controls, which widens only when in use and shows a count badge when collapsed.
  - Concentric geometry (34px circles in a 44px pill with 5px padding).
  - Active state as a tint of the accent, not a filled block.
  - Numbered markers that tie comments to places, for frame or region notes on generated media.
  - "Warm" tooltips (850ms first, then instant).
  - The presence pattern: CSS transitions own the motion, a small hook owns mounting.
  - Exits faster than entrances.
  - The workflow idea itself: point at the thing instead of describing it. For us, pointing at a frame, a region or a moment in a clip is a better way to ask for a change than prose.

### 5.2 Liveline

- **What it is.** A real-time chart for React drawn on one canvas with no dependencies beyond React 18. It needs two props: the data array and the latest value. Line, candlestick and multi-series modes. MIT. Post: https://benji.org/liveline. Repo: https://github.com/benjitaylor/liveline.
- **How it looks.** A 2px line in one accent with a faint gradient beneath, a pulsing dot at the live edge, a dashed line from the dot to a value pill on the right axis, sparse grey mono labels, no frame. Details in 2.4.
- **How it behaves.** The line never jumps: every value, the axis range, the badge and the grid labels ease toward their targets together so the chart moves as one object. Sparse updates still look continuous. The range snaps outward only when needed to avoid clipping. Hovering scrubs with a crosshair and dims the live end. Changing the time window zooms over 750ms. Loading is a breathing wave that becomes the line. Pausing freezes the view while data keeps buffering, then catches up. Optional extras (momentum arrows, an order-book stream, particles and shake) are off by default.
- **What is transferable.**
  - Use it, or its approach, for any live number in the operator console: jobs per minute, queue depth, spend, node health, stream bitrate in Live mode.
  - The frame-rate independent lerp for any live numeric display, including counters outside charts.
  - One accent derives the whole chart palette; up and down colours stay semantic.
  - Loading, empty and data are one continuous object with a reversible reveal.
  - Staged reveal off a single progress value (shape first, then grid, then dot, then badge).
  - Direct DOM writes for per-frame values so React does not re-render at 60fps.
  - Opt-in decoration: the default is calm.

### 5.3 Also relevant

- **Drawesome** (https://benji.org/drawesome, MIT): a drawing toolbar whose single bar morphs between tools, palette, sliders and a minimised disc. The best public reference for a composer that changes mode by changing shape.
- **Stageshow** (https://benji.org/stageshow, MIT, in `benjitaylor/skills`): a skill that teaches agents to build product demos. Its `references/motion.md`, `craft.md` and `choreography.md` are his most explicit written rules on motion and layout craft and are quoted (as values) throughout this file.
- **Honk** (https://benji.org/honkish): the source of his playful side. Live typing with bubbles that grow and shrink, presence shown through avatar borders, physics-based emoji, custom typefaces for UI and for chat, a full custom sound set, and deliberate slowness at a few moments to give them weight.

---

## 6. Translating this to our product

These are original recommendations in the spirit of the above. They use our semantic tokens (background, card, muted, primary, border, destructive) and assume dark by default. Token names below are suggestions.

### 6.0 Shared foundation

**Motion tokens**

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.19, 1, 0.22, 1)` | Default for anything that moves or resizes |
| `--ease-out-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | Glyph, text and small-element motion |
| `--ease-pop` | `cubic-bezier(0.34, 1.2, 0.64, 1)` | Small things that arrive (badge, chip, marker). Never on panels or text |
| `--ease-panel` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Popovers, menus |
| `--dur-instant` | 100ms | Hover, colour |
| `--dur-fast` | 160ms | Popover in, state fills |
| `--dur-exit` | 110ms | Any exit |
| `--dur-base` | 220ms | Text morphs, icon morphs, small moves |
| `--dur-layout` | 380ms | Width and height changes of a container |
| `--dur-morph` | 520ms | A surface changing what it is (queue item to result, composer mode) |
| `--stagger` | 50ms | Between siblings, capped at 8 items |

If we use Motion for layout animation, the spring equivalents are: layout `{ type: "spring", duration: 0.4, bounce: 0 }`; small arrivals `{ duration: 0.3, bounce: 0.2 }`. Keep bounce at 0 for anything containing text. These spring values are our choice, not measured from his code.

**Shape tokens**

- Radii: 8px (rows, small buttons), 10px (fields, menus), 14px (cards, media tiles), 20px (floating panels, composer), 28px (mobile trays), full (pills, icon buttons).
- Nested radius rule: outer = inner + padding. A 20px composer with 6px padding holds 14px tiles.
- Heights: 28px dense control, 34px default control, 44px primary and touch.
- Press: 0.97 for text buttons, 0.92 for round icon buttons, none on a control that anchors an open menu.
- Elevated surfaces on dark: one step lighter fill plus a 1px ring of foreground at 8%. Add shadow only for surfaces that float over media.
- Entrance recipe for any floating surface: opacity 0 to 1, `scale(0.97)` to 1, `translateY(4px)` to 0, `blur(3px)` to 0, origin at the trigger. Exit is the reverse in `--dur-exit`.
- Reduced motion: keep opacity changes, drop transforms and blur, apply live values without interpolation.

### 6.1 (a) Chat-centred home with a video-first prompt composer

1. **The composer is the one elevated object on the page.** A 20px-radius surface, one step lighter than the page, 1px ring, centred at a comfortable reading width. Everything else on the home screen (suggestions, gallery) is flat. On first load the page blocks rise 8px and fade over 500ms, 50ms apart, once per session.

2. **The composer grows with the request instead of opening dialogs.** Attaching a reference image or a clip adds a tile row inside the same surface: the surface height eases over `--dur-layout` on `--ease-out`, the tile arrives at `scale(0.9)` with 3px blur over `--dur-base`, 40ms after the height starts. Settings for video (duration, aspect, model) appear as a row of quiet pills only once the request is recognisably a video request. This is gradual revelation applied to a prompt box.

3. **A send button that changes meaning in place.** One round 34px button at the trailing edge. Empty: muted. With text: primary fill fades in over 150ms. While generating: the arrow rotates and reshapes into a stop square using the same strokes over `--dur-base`. Its tooltip label morphs with shared letters ("Generate" to "Generating"). Never mount a second button.

4. **Suggested prompts fly into the composer.** Suggestions are short pills, mostly video. Choosing one moves that pill's text into the input as a shared element (`--dur-layout`), and the remaining pills leave in a reverse stagger 40ms apart. The text the user sees in the composer is the text they tapped, so there is no doubt what will be sent.

5. **Home becomes a conversation without a page change.** On the first send, the composer travels from centre to the bottom of the viewport (`--dur-morph`, `--ease-out`), the gallery fades out during the first third, and the user's message leaves the composer upward as the same text node. The composer is never unmounted.

6. **A generation appears in the thread as a placeholder with the final aspect ratio.** The placeholder holds its size from the first frame so nothing below shifts. It carries a slow diagonal sheen (2.4s cycle, alpha between 0.04 and 0.10) and one status word that rolls between states ("Queued", "Rendering", "Finishing") with a per-character roll of 200ms. When the first frame is ready it cross-dissolves inside the same tile: the sheen fades over 300ms as the frame sharpens from `blur(12px)` to 0 over `--dur-morph`. The tile does not move or resize.

7. **Example gallery opens by expansion.** A gallery tile expands from its own position into the viewer (shared element, `--dur-morph`), and closes back to the same tile. Hover plays a muted preview after 200ms; the tile itself does not scale.

8. **Delight budget for this screen.** Sending is a many-times-a-day action, so the details are small and useful: digits in a credit estimate roll in the direction of change; the placeholder's status word morphs. Save one larger moment for the first completed video on an account (for example the tile lifts with a single soft pulse of the ring, 600ms, once ever).

### 6.2 (b) Media studio composer with mode switching and a generation queue

1. **Modes are one segmented control with a sliding thumb.** Text to video, image to video, edit, extend, Live. The thumb slides between segments over 250ms on `--ease-out`; the chosen label's colour fades over 150ms. Views below shift in the direction of travel: content exits 12px toward the side it is leaving and the new content enters from the other side, with opacity, over `--dur-base`. Left is left and right is right, always.

2. **The composer changes shape between modes; it does not swap.** Fields common to both modes (prompt, model, aspect) stay mounted and stay put. Fields unique to the new mode open their own height (`grid-template-rows` from 0fr to 1fr over `--dur-layout`) with their content fading in during the second half. Design each mode so the composer's total height differs, so the change is unmistakable.

3. **Advanced controls live in an anchored tray.** A parameter such as motion strength, seed or camera path opens as a compact panel anchored to its trigger: title left, one close icon right, one control. If it leads to a second step (choosing a preset, then tuning it), the same panel resizes and the close icon becomes a back chevron. On mobile widths the same content is a bottom tray inset 12px from the edges with a 28px radius.

4. **The Generate button carries the cost and confirms in place.** The label includes the credit estimate, whose digits roll as parameters change. If a run is unusually expensive, the label morphs to a confirm wording and the button widens (`--dur-base`), instead of raising a modal.

5. **Submitting sends the job to the queue visibly.** On press, a small chip (thumbnail of the reference, or the first words of the prompt) leaves the button and travels to the queue (`--dur-morph`, soft start, long deceleration), where a slot has already opened to receive it. The queue's count badge pops with `--ease-pop` over 300ms. The user learns where work goes without being told.

6. **A queue item is one object from request to result.** Each item is a tile with the output's aspect ratio. Queued: muted fill, status word. Running: the same breathing sheen as chat, plus a thin progress line whose value is eased with the frame-rate independent lerp at 0.08 so it never jumps or stalls visibly. Done: first frame resolves in place as in 6.1 item 6. Failed: the tile tints with the destructive token at 12%, the status word rolls to the reason, and a retry control opens its width inside the tile. No state ever replaces the tile with a different component.

7. **Results reorder with continuity.** When a job finishes, items change position with a layout animation (`--dur-layout`), carrying their neighbours; nothing teleports. Opening a result expands it from its tile into the main canvas; choosing "refine" sends its prompt and settings back into the composer as shared elements.

8. **Point at media to change it.** For edit and extend modes, let the user drop numbered markers on a frame or drag a range on the timeline, each with a short note, shown as a list beside the composer. Markers scale in over 250ms and renumber with a small roll. This is our own use of the pointing idea, with our own marker design.

Delight budget for the studio: generating is frequent, so keep to the travel chip and the in-place resolve. Rare moments that can carry more: first time going live in Live mode, first export, first saved look.

### 6.3 (c) Operator console (tables, stats, charts) in the same language

1. **Same shapes, tighter numbers.** Keep the family resemblance through radii, rings, pills and motion; change only density. Rows 36px with 8px vertical padding (user app lists are 48px or more), 13px text, 12px inset from every edge, control height 28px, card radius 10px, gaps of 8 or 12px. Use tabular figures and a monospace face only for identifiers, hashes and aligned amounts.

2. **One big number per card.** A stat card shows a label in muted 12px, one value at about 28px in medium weight, and a small delta pill (tinted status background with matching text). Digits roll when the value changes, in the direction of change, with unchanged digits still. The value has a fixed slot so the card never reflows.

3. **Live charts that glide.** Use Liveline or its method for jobs, spend, queue depth and node health: one accent line at 2px, faint fill, no chart frame, 11px mono axis labels, a live dot and value pill. Values ease at 0.08 per frame; ranges at 0.15 with outward snap; window changes over 750ms. Up and down colours stay semantic and separate from the brand accent so white-labelled instances remain legible.

4. **Loading is the thing itself, at rest.** A chart loads as a breathing line that becomes the data. A table loads as rows at the real row pitch with bars of varying width (for example 60, 45, 70, 52% of the column) in the same line boxes as the text they stand for; when data arrives, bars cross-fade to text per cell over 200ms, cascading 30ms per row for the first ten rows only. No spinners in the content area and no layout shift.

5. **Tables: fills, not grids.** No vertical rules; horizontal hairlines at 5 to 6% foreground. Hover is an inset rounded fill (radius 8px, 4% foreground). Sorting slides a small indicator and reorders rows with a 250ms layout animation up to about 50 visible rows, and swaps instantly beyond that. Status cells are tinted pills whose word rolls when a job changes state; when many change at once, cascade them 60ms apart.

6. **Detail without leaving the list.** Selecting a row opens a side panel that slides 16px with opacity over `--dur-fast`, keeping the table visible and the selected row marked. Inside the panel, sub-views (job, payments, logs) are steps of one surface with a back chevron, not stacked drawers. The panel's content swaps with a 200ms crossfade and an 8px rise while its frame stays fixed.

7. **Confirmations sit where the action is.** Changing a price, suspending a user or rotating a key opens a small anchored tray from the control that triggered it: one sentence, the consequence stated plainly, a cancel and a confirm. Destructive confirms use the destructive token as a tint, with a filled destructive button only on the final step. Exits at `--dur-exit`.

8. **Filters and bulk actions appear when relevant.** A filter added from a menu becomes a chip that opens its own width in the filter row. Selecting rows raises a compact floating pill at the bottom of the table (44px high, concentric round controls, a count that rolls), which widens as actions become available and collapses when the selection clears.

Delight budget for the console: close to zero in daily views. Reserve it for rare operator milestones (instance setup complete, first payout received), and keep even those brief.

---

## 7. What not to do, and what not to copy

### 7.1 Ways an implementation would miss the sensibility

- **Decorative motion.** Animating things that have no relationship to show. Every transition should answer "where did this come from and where did it go".
- **Bounce on everything.** Overshoot is for small, light objects (a badge, a marker). Panels, text and media settle without it.
- **Slow feedback.** Hover and press must respond within 100 to 150ms. Only storytelling and layout motion gets longer durations.
- **Entrances and exits of equal length.** Exits should be roughly a third shorter.
- **Fading alone, or popping.** Nothing should appear or vanish in one frame, and solid objects (cards, media) should arrive by moving or resolving, not by ghosting through 50% opacity.
- **Duplicating a persistent element.** If the composer, a tile or a header is still present in the next state, it must be the same node that stays or travels.
- **Whole-string or whole-number swaps.** Change only the characters that changed.
- **Spinners and blank panels.** Loading should be the result's own shape, at rest, in its final size.
- **Layout shift after motion ends.** Reserve the space first; after a transition nothing should nudge.
- **Heavy shadows and visible borders everywhere.** Use a lighter surface and a 1px ring on dark; try a fill before adding a border.
- **Accent overuse.** One accent, on actions and the current selection. Status hues only for status. No gradients or glows unless they carry meaning.
- **Stacked modals and full-screen takeovers for small tasks.** Use one resizing tray anchored to its trigger.
- **Uneven polish.** A beautiful home screen with a rough settings page or console breaks the effect. Rare screens get the same care.
- **Delight on daily actions.** Confetti on every generation would wear out in an hour. Scale intensity inversely with frequency.
- **Generic machine-intelligence decoration.** No sparkles, wands or purple gradients to signal generation; show what the product does.
- **Mixed icon sets or hand-drawn glyphs** with inconsistent stroke weights.
- **Monospace as a "technical" style** for labels and navigation in the console.
- **Ignoring reduced motion,** or implementing live values with CSS transitions that restart on every update instead of interpolating toward a target.
- **Applying one easing and duration to everything.** Choose by job.

### 7.2 Do not copy

Use the principles and the numeric craft; do not reproduce his artefacts.

- The Family tray as drawn: its exact proportions, header layout, option-row styling and backdrop treatment.
- Family's screens and flows: wallet cards and their colours, the onboarding card stack, the send and swap screens, the transaction status pill, the token trash can, the QR ripple and sequin effect, the stealth-mode shimmer, the wallet-creation animation.
- Family's and Honk's brand assets: logos, the "Family", "LFE Sans", "Honk Sans" and "Honk Chat" typefaces, spot illustrations, sounds, and marketing copy.
- benji.org's page design as a whole: the exact column, the hand-written annotation script face, the essay figure style.
- The Agentation toolbar's design and code. Its licence (PolyForm Shield) restricts reuse; treat the source as reference only. That includes its marker design, popup layout, settings panel, script wordmark and the TextMotion implementation on its site.
- Liveline's distinctive look when used outside the library (the tailed value badge, the degen particles). Liveline and Drawesome are MIT, so they may be used as dependencies with attribution; that is different from imitating their appearance in our own components.
- The Stageshow kit's components and example demos as product UI, and any third-party brand marks bundled with it.
- Demo videos, screenshots and diagrams from his essays, including the delight curve diagram.
- Specific word pairs and micro-copy from his examples; write our own.

---

## 8. Sources

**Essays and site**
- https://benji.org (home, bio, list of writing; CSS at `/_next/static/css/`)
- https://benji.org/family-values (Family Values, 8 July 2024)
- https://benji.org/honkish (Honkish, 23 May 2025)
- https://benji.org/morphing-icons-with-claude (Morphing icons with Claude, 13 January 2026)
- https://benji.org/annotating (Annotating for agents, 16 January 2026)
- https://benji.org/agentation (Agentation, 21 January 2026)
- https://benji.org/liveline (Liveline, 16 February 2026)
- https://benji.org/drawesome (Drawesome, 29 July 2026)
- https://benji.org/stageshow (Stageshow, 31 October 2026)

**Products**
- https://family.co (marketing site; inline styles inspected)
- https://www.agentation.com and https://www.agentation.com/features
- https://dip.org

**Source code read**
- https://github.com/benjitaylor/agentation
  - `package/src/components/page-toolbar-css/styles.module.scss`
  - `package/src/components/annotation-popup-css/styles.module.scss`
  - `package/src/components/page-toolbar-css/settings-panel/styles.module.scss`
  - `package/src/styles/_panel-motion.scss`
  - `package/src/hooks/use-panel-presence.ts`
  - `package/src/components/icon-transitions.module.scss`
  - `package/src/components/switch/styles.module.scss`, `checkbox/styles.module.scss`
  - `package/src/components/page-toolbar-css/index.tsx` (colour options)
  - `package/example/src/app/globals.scss`
  - `package/example/src/app/components/TextMotion/model.ts`, `TextMotion.module.css`
  - `package/example/src/app/components/Select/Select.module.css`, `README.md`
  - `package/example/src/components/Motion.tsx`, `package/example/package.json`
  - `package/example/src/app/colophon/page.tsx`
- https://github.com/benjitaylor/liveline
  - `src/useLivelineEngine.ts` (constants), `src/math/lerp.ts`, `src/math/momentum.ts`, `src/math/range.ts`
  - `src/theme.ts`, `src/Liveline.tsx`, `src/LivelineTransition.tsx`
  - `src/draw/loading.ts`, `src/draw/loadingShape.ts`, `src/draw/dot.ts`, `src/draw/badge.ts`, `src/draw/index.ts`
- https://github.com/benjitaylor/drawesome
  - `packages/draw/src/components/MorphBar.module.css`, `tokens.css`
- https://github.com/benjitaylor/skills (Stageshow)
  - `stageshow/references/motion.md`, `craft.md`, `choreography.md`
  - `stageshow/kit/ease.ts`, `kit/stage.css`, `kit/controls/Button.css`, `examples/loading/loading.css`

**Referenced by him, for further reading**
- https://emilkowal.ski/ui/family-tray-system (a web recreation of the tray; demo only, code not readable from the page)
- https://animations.dev (Emil Kowalski's course, cited in the essay's footnotes)
- https://rauno.me/craft/interaction-design (the frequency and novelty idea he credits)
- https://www.craft.do (cited as part inspiration for trays)

**Not accessed or not found**
- The Family iOS app itself. Observations come from the essay's recordings and the marketing site, so tray dimensions are estimates.
- Interviews, talks or podcasts about Family's design: searches returned none that could be verified.
- His posts on X and Instagram, where most of his component demos are published.
- Any Aave or Base design-system documentation attributable to him.
- honk.me was not inspected; Honk details come from his own retrospective.
