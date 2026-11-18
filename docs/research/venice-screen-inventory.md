# Venice screen inventory

Walked signed in (free plan, 0 credits) in Chrome on 2026-11-17, desktop width ~1490px. Read-only: no media
was generated, no settings were changed, nothing was purchased.

**One deviation from read-only, for the record.** On the agent home screen I clicked the "Create AI Video"
suggestion chip expecting it to reveal example prompts. It instead sent the one-line message "I'd like to
create an AI video." to the agent, which answered with a six-question intake card. No media was generated
and no credits were spent (balance stayed 0). The conversation it created is still in the account's chat
history. After that I did not click any suggestion chip.

**Not reachable on this account** (free plan, no credits, nothing generated): the character creation form
(opens the plan upsell), a populated library, a populated chat history, generation results and their
action bars, a running agent job with tool steps, the mobile layout (the Chrome window could not be
resized below the screen width). Items in those areas are marked *(inferred)* below.

## 1. Global shell

- **Left rail, icon-only, ~68px.** Top to bottom: logo (→ `/chat`), Search (opens a modal), Agentic Chat
  `/chat/agent`, Studio `/studio`, Discover `/discover`, Minds `/minds`, More (…), then a divider and the
  user's *pinned* items (Classic Chat `/chat/classic`, Characters `/character-chat`; Library and API appear
  here once visited or pinned). Avatar at the bottom opens the account menu. Tooltips on hover; the active
  item gets a filled rounded-square background.
- **More menu** (popover from the rail): Classic Chat (pin toggle), Library ("New" badge), Characters (pin
  toggle), API, Token Dashboard. Pinning moves an item into the rail.
- **Account menu** (popover from avatar): name + credit balance, Purchase Credits, Upgrade plan, Backup &
  Restore Chat History (locked on free), Settings (opens a modal, not a route), Help & feedback ▸, Learn
  more ▸, Sign out.
- **Search**: centred modal, "Search chats…", list of conversations with a "New Conversation" row first.
- **Content area** is a single rounded panel inset from the window edge; the rail sits on the darker window
  background.
- A support-chat launcher floats bottom-right on every screen.
- Header patterns: section title top-left with an icon, section tabs centred (Studio media types, API tabs,
  Minds tabs), credit balance pill and a primary action top-right.

## 2. Home / Agentic chat — `/chat` → `/chat/agent`

- Full-bleed looping background video (dark water) behind a centred column: logo mark, one-line headline,
  composer, four suggestion chips, and a footer link to classic chat. "Use Classic Chat" link top-left.
- **Composer**: multiline input with rotating placeholder examples; attach (file/image) button; a mode/model
  dropdown labelled "Agent"; dictate (mic) button on the right that becomes send/stop.
- **Agent model dropdown**: Auto (recommended) and a short list of text models, each with a one-line
  description and privacy badges (Private / Anon), "Retiring soon" tags, and a credit icon on paid models.
- **Suggestion chips**: Learn about the World, Generate any image, Create AI Video, Surprise Me. A chip
  *sends a canned message immediately* (see deviation above).
- **Conversation view**: user bubble right-aligned; agent turn left with an avatar, a collapsible
  "Worked for 2s · 1 step" disclosure that expands into a vertical timeline (Thought for 2s → reasoning
  text with "Show more" → Done), then the reply. Message actions under the reply: copy, regenerate, edit,
  delete. New-chat button top-right. Composer docks to the bottom with an upsell link above it.
- **Agent intake card**: for an under-specified request the agent renders an inline questionnaire —
  "Question 1 of 6", a segmented progress bar, a required textarea, Skip (with a dropdown) and Next ↵.
- *(inferred)* Tool calls (image/video generation, web search) appear as further steps in the same
  timeline, and results render inline as media cards.

## 3. Classic chat — `/chat/classic`

- Centred composer on an empty canvas; "Try Agentic Chat" link top-left; **New chat** split button
  top-right whose caret opens Normal Chat (saved in the browser) / Temporary Chat (not saved).
- **Composer controls**: `+` Actions menu, settings (sliders) popover, model selector, dictate, send.
- **Actions menu**: Attach Image/Document, Edit Image, Upscale Image, Remove Background, Create Video w/
  Image, Generate Audio, Style Reference.
- **Attach to chat dialog**: tabs Uploads / Generations, camera capture, Upload, multi-select with an
  "Attach (n)" confirm. Generations are the user's own library outputs — this is how media moves from the
  library back into chat.
- **Settings popover**: Web Enabled (toggle, expandable for provider), URL Scraping, Automatically Enhance
  Prompt.
- **Model selector** (popover): search, favourites filter, filter, sort; media tabs **Text / Image / Text to
  Video / Image to Video / Video to Video**; "Auto" pinned first; rows with provider glyph, name, discount
  tag, privacy badge (Private / Anon / Uncensored), credit icon, lock for plan-gated models; footer
  "View all models". Picking an image or video model turns the chat into a generator for that medium.

## 4. Studio — `/studio/*`

Header: "Studio" title, a centred icon segmented control for the five media types, credit balance pill,
"Sessions" dropdown (list of studio sessions with `+`; empty state "No sessions yet"), and Export in the
movie editor.

### 4.1 Image — `/studio/image`
Centred composer on an empty stage. Controls inside the composer: style reference (image), Image Settings
popover (Hide Watermark — plan-locked, Automatically Enhance Prompt, Advanced Settings ▸ seed/format/etc.,
Reset), Aspect Ratio (1:1 …), Image Style picker, Generate Multiple Images (variants), model selector,
send. Results fill the stage above/around the composer *(inferred)*.

### 4.2 Edit — `/studio/edit`
Stage with "Select an asset to start editing" + Select Image. Right panel is an accordion: **Edit** (browse
source thumbnails, prompt 0/1500 with enhance, style, settings, variants, model, Edit button), **Mask
Editing**, **Doodle**, **Reference**, **Crop and Reframe**. A dismissible notice offers the classic editor.

### 4.3 Audio — `/studio/audio`
Mode chips above a centred composer: **Music** (prompt 0/4096; audio settings, genre styles, duration,
model; cost shown next to send), **Voice** (text-to-speech 0/5000; voice picker, reference audio, model),
**Voice Changer** (upload or record speech; settings, voice, model; mic button), **Sound Effect**.

### 4.4 Video — `/studio/video` (the "new composer", beta)
- **Left column, ~380px**: a stack of numbered **drafts**. Each draft card has a title ("Video draft"),
  duplicate and delete, and a three-way mode switch:
  - **Keyframe** — First Video Frame and Last Video Frame drop slots, then the prompt.
  - **Multi-reference** — a row of Reference slots (images and videos), then the prompt; placeholder
    explains what the selected model supports.
  - **Edit Video** — Source Video slot, Image Guidance slot, then "Describe how you want to edit…".
  Prompt box has a 0/2500 counter and an Enhance prompt button. Below: **model selector row**, then chips
  for **Resolution** (720p/1080p), **Aspect Ratio** (16:9, 9:16, 1:1), **Duration** (5s/10s/15s), a `⋮`
  popover (Video Settings: Negative Prompt), and the **credit cost** of the draft at the right.
  In Edit Video the ratio and duration chips become "Auto".
- **Footer of the column**: full-width **Generate** button (shows the credit glyph) and a `+` to add another
  draft; several drafts can be queued.
- **Right stage**: empty state card ("Your Stage Awaits") centred; results appear here *(inferred: a grid
  or feed of generation cards with progress, then playback, download, reuse)*.
- **Video model picker** (large popover): search, favourites, filter/sort (Sort by Featured/Name;
  capability filters with counts: Text to Video, Image to Video, Edit Video, References, Keyframes, Audio,
  Private, Uncensored). ~65 rows: family glyph, name, capability summary line, discount tag, badges.
- "Switch to classic" reverts to the previous composer layout.

### 4.5 Movie Editor — `/studio/movie-editor`
A non-linear editor: left tool rail (Media, Text, Transitions, Subtitles), media library panel with
All/Video/Image/Audio filters and Add media, preview canvas with zoom and aspect selector, transport bar
(split, trim, delete, play controls, timecode, undo/redo, timeline zoom), multi-track timeline, Export.

## 5. Discover — `/discover`
Hero carousel of featured "experiences" (templated video/photo recipes) with autoplaying preview, title,
one-line pitch and a CTA ("Star in it" / "Use my photo"). Below: category chips (All, Star in It, Bring a
Friend, Pets, Photo Play) and a card grid. Opening one (`?trend=slug`) shows a large modal: preview video
on the left; on the right, named input slots (e.g. You, Driver (optional)), a Quality selector that names
the model and resolution, a rights notice, and Generate (or Buy Credits when short).

## 6. Minds — `/minds`, `/my-minds`, `/my-minds/earnings`, `/minds/:slug`
A marketplace of user-built agents ("custom experience designed for a specific purpose"). Tabs: Mind
Market, My Minds, Earnings; search; New Mind. Market page: online count, featured carousel, Top Categories
tiles (~20 categories with counts), All Minds grid (avatar, name, description, privacy + Premium badges).
Detail page: banner, avatar, author, category, badges, New Chat, favourite, report, share, long
description. Chatting with a Mind uses the agent chat UI at `/chat/minds/:slug`. First visit shows an
explainer modal.

## 7. Characters — `/character-chat`, `/character-chat/public`, `/c/:slug`
- Landing: title + explainer, **My Characters** (a `+` tile; creation is plan-gated) with a sync button,
  **Public Characters** avatar grid with total count and See All.
- Public list: search, sort (Featured, Highest Rating, Number of Ratings, Number of Imports, Most Recent),
  filters popover (Model, Web Search Enabled, Mature Content, Show descriptions, Columns), large portrait
  cards with a quick Chat button.
- Detail: portrait with import count and star rating, name, author and date, tagline, hashtags, "Start
  with a prompt" (a scene-setting line + message box), Start chat, Share, then Ratings/reviews.
- *(inferred)* Create/edit form: name, avatar, description, persona/system prompt, model, voice, web
  search, mature flag, visibility.
- No voice or video call with a character exists in Venice.

## 8. Library — `/library`
Tabs **Uploads** / **Generations**; camera capture and Upload; empty state with Upload. *(inferred)* Grid of
media with open, download, delete, send to chat/studio. No content search, tags or descriptions.

## 9. API — `/settings/api`, `/settings/api/keys`, `…/models`, `…/playground`
Tabs Overview / Keys / Models / Playground; header actions Purchase Credits, Resources, **New API Key**.
A collapsible **Quick Start** sits above every tab (1. generate a key, 2. base URL + copyable curl,
3. docs links).
- **Overview**: balance breakdown (total, plan credits, USD, plus token-specific buckets), auto top-up
  status, a usage table with a range selector (7/30/90 days, today, MTD, last month) and grouping (by
  model, by key), featured models with copyable model ids and context sizes, rate-limit tier, redeem promo
  code.
- **Keys**: list with empty state; create key flow.
- **Models**: type chips with counts (All, Text, Agentic, Image, Video, Audio), search, "Newest releases",
  cards with name, copyable id, capability icon.
- **Playground**: Chat / Image / Audio modes, model selector, optional API key field, and a code panel
  with cURL / Python / JavaScript / Body tabs and copy.
- No MCP instructions, no real-time or video-understanding playground, no example apps.

## 10. Settings (modal)
Left list in three groups; right pane scrolls.
- **Profile**: referral banner, account (name, Manage Account, Connect wallet, API), public username,
  profile image toggle, plan upsell card.
- **General**: version; Mature Filter toggle (+ optional PIN); Early Access toggles (new edit studio, new
  video composer); Chat Behaviour (start as temporary, show message date, Enter submits, arrow-key nav,
  Enter after edit: Regenerate/Fork, language); Privacy (end-to-end encryption for supporting models,
  external link warning, model privacy warning, content moderation warning, disable telemetry, hide
  personal information); Voice (narration, push to talk); Theme (System/Light/Dark, nine theme colours,
  disable background animation).
- **Storage and Limits**: remaining free-tier quota per kind with reset time (Chat, Image, Web Scrape);
  local storage meter; Delete app data; chat persistence; revoke media consents.
- **Billing**: current balance + Purchase; auto top-up (threshold, amount, payment method); payment
  methods; invoice history; redeem promo code.
- **Usage**: pay-per-use confirmations (separately for agentic and classic chat: confirm video / image /
  audio generations, allow premium image models); usage history table.
- **Text**: preferred model, web search + provider choice, URL scraping, reasoning, custom system prompts,
  advanced (disable built-in system prompt, context usage, temperature, top-p with lock toggles).
- **Image**: preferred model, style, aspect ratio (7 presets), hide watermark, auto-enhance, seed, format
  (WEBP/PNG), embed EXIF, reset.
- **Video**: preferred model, duration, aspect ratio, resolution, variants stepper, negative prompt,
  completion notifications, hide outro.

## 11. Credits and plans
- **Add credits** dialog: balance, plan-upgrade nudge, four packs ($10 → 1,000 credits … $100 → 10,000;
  100 credits per dollar), custom amount, card form.
- **Upgrade plan** full-screen sheet: Monthly/Yearly switch (save 10%), three tiers (Pro, Pro+, Max) with
  feature lists; higher tiers add monthly credits and credit banking.
- Credit cost is shown at the point of use (next to Generate), and pay-per-use confirmations are settings.

## 12. Privacy model as presented
Per-model badges: **Private** (no retention, run on their own/contracted GPUs), **Anon** (proxied to a
third-party provider with identity removed), **Uncensored**. Chats are stored in the browser, not on their
servers. Temporary chats. An opt-in E2EE setting for models that support it.

## 13. Main flows
1. Prompt → agent plans/asks → generates → result in chat → *(inferred)* open in studio / save to library.
2. Classic chat → pick a medium via model selector or Actions → generate inline.
3. Studio → pick medium → compose (mode, slots, prompt, model, parameters) → cost shown → Generate →
   result on the stage and in Library ▸ Generations.
4. Library/Generations → attach to chat or edit in Edit studio / movie editor.
5. Discover → pick a recipe → fill slots → generate.
6. Characters → browse/import → start chat with an opening prompt.
7. Credits: see balance in header → Add credits or Upgrade plan.
8. API: create key → copy quick-start → try in playground → watch usage.

## 14. Things we will not carry over
Token features (Token Dashboard, staking, DIEM/VVV balances, wallet connect, "Ignore DIEM"), referral
"Invite & Earn", the social feed profile, Minds *earnings*, the support-chat launcher, Venice's names,
copy, mark, background footage and model-badge wording.
