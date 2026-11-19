# Data sources

Every API client function, whether it is live or mocked, and what blocks the mocked ones. The map itself is
`packages/api-client/src/data-sources.ts`; `MOCK_ONLY=1` forces every function to its mock.

To switch a function from mock to live: implement it in `packages/api-client/src/live/`, branch on
`resolveSource()` in `src/index.ts`, set its entry to `"live"` in `data-sources.ts`, and update this table.

| Function | Source | Endpoint (used or planned) | Token | Blocked by |
|----------|--------|----------------------------|-------|------------|
| `listOfferings` | live | `GET /v1/offerings` | none (public) | — |
| `getCreditBalance` | mock | `GET /v1/allowance` → credits via markup rule | builder key | Needs a signed-in builder key (auth lands in slice a) and the markup rule. |
| `listShowcase` | mock | instance content (config or library) | — | No engine endpoint; instance-owned. |
| `listPromptStarters` | mock | instance content (config) | — | No engine endpoint; instance-owned. |
| `createGeneration` | mock | `POST /v1/jobs` with `mode: "async"` | builder key | Engine returns 501 for async jobs; no video generation capability is on the live network today. |
| `getGeneration` | mock | `GET /v1/jobs/{id}` + `GET /v1/jobs/{id}/result` | builder key | `/result` returns 501. |
| `listConversations`, `getConversation`, `createConversation`, `sendMessage`, `deleteConversation` | mock | instance-owned store + agent runtime calling `POST /v1/jobs` per tool step | builder key | No agent runtime yet; it depends on async jobs and results (501). The live `chat` capability can answer text turns once paid jobs are approved. A message's `agent_model` names the language model that runs the agent (the mock echoes it on the user message and its planning steps). A message's `character_slug` casts a character: the mock agent starts an `image-to-video` shot with the portrait as `first_frame` and echoes the cast on the user message; the real agent will pass the portrait as the job's image input, as an absolute URL or an upload, since the engine cannot read the app's relative paths. |

This table covers what is built so far. The full client is specified in `docs/architecture.md`.

## Added in slice (d)

| Function | Source | Endpoint (used or planned) | Token | Blocked by |
|----------|--------|----------------------------|-------|------------|
| `listMedia`, `deleteMedia` | mock | Instance-owned media store; descriptions and tags from a video understanding capability | builder key | No media store or understanding capability on the network yet. |
| `listAgentModels` | mock | Live: `GET /v1/offerings` plus each language app's runners (`describeApps`, reader token, server-side) | builder key + reader | Mock while the agent is: the model menu picks a model for the mock agent, so it lists the mock agent's models (`mock/agent-models.ts`, real open models with their published context sizes). Switch to live together with `createConversation` and `sendMessage`. The live path is built and tested. |
| `listCharacters`, `getCharacter`, `createCharacter` | mock | Instance-owned store | session | Needs the instance database (not built). |
| `getCreditBalance`, `getAccount`, `buyCreditPack`, `buyCredits`, `changePlan`, `getUsage` | mock, through the provider interface | `budgets.getAllocation` → `GET /v1/allowance?actor_id=`; plans and packs from the provider | reader / builder key | Batteries has no plans, packs, top-ups of the user's own amount (`buyCredits`, limits from `plans.getTopUpRange`) or per-user usage; PymtHouse isn't wired into the engine. The Batteries provider is implemented and unit-tested, but its write request bodies are not verified against a live admin key. |
| `listApiKeys`, `createApiKey`, `revokeApiKey` | mock | `GET/POST /v1/admin/keys`, `…/revoke` | admin token | The `.env` admin token is an actor key (403). |
| `getPreferences`, `updatePreferences` | mock | Instance-owned store | session | Needs the instance database. |
| `runCapability` | mock | `POST /v1/jobs` | builder key | Paid; needs a builder key and the owner's go-ahead. |

## Added in slice (e)

| Function | Source | Endpoint (used or planned) | Token | Blocked by |
|----------|--------|----------------------------|-------|------------|
| `analyseVideo` | mock | `POST /v1/jobs` against a video understanding capability | builder key | No such capability is on the network; paid. |
| `startLiveSession`, `updateLiveSession`, `stopLiveSession` | mock | `POST /v1/sessions` and its update and close calls | builder key | `POST /v1/sessions` returns 501 (engine request R2). |
| `getLiveHealth` | mock | `GET /v1/events` for the session | builder key | The events feed returns 501. |
| `listLiveLooks`, `saveLiveLook`, `listLiveDestinations`, `addLiveDestination`, `removeLiveDestination` | mock | Instance-owned store; stream keys sealed server-side | session | Needs the instance database. |
| `startCall`, `endCall` | mock | `POST /v1/sessions` against a real-time character capability | builder key | Sessions return 501; no avatar capability on the network. |
| `listExampleApps` | mock | Instance content | — | Instance-owned. |

## Operator console (slice f)

The map is `OPERATOR_DATA_SOURCES` in `packages/api-client/src/operator/index.ts`; the System page shows it.
Reads use `ENGINE_READER_TOKEN`; writes use `ENGINE_ADMIN_TOKEN`.

| Function | Source | Endpoint | Token | Notes |
|----------|--------|----------|-------|-------|
| `getEngineHealth` | live | `GET /readyz` | none | Verified against the running engine. |
| `listOfferings` | live | `GET /v1/offerings` | none | Verified. |
| `listJobs` | live | `GET /v1/jobs?limit=` | reader | Verified. No filter by state, app or actor (engine request R4). |
| `listActors` | live | `GET /v1/admin/actors` | reader | Verified. |
| `listAccessKeys` | live | `GET /v1/admin/keys` | reader | Verified. |
| `getCostSummary` | live | `GET /v1/costs/summary?start=&end=` | reader | Verified. |
| `listRunners` | live | `GET /v1/runners?app=` | reader | Names the model behind each app (`apps/web/lib/models.ts`, cached 5 minutes; media tools skipped): language models in the agent picker, the others in the studio picker and the agent's steps: `runnerModel` reads both live description shapes (`model.name` / `limits.context_tokens`, and `model_id` / `max_context`). The one user-facing read made with the reader token; it stays on the server and only model names and context sizes reach the page. Goes away when R1 lands. |
| `issueAccessKey`, `revokeAccessKey` | live | `POST /v1/admin/keys`, `…/revoke` | admin | Not verified: the `.env` admin token is an actor key, so the engine answers 403. The console says so. |
| `setActorStatus` | live | `POST …/allocation/status` | admin | Not verified, same reason. |
| `getOverview` | mock (derived) | jobs + cost summary | reader | Counts and wholesale cost are live; revenue is wholesale at the default markup until a provider reports charges. |
| `listComputeOperators` | derived from `listJobs` | — | reader | Live when jobs are live. |
| `setComputeOperatorBlocked` | mock | — | — | The engine has no allow or block list for routing. |
| `retryJob` | mock | — | — | No retry route. |
| `listPayments`, `refundPayment`, `getBillingSettings`, `updateBillingSettings` | mock | provider or card processor | — | Who collects payment is open question Q2. |
| `getCapabilitySetting`, `updateCapabilitySetting` | mock | instance-owned store | — | Needs the instance database. |
| Provider: grants, allocations, plans, credit packs (list, create, edit), usage, users | per `payments.provider` | see the provider interface | reader / admin | `mock` by default; `batteries` reads allocations and grants through the engine. |
| Instance settings | real | writes `instance.config.json`, validated | — | Read-only when the file is mounted read-only (the Compose bundle). |
| Doctor | real | probes engine and tokens | reader, admin | Same checks as `aquareum doctor`. |

## Instance API and MCP

`/api/v1/*` and `/api/mcp` call the same API client functions as the interface, so each operation is live or
mocked exactly as its function is above. `verifyApiKey` is mocked: user API keys are held in memory until
the instance has a database, and are checked against the engine's keys once sign-up provisions real ones.
