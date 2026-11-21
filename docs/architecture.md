# Architecture plan

## Packages

```
apps/web                    Next.js host: routes, session, role guard, /api/v1, /api/mcp, /api/health
packages/api-client         Types, one function per operation (live + mock), data-source map, provider interface
packages/config             Instance config: JSON Schema, generated types, presets, loader, surface mapping
packages/ui                 Tokens, primitives, motion
packages/user-app           User-app screens (chat, studio, characters, library, models, developers, settings)
packages/operator-console   Operator screens
packages/cli                `livepeer setup | doctor | upgrade`
deploy/                     Compose bundle, platform templates
release.config.json         { org, repo, engine: { repo, ref } } — the one place the org and engine pin live
```

One host app, two screen packages. The user app and the operator console are separate packages that the host
mounts by config (`surfaces.app`, `surfaces.console`); a disabled surface's routes answer 404 and its
package is not loaded. One origin and one session keep self-hosting to a single container.

## Instance config

`instance.config.json`, validated against `packages/config/schema/instance.schema.json` (TypeScript types
generated from the schema). Environment variables hold secrets and the engine URL only.

```
name, logo { symbol, wordmark, tint }, theme { tokens... }            branding
engine { url }                                                  (overridable by ENGINE_URL)
surfaces { app, console, api, mcp, mobile }                     booleans; mobile is off in both presets
mobile { ios { bundleId, minimumVersion }, android { applicationId, minimumVersion } }   the apps built for it
capabilities { allow: string[], block: string[] }               glob rules on discovered app names
capabilityOverrides { [app]: { surfaces?, enabled?, label? } }
auth { provider: "mock" | "oidc", oidc { issuer, clientId } , signUp: "open" | "invite" | "closed" }
payments { provider: "batteries" | "pymthouse" | "mock" }
pricing { markup: { default: number, perApp: { [app]: number } }, creditsPerUsd: number }
content { characters: boolean, adultContent: boolean }
privacy { retainChats: boolean }
```

Presets: `full` (all surfaces) and `headless` (console + api + mcp, no user app; the console can be switched off). Capability rules are
independent of presets.

## Capability → surface mapping (`packages/config`)

Discovery gives `app` and `modes` only, so the mapping is rule-based on those, with per-instance overrides:

| Rule (first match) | Kind | Surfaces |
|--------------------|------|----------|
| `live-transcode`, `live-delivery`, `*/ffmpeg-live`, `*-publish` | stream support | Live mode output (not listed as a tool) |
| mode `persistent` and name contains `avatar` | real-time character | characters (call) |
| mode `persistent` | real-time session | studio Live |
| `*-understanding`, `transcription`, `translation`, `*-metadata`, `*-extract-frame` | understanding | chat, library |
| `text-to-*`, `image-to-*`, `video-to-video`, `image-edit`, `music`, `*-to-speech` | generation | chat, studio |
| `chat`, `*/chat/*` | language | chat |
| `*transcode*`, `*-scale-*`, `*-trim-*`, `*-merge-*`, `*-compose`, `*-loudnorm` | media action | library actions |
| anything else | unmapped | models catalogue + generic run screen, API, MCP |

Every capability, mapped or not, is in the catalogue, the API and MCP.

## API client

`createApiClient({ engine, tokens, provider, env })`. Each function has a live and a mock implementation
behind one signature, chosen by `DATA_SOURCES` (see `docs/data-sources.md`); `MOCK_ONLY=1` forces mock.
Results carry their source so dev mode can label screens.

Areas: `discovery`, `jobs`, `generations`, `sessions` (live), `conversations`, `library`, `characters`,
`keys`, `costs`, `operator.*` (actors, grants, allocations, keys, capabilities, compute, settings, system).

Tokens, least powerful first: builder key (user-app calls, from the sealed session), reader token (operator
reads), admin token (operator writes and sign-up provisioning). All server-side.

### Provider interface (`packages/api-client/src/provider`)

Uses the engine's terms; not coupled to one provider.

```
identity:  getSession, listUsers, getUser, setUserStatus, setUserRole
budgets:   listGrants, createGrant, fundGrant, getAllocation, provisionAllocation, topUpAllocation, getBalance
plans:     listPlans, createPlan, updatePlan, assignPlan, getUserPlan, listCreditPacks
usage:     listUsage, getUsageSummary
features:  supports { plans, allowances, invoices, oidc, ... }
```

Implementations: `batteries` (budgets and usage live through engine routes; plans and identity report
unsupported) and `mock` in PymtHouse's shape (plans, allowances, invoices, OIDC users). A credit balance is
the allocation balance converted by the markup rule; a credit pack is a one-off allocation top-up.

## Workspaces (planned, not built)

People often share one budget: a studio, an agency, a company. The plan is to make the billing account a
**workspace** rather than a person.

- **A workspace is the billing account.** In the provider it is one user (one `externalUserId` in PymtHouse,
  one actor on the engine), so it owns the allocation (the credit balance), the plan, usage and API keys.
  None of the provider's or engine's money model changes.
- **People are members.** Everyone gets a personal workspace at sign-up and can be invited to others, with a
  role: owner (billing and members), admin (keys and settings) or member (makes video, spends credits). The
  instance roles `user | operator` stay separate: they are about the instance, not a workspace.
- **The app acts in one workspace at a time.** The session holds the current workspace and its builder key;
  switching workspace switches the key. Jobs, the library and usage belong to the workspace, and each job
  records who ran it.
- **In the operator console,** Users lists people and the workspaces they belong to, and budgets, plans and
  top-ups move to the workspace.

**What is missing:** membership (who belongs to which workspace, with what role). Neither provider stores
it today: PymtHouse users, allowances, plans and keys are each one person's, and Clearinghouse has no users
(provider question Q10 in `docs/engine-requests.md`). If the provider takes it on, the app reads it through
the provider interface (`identity.listWorkspaces`, `listMembers`, `invite`, `setMemberRole`) like any other
function. If not, it needs a small store of its own. That holds membership only, never balances, so it isn't
a second ledger.

**Until then,** every workspace is a personal one with a single member, and nothing in the UI mentions
workspaces. New code should treat the billing account as the workspace's, not the person's, so adding
members later doesn't mean renaming it.

## Auth

OIDC-shaped interface (`getSession`, `signIn`, `signOut`, roles `user | operator`). The session is an
AES-256-GCM sealed, httpOnly, SameSite=Lax cookie keyed by `SESSION_SECRET`, holding the user id, role and
builder key. `BUILDER_API_KEY` is a dev shortcut. The mock provider and role switcher exist in dev only.
`/operator/*` is guarded in `proxy.ts` and again in the layout.

The native apps sign in through the same `/auth/start` and `/auth/callback`, opened in the system's auth
session with `client`, a PKCE `challenge` and their own `state`. The callback sets no cookie for them: it
redirects to `<bundle id>://auth` with a 60-second one-time code, only for an app named in the config's
`mobile` block. The app exchanges the code and its verifier at `POST /api/v1/auth/device` for a device session
(`aqd_…`, always the `user` role; a separate operator device session is planned in `docs/mobile/plan.md` §18), sent as a bearer token. Sessions live in `apps/web/lib/devices` behind a
`DeviceSessionStore` (a JSON file in `DATA_DIR` for now), stored as an HMAC keyed with `SESSION_SECRET`. They
end after 90 days unused, on sign-out or revocation, when the user is suspended, or when `SESSION_SECRET`
changes. With `surfaces.mobile` off, a device session gets 403 `mobile_off`. Sign-in addresses are built from
the configured domain, or else the address the request came in on, so a phone reaching a development server
at another address comes back to it.

State the instance keeps itself lives in `apps/web/lib/data`: a `StateStore` interface and a JSON file in
`DATA_DIR` behind it, until the instance has a database. Device sessions use it, and so does
`apps/web/lib/moderation`: reports of shared characters, what each person blocked, and what the operator took
down. Every character read (`list_characters`, `get_character`, the web's pages and Home's cast) filters
through `moderation().visible(userId)`; the console's Reports page decides reports.

## Self-hosting

`deploy/compose.yaml` references published images by `${REGISTRY}/${ORG}/...` tags read from
`release.config.json`: app, engine (pinned ref), Clearinghouse Batteries, node remote signer, discovery.
`livepeer setup --preset full|headless [--config file] [--json]` writes `.env` (generated secrets),
`instance.config.json` and starts the bundle; it is idempotent. `livepeer doctor` checks engine, provider,
config and keys, with exit codes. `livepeer upgrade` moves app and engine pins together. Because the engine
and Batteries publish no images today (engine request R6), the bundle builds them from pinned Git contexts
until they do, and mock-only mode needs neither. The app keeps its own state (device sessions) in the
`app-data` volume at `/data`.

## Live versus mocked (summary; full table in `docs/data-sources.md`)

Live: discovery, runners, jobs (sync run, list, get, cost), cost summary and projections, allowance,
actors, keys, grants and allocations (with a real admin key), readiness.
Mocked: async jobs and results, sessions, events, conversations, library, characters, plans, billing,
retail revenue, compute performance, instance content.
