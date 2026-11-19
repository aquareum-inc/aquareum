# Engine requests and open questions

For Mike (engine maintainer) and the builder track. Each entry is either a proposed upstream change to
`livepeer-builder-core` or a question we need answered. We don't work around these by modifying engine code;
the app mocks the missing piece behind the API client until it lands.

Status values: `open`, `answered`, `landed`.

## Open questions for the builder track

| # | Question | Why it matters to this app | Status |
|---|----------|----------------------------|--------|
| Q1 | Should the app read usage through the engine, or from the payment provider directly? | Decides whether the provider interface's `usage` area calls engine routes or a provider SDK, and whose numbers the operator console's Costs and Users views show. | open |
| Q2 | Does the payment provider or this app collect payment from end users? | Decides whether Billing (payments, invoices, refunds, tax) is a provider integration or an app-owned integration with a card processor. Mocked until answered. | open |
| Q3 | Are attested secure-hardware compute operators planned, and how would a job be restricted to them? | The privacy page lists "Verified compute" as planned. We need to know whether to keep it, and what routing constraint the engine would expose. | open |

## Proposed upstream changes

Found during research (2026-11-17). Detail and evidence are in `docs/research/engine.md` (gaps section),
`docs/research/capabilities-and-discovery.md` §9 and `docs/research/payment-providers.md` §7.

| # | Request | Why the app needs it | Status |
|---|---------|----------------------|--------|
| R1 | Expose the runner envelope (model, wire profile, input schema reference) on `GET /v1/offerings`, or a public per-app detail route. | Discovery gives only an app name, modes, price and capacity. The models catalogue, the generic run screen and the capability-to-surface mapping need a kind, a description and an input schema. Until then the agent picker reads model names from `GET /v1/runners` with the reader token, and must parse two description shapes (the standard envelope, and an operator's own `model_id` / `max_context`). | open |
| R2 | Async jobs, job results, sessions and the events feed (`POST /v1/jobs` async, `GET /v1/jobs/{id}/result`, `POST /v1/sessions`, `GET /v1/events`) return 501. | Video generation, Live mode, character calls and progress updates are mocked until these land. | open |
| R3 | A "who am I" route that returns the caller's kind, application and actor. | The app must remember each token's kind itself, and learns an actor id from its newest job. | open |
| R4 | Filters, totals and cost on `GET /v1/jobs` (by state, app, actor); raise the 25-row cap on cost projections. | Operator Jobs and Costs views otherwise need one call per job and per actor. | open |
| R5 | One error envelope with a machine-readable `code` on every error. | 402 and 403 are ambiguous today; the UI cannot tell "out of credits" from "not allowed". | open |
| R6 | Published engine images or releases to pin against. | The self-hosting bundle must reference published images; today everything is built from Git contexts. | open |
| R7 | Clarify the reader credential: it is an `auditor` key scoped to one application and cannot read `GET /v1/admin/grants`. | The brief assumes a reader token covers every read-only operator view across builders. | open |
| R8 | Publish app names that are capabilities only, with the model as its own field (the SPEC's migration: `blueclaw/chat/qwen3.8-27b` → `chat` with model `qwen3.8-27b`, `live/flux-klein` → `live-video-to-video` with model `flux-klein`), and group offerings by capability, then model. | The composer lists models (the agent's language model) and the studio lists capabilities; today the app tells them apart by parsing names (`lib/capability-menu.ts`), and a plain `chat` hides which model serves it. | open |
| R9 | Let provisioning link an actor to the sign-in identity: an `external_id` (the identity provider's user id) and an optional `email` on the actor, set when the admin token creates it at sign-up, returned by `GET /v1/admin/actors` and filterable. | The operator console's Users view joins the identity provider's people to the engine's accounts by id. With no link stored on the engine, the actor id must equal the provider's user id, and accounts made outside sign-up show with no name or email. Settle this before sign-up provisioning is built. | open |

## Additional questions

| # | Question | Status |
|---|----------|--------|
| Q4 | The live network has no video generation capability today (no `text-to-video` / `image-to-video`; 26 apps, mostly utilities and live pipelines). Which capabilities should the first release assume? | open |
| Q5 | The running engine is commit `1514212` (2 Nov), 15 commits behind `v0.2.0`, and their `Runner` shapes differ. Which do we pin? | open |
| Q6 | Allocation balances are debited at wholesale cost, including jobs that failed after payment. Is a retail markup expected to be uniform, or does the app need its own ledger for per-capability prices? | open |
| Q7 | The reference console never holds an admin token server-side; writes use the signed-in operator's own key. Our brief asks for a server-held admin token for sign-up provisioning. Is that acceptable? | open |
| Q8 | Can the payment provider take a top-up of an amount the user types, and does it set its own minimum and maximum? The app offers "Other amount" beside the packs (mocked, behind the provider's `custom_top_up` feature) at the rate of the largest pack reached. If the provider only sells fixed products, this stays off. | open |
| Q9 | Do the payment provider's plans say which plan includes another, or only give each a flat feature list? The plan cards read "Everything in Studio, plus:" by ordering plans by price and dropping features the cheaper plan already lists. An explicit `includes` (or ordered tiers) would make that exact, including for plans that aren't a simple ladder. | open |
| Q10 | Are organisations or shared accounts planned for end users? Today every PymtHouse user, allowance, plan and API key belongs to one `externalUserId` (checked against the docs on 18 November 2026: user management, client model, billing, plans, API keys), and Clearinghouse has no users at all. Teams that share credits need a billing account several people belong to, with roles (owner, admin, member). Could PymtHouse hold that membership: a group with its own `externalUserId`, allowance, plan and keys, plus a member list and a role claim in the user's token? If not, the app needs its own membership store. See "Workspaces" in `docs/architecture.md`. | open |
| Q11 | Can an operator define one-off products in PymtHouse (a credit pack: a fixed number of credits for a fixed price), or only recurring plans? The console edits packs through `plans.createCreditPack` and `plans.updateCreditPack`, mocked today, with a highlighted flag (at most one) and an offered flag; packs are withdrawn, never deleted, so past purchases still name them. If PymtHouse has no such product, packs need to live in the card processor's catalogue instead, and the provider would read them from there. | open |
