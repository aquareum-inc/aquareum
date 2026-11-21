# Engine research: livepeer-builder-core

Reference for the livepeer API client. Written 17 November 2026 from two sources:

- **Source:** `.reference/livepeer-builder-core` at commit `d67836b` (the package is `livepeer_builder`, the CLI is `lpb`). File paths below are relative to that repository.
- **Live engine:** `http://127.0.0.1:8090`, read with GET requests only. No POST, PUT, PATCH or DELETE was sent, and no job was run.

Sample responses are real but redacted: IDs are cut to a prefix followed by `…`, orchestrator hosts are replaced with `orch-a.example` / `orch-b.example`, and hashes are shortened. Field names, nesting and value types are exactly as served.

## 0. Read this first: three findings that change the plan

### 0.1 The live engine is not the commit that was cloned

| | Commit | Date | Version string |
| --- | --- | --- | --- |
| Live engine (`/readyz` → `version`) | `15142129e` ("feat(offerings): ISS-10 …", #77) | 2 Nov 2026 | `0.0.1.dev1+g15142129e` |
| Tag `v0.2.0` = `m3-complete-builder-journey` | `28ae6a9` | 11 Nov 2026 | `0.2.0` when built with tags |
| Cloned reference | `d67836b` | 17 Nov 2026 | `v0.2.0` + 5 CI-only commits (`git diff v0.2.0 d67836b -- src` is empty) |

The live engine is 15 commits behind the clone. Its `/openapi.json` is byte-identical (apart from `info.version`) to `docs/generated/openapi.json` **at `15142129e`**, and differs from the same file at `d67836b`. The differences that reach the wire:

| Area | Live engine (`15142129e`) | Clone (`d67836b` / `v0.2.0`) |
| --- | --- | --- |
| `Runner` (from `GET /v1/runners`) | has `runner_id`, `rate: NetworkRate \| null`, `rate_error` | has `price_info: PriceInfo \| null`, `capacity_used`; **no** `runner_id`, `rate`, `rate_error` (`contracts/discovery.py:43-63`) |
| `components.schemas` | has `NetworkRate`, no `PriceInfo` | has `PriceInfo`, no standalone `NetworkRate` |
| String limits | none on most ids | every stored id, label and reference is at most 200 characters with no NUL (`StoredText`, `contracts/common.py:27`); a longer one is a 422 |
| Discovery | the engine image also runs as a separate `lpb discovery` service | `lpb discovery` removed; `LPB_DISCOVERY_URL` is required and must serve livepeer/node's `/discovery` (`config.py:50`, decision D63) |
| `GET /v1/costs/summary` default window | computed in the route | computed in the service from the engine clock (same result) |

Everything else in this document (routes, auth, jobs, costs, payments services) is unchanged between the two commits: `services/payments.py`, `services/jobs.py`, `services/keys.py`, `services/policy.py` and `store/sql.py` have no diff.

**Consequence:** type `Runner` against whichever engine livepeer pins. Section 4 lists both shapes.

### 0.2 `ENGINE_ADMIN_TOKEN` is not an admin credential on this engine

The token in `ENGINE_ADMIN_TOKEN` authenticates (no 401) but the engine answers it:

- `GET /v1/admin/grants` → 403 `{"error":"admin.allocations requires an admin credential"}`
- `GET /v1/admin/keys?application_id=other`, `GET /v1/admin/applications/other/actors/…/allocation`, `GET /v1/admin/reconciliation?application_id=other&…` → 403 `{"error":"admin.read requires an admin credential"}`

That message is produced only when the credential's kind is neither `admin` nor `auditor` (`services/policy.py:40-41`). So the token is an `actor` key: the project coordinator has since confirmed it authenticates as a builder actor. The engine's key list shows exactly one active admin key (label `console`, actor `operator`); the token in `.env` is not it. I made only those four GETs with it (the rule was: admin token only where the reader token was refused), and did not retry; which actor it belongs to is not recorded here. **Every admin-only route is therefore unverified live.** GETs that could not be sampled: `GET /v1/admin/grants` (no success sample at all), and the cross-application admin reads (`/v1/admin/keys?application_id=<other>`, another application's allocation and reconciliation).

### 0.3 "Reader token" and "admin token" are not engine concepts

The engine has one credential format, the engine API key `lpk_…`, with a **kind**: `actor`, `admin`, `auditor` or `service` (`contracts/access.py:31`). `ENGINE_READER_TOKEN` is an `auditor` key (key label `console reader`, actor `console-reader`, application `default`): a read-only admin. There is no builder key (`lpk_…` of kind `actor`) in `.env`, so nothing was called as a builder; section 2 says what a builder would get, from the source.

---

## 1. What the engine is

`livepeer-builder` is "the shared builder engine for Livepeer. It discovers capabilities, runs paid jobs through the Python gateway SDK, controls access, and reports network cost" (`README.md`). It runs either embedded in a Python backend (`BuilderEngine.create(...)`) or as a REST service (`lpb serve`); both modes run the same code (`ARCHITECTURE.md`, "Integration modes").

### 1.1 Responsibilities

| The engine does | The application does |
| --- | --- |
| Reads the catalog of runners from a `/discovery` URL and serves it as offerings | Decides which apps its users may see and what to call them |
| Runs a job: picks a runner, answers the orchestrator's 402 payment challenge through the remote signer, fails over, records every attempt | Authenticates its own users; maps each user to an opaque `actor_id` |
| Issues and checks engine API keys (or verifies an identity provider's JWTs) and applies an access policy | Owns customer identity: names, emails, organisations, sign-up, login |
| Provisions and funds a per-actor payment allocation at Batteries, on explicit admin commands | Decides who gets how much, and takes the customer's money |
| Reports **wholesale network cost** per job, classified, and reconciles it against the payment provider | Sets the **retail price**, margin, invoices and billing |

Two statements from the source to hold on to:

- "It answers **what the network did and what it cost**; applications keep **who the customer is and what they are charged**" (`ARCHITECTURE.md`).
- "The engine never computes, stores or applies a retail price, margin or invoice" (`docs/contracts/payments.md`, "Wholesale and retail"; `docs/design-docs/core-beliefs.md` belief 1).

The engine never sees a customer: an actor is "an opaque `actor_id` within an `application_id`" (`docs/references/glossary.md`). No request field establishes identity (`docs/contracts/access.md`, "Boundaries").

### 1.2 Components around it

```text
application ──REST──► engine ──GET /discovery──► livepeer/node livepeer-discovery ──► orchestrators
                        │──runner call + 402──► orchestrator / Live Runner
                        │──sign ticket──► remote signer (livepeer/node) ──webhook──► Batteries
                        └──management API, GET /v1/usage──► Batteries (clearinghouse-batteries)
```

Batteries is the authoritative accounting ledger; "the engine projects cost per job and never keeps a second ledger" (`docs/contracts/payments.md`).

### 1.3 Vocabulary

One line each, as the engine uses the word. Sources: `docs/references/glossary.md`, `docs/contracts/*.md`, `contracts/*.py`.

| Term | Meaning in the engine |
| --- | --- |
| **App** (runner app) | The name a Live Runner advertises, for example `chat` or `media/ffmpeg-trim-video`. Jobs target an app and a path. Names may contain `/` |
| **Runner** | One advertised endpoint that serves an app: a URL, its orchestrator, capacity, price and mode (`contracts/discovery.py`) |
| **Offering** | One app in one `(currency, unit)`, as a builder sees it: modes, cheapest and dearest rate, counts. No runner URL. An app advertised in two units is two offerings |
| **Capability** | A label on a job request (`JobRequest.capability`). "Label only in M2; resolution is a later contract" (`contracts/jobs.py:54`). The caller names the `app`. Always `null` in live data |
| **Model** | A second label on a job request, same status as capability |
| **Mode** (runner) | `single-shot` or `persistent`, as the runner registered it; other values are forwarded unchanged |
| **Mode** (job) | `ExecutionMode`: `immediate` or `async`. `async` is reserved and answers 501 |
| **Job** | One unit of work for one actor against one app. States `queued` (reserved), `running`, `succeeded`, `failed`, `uncertain` |
| **Attempt** | One runner call within a job. A job that fails over has several |
| **Session** (signed) | `SignedSession`: one payment manifest an attempt asked the signer to sign |
| **Session** (persistent) | `Session`: a long-lived, engine-proxied runner session. Reserved; `POST /v1/sessions` answers 501 |
| **Application** | `application_id`: a tenant label on every actor, key, job and allocation. Defaults to `default`. There is no application record and no route that lists applications |
| **Actor** | Whoever a job runs for: an opaque `actor_id` inside an application. Owns jobs, costs and one allocation |
| **ActorContext** | The validated identity the core receives: ids, permissions, credential kind |
| **Credential kind** | `actor`, `admin`, `auditor` (read-only admin) or `service` (trusted backend, defined but not honoured yet) |
| **Operation** | A permission name: `discover`, `jobs.run`, `jobs.read`, `costs.read`, `events.read`, `admin.keys`, `admin.allocations`, `admin.costs`, `admin.read`, `actors.assert` |
| **Engine API key** (`lpk_…`) | The caller credential the engine issues. Only its SHA-256 hash is stored |
| **Grant** | An operator-created Batteries budget that allocations draw from. Carries no application |
| **Allocation** | A Batteries budget carved from a grant for one actor (in `per_actor` mode), with its own balance, status and payment key |
| **Allocation key** (`lpg_…`) | The Batteries API key the signer authorizes. Never returned by the engine; records hold a `SecretRef` |
| **Provisioning** | The explicit admin command that creates an actor's allocation and key. "There is no automatic provisioning" |
| **Allowance** | An allocation's `granted`, `spent` and `available` amounts as the provider reports them. "A cap that can overshoot: funds are not reserved" |
| **Allocation mode** | `per_actor` (default: one allocation per actor) or `per_application` (one shared key from settings) |
| **Usage** (measured) | `MeasuredUsage`: work done in the app's own units (`tokens`, `seconds`…), reported once by the application. "Never equated with cost" |
| **Usage row** | One Batteries `GET /v1/usage` item: a charge. Internal; not served over REST |
| **Network cost** | The expected value of the payment tickets at signing. Not on-chain settlement, not a retail price |
| **Cost class** | `delivered`, `failed_after_payment`, `uncertain`, `pending`; plus `unattributed` at reconciliation |
| **Cost projection** | The stored `JobCost` for a job that has ended (`lpb_cost_projections`). Running jobs are computed live on each read |
| **Billable** | `JobCost.billable`: the `delivered` attempts' fees only. What an enterprise bills its user for |
| **Reconciliation** | Per allocation: provider `spent` = delivered + failed_after_payment + uncertain + pending + unattributed; `balanced` says whether it holds |
| **`operation_ref`** | The caller's retry key. At most one job per `(application, actor, operation_ref)` reaches a runner; required on admin commands that move money or create credentials |
| **Operation ledger** | The record of repeat-safe admin commands (`lpb_operations`) |
| **Manifest** (`manifest_id`) | The orchestrator's session label from the 402 challenge; the lookup key to Batteries' `payment_session_id` |
| **Sighting** | A person an identity provider signed in (JWT mode), recorded before any allocation |
| **Remote signer** | The livepeer/node service that signs payment tickets after Batteries authorizes |
| **Reserved** | Defined in the contract, implemented in a later milestone; answers 501 |
| **Settlement** | On-chain redemption of winning tickets. "An operator-level figure, not per job"; the engine never reports it |

---

## 2. Auth

### 2.1 How a request is authenticated

Every route except `/livez`, `/readyz`, `/v1/offerings`, `/openapi.json`, `/docs` and `/redoc` depends on `actor_dependency(engine)` (`http/app.py:97-143`). It builds an `AuthRequest` (method, path, lower-cased headers, client address) and hands it to the engine's authenticator chain. `None` from the chain is a 401 `{"error":"a credential is required"}` with `WWW-Authenticate: Bearer realm="livepeer-builder"` (verified live).

The chain (`adapters/auth.py:43-58`) tries each authenticator in order; the first `ActorContext` wins; `NotAuthenticated` stops the chain with 401.

`ApiKeyAuthenticator` (`adapters/auth.py:17-40`):

1. Reads `Authorization: Bearer <token>`. Anything that does not start with `lpk_` is "not mine".
2. Looks the key up by `sha256(token)` (`utils.py:14-16`).
3. Unknown or revoked → 401 `unknown or revoked key`.
4. Otherwise builds `ActorContext(actor_id, application_id, permissions, credential_kind=key.kind, auth=AuthProvenance(method="api_key", credential_id=key_id))`.

A token is `lpk_` + `secrets.token_urlsafe(32)`; a key id is `key_` + `token_urlsafe(12)` (`services/keys.py:163-177`). The token is shown once, at issue or rotation.

### 2.2 How a request is authorized

Routes are thin: "authorization lives in the services' AccessPolicy checks, not here" (`http/app.py:1-7`). `DefaultPolicy.check(actor, operation, resource)` (`services/policy.py:21-49`):

| Credential kind | Rule |
| --- | --- |
| `admin` | Everything, in every application. Permission strings are ignored |
| `auditor` | Only `admin.read`, `discover`, `jobs.read`, `costs.read`, `events.read`, and only inside its own `application_id`. Anything else is 403 `"<operation> is not a read; an auditor credential only reads"` |
| `actor`, `service` | Never an `admin.*` operation (403 `"<operation> requires an admin credential"`). Needs the operation in its `permissions`. May touch only resources of its own `(application_id, actor_id)` |

Answer order on a job or its cost (`services/ownership.py`): permission first (403, before any lookup), then ownership, where another actor's record and a missing record are both 404.

Default permissions of a new actor key: `discover`, `jobs.run`, `jobs.read`, `costs.read` (`contracts/access.py:27-29`). `admin` and `auditor` keys carry no permission strings; the kind decides (`services/keys.py:201-203`). Verified live: the admin and auditor keys list `"permissions": []`.

### 2.3 The token kinds

| Name used in this project | What it is in the engine | How it is made |
| --- | --- | --- |
| Builder key | `lpk_…` key of kind `actor` | An admin calls `POST /v1/admin/keys` with `{"kind":"actor","actor_id":…,"operation_ref":…}` |
| Reader token | `lpk_…` key of kind `auditor` | `POST /v1/admin/keys` with `"kind":"auditor"` |
| Admin token | `lpk_…` key of kind `admin` | The first from `lpb bootstrap-admin` (CLI only, refused once an active admin key exists; `services/keys.py:71-81`); more from an admin |
| (not used here) | `service` key with `actors.assert` | Defined; "nothing reads `Livepeer-Actor`" yet (`docs/design-docs/m4-guides/index.md`) |
| (not used here) | A JWT from an identity provider | `LPB_AUTH=jwt` or `jwt,api_keys` (`adapters/jwt.py`, `docs/contracts/access.md#jwt-bearer`). The live engine runs `api_keys` only: its OpenAPI declares `bearerFormat: "lpk"` |

Revocation is immediate; rotation has no overlap window (`docs/contracts/access.md`, "Example standalone flow").

### 2.4 Route × token kind

Legend: ✓ allowed · 403 refused by policy · 401 no credential · 501 reserved · "own" = only the caller's own actor · "app" = every actor in the caller's application. **Bold** = verified live with a GET; everything else is from the source.

| Route | No token | Builder (`actor`, default permissions) | Reader (`auditor`) | Admin (`admin`) |
| --- | --- | --- | --- | --- |
| `GET /livez` | **✓** | ✓ | ✓ | ✓ |
| `GET /readyz` | **✓** | ✓ | ✓ | ✓ |
| `GET /openapi.json`, `/docs`, `/redoc` | **✓** | ✓ | ✓ | ✓ |
| `GET /v1/offerings` | **✓** | ✓ | ✓ | ✓ |
| `GET /v1/runners?app=` | **401** | ✓ (`discover`) | **✓** | ✓ |
| `POST /v1/jobs` | 401 | ✓ (`jobs.run`) | 403 | ✓ |
| `GET /v1/jobs` | 401 | ✓ own | **✓ app** | ✓ every actor in the admin key's own application |
| `GET /v1/jobs/{id}` | 401 | ✓ own, else 404 | **✓ app** | ✓ any |
| `GET /v1/jobs/{id}/result` | 401 | 501 for own job, 404 otherwise | **501** (404 for an unknown id) | 501 |
| `POST /v1/jobs/{id}/usage` | 401 | ✓ own (`jobs.run`) | 403 | ✓ |
| `GET /v1/jobs/{id}/cost` | 401 | ✓ own (`costs.read`), else 404 | **✓ app** | ✓ any |
| `GET /v1/costs/projections` | 401 | ✓ own | **✓ app** | ✓ app |
| `GET /v1/costs/summary` | 401 | ✓ own; `?actor_id=` another actor → 403 | **✓ app**, or one actor with `?actor_id=` | ✓ |
| `GET /v1/allowance` | 401 | ✓ own allocation; 404 if not provisioned | **404 without `?actor_id=`; ✓ with it** | ✓ with `?actor_id=` |
| `GET /v1/events` | 401 | 501 | **501** | 501 |
| `POST /v1/sessions` | 401 | 501 | 501 | 501 |
| `POST /v1/admin/keys` | 401 | 403 | 403 | ✓ (`admin.keys`) |
| `GET /v1/admin/keys` | 401 | 403 | **✓ own application** (`?application_id=other` → **403**) | ✓ every application |
| `GET /v1/admin/keys/{key_id}` | 401 | 403 | **✓** own application | ✓ |
| `POST /v1/admin/keys/{key_id}/rotate` | 401 | 403 | 403 | ✓ |
| `POST /v1/admin/keys/{key_id}/revoke` | 401 | 403 | 403 | ✓ |
| `GET /v1/admin/actors` | 401 | 403 | **✓ own application** | ✓ every application |
| `GET /v1/admin/applications/{app}/actors/{actor}/allocation` | 401 | 403 | **✓** own application (other → **403**) | ✓ |
| `POST …/allocation` (provision) | 401 | 403 | 403 | ✓ (`admin.allocations`) |
| `POST …/allocation/fund` | 401 | 403 | 403 | ✓ |
| `POST …/allocation/status` | 401 | 403 | 403 | ✓ |
| `POST …/allocation/revoke` | 401 | 403 | 403 | ✓ |
| `POST …/allocation/rotate-key` | 401 | 403 | 403 | ✓ |
| `GET /v1/admin/grants` | 401 | 403 | **403** (`admin.allocations`, not `admin.read`: `services/grants.py:49-53`) | ✓ |
| `POST /v1/admin/grants` | 401 | 403 | 403 | ✓ |
| `POST /v1/admin/grant/fund` | 401 | 403 | 403 | ✓ |
| `GET /v1/admin/reconciliation` | 401 | 403 | **✓ with `?actor_id=`** (other application → **403**) | ✓ |
| `POST /v1/admin/costs/sync` | 401 | 403 | 403 | ✓ (`admin.costs`) |

Notes:

- The two reserved routes `GET /v1/events` and `POST /v1/sessions` raise before any permission check (`services/reserved.py`), so every authenticated caller gets 501.
- An admin key still has an `application_id`. `GET /v1/jobs`, `/v1/costs/projections` and `/v1/costs/summary` use the caller's own application (`services/jobs.py` `list_jobs`, `services/costs.py` `recent`/`summary`), so an admin sees one application there, while `/v1/admin/keys` and `/v1/admin/actors` cover every application unless narrowed.
- Key routes exist only while engine API keys are on (`http/app.py:271`); grant list and create exist only while the grant desk is on (`http/app.py:348`). Both are on in the live engine (the routes are in its OpenAPI).

### 2.5 Which GET needed which token (live)

| Token | GETs |
| --- | --- |
| none | `/livez`, `/readyz`, `/openapi.json`, `/docs`, `/redoc`, `/v1/offerings` (also `?app=chat`, `?app=does-not-exist`); `/v1/runners?app=chat` to confirm the 401 |
| reader | every other GET in section 3 |
| admin | `/v1/admin/grants` and the three cross-application reads the reader was refused; all four answered 403 (finding 0.2) |

---

## 3. Endpoint reference

All 27 paths (31 operations) in the live `/openapi.json`, plus `/livez`, which is hidden from the schema.

### 3.0 Conventions on the wire

- **JSON, UTF-8.** Timestamps are ISO-8601 UTC with microseconds and `Z`: `"2026-11-17T21:13:22.927098Z"`.
- **Money and rates are decimal strings**, never JSON numbers. Some come back in scientific notation: `"4.745768792E-8"`, `"2.77777777777777777777777778E-10"` (both seen live). Trailing zeros are kept (`"0.022819208579689980"`).
- **Engine ids are UUIDs** (jobs). Key ids are `key_…`. Allocation, grant and payment-session ids are Batteries' opaque strings.
- **Response objects always carry every field.** The OpenAPI schema marks fields with defaults as optional, but pydantic serializes them all (verified on every sample below). Treat response fields as required and nullable where shown.
- **Request models are strict**: contract classes forbid unknown fields (`contracts/common.py:9-12`), so an extra key in a `JobRequest`, `FundRequest` or `SessionRequest` is a 422. The REST-only bodies (`IssueKeyBody`, `ProvisionBody`, `GrantBody`, `StatusBody`, `RotateKeyBody`, `RotateBody`, `UsageBody`) are plain models and ignore extras.
- **Request size:** a `/v1/` body over `LPB_HTTP_MAX_REQUEST_BYTES` (16 MiB) is a 413 before the credential is checked (`http/limits.py`).
- **No CORS headers** are sent ("CORS is off by default", `docs/contracts/access.md`; no CORS code in `src/`).

Error bodies (`http/app.py:396-486`). There are two envelopes:

| Status | Body | When |
| --- | --- | --- |
| 400 | `{"error": string}` | `InvalidRequest` |
| 401 | `{"error": string}` + `WWW-Authenticate` | no or bad credential |
| 402 | `{"error": string}` | `NotProvisioned` outside a job |
| 403 | `{"error": string}` | `AccessDenied` |
| 404 | `{"error": string}` | `NotFound`. An unknown route is FastAPI's `{"detail":"Not Found"}` |
| 409 | `{"error", "code": "operation_exists" \| "operation_in_progress" \| "operation_conflict", "job"?: Job, "operation"?: {command, operation_ref, state}}`; `Livepeer-Job-Id` for a job; `Retry-After` when in progress | a repeated `operation_ref` |
| 409 | `{"error", "code": "already_provisioned", "actor": ProvisionedActor}` | provisioning a provisioned actor |
| 413 | `{"error", "code": "request_too_large", "limit_bytes": number}` | body too large |
| 422 | `{"detail": [{"type","loc","msg","input","ctx"?}]}` (FastAPI) | parameter or body validation |
| 501 | `{"error", "milestone", "ticket"}` | reserved contract |
| 502 / 400 / 404 / 409 / 422 | `{"error": "provider HTTP <n>: …"}` | `ProviderError` (Batteries answered an error; 400, 404, 409, 422 pass through, anything else is 502) |
| 503 | `{"error"}` (+ `Retry-After` for admission) | `ProviderUnavailable`, `NoCapacity` |
| job failure | `{"error": string, "job": Job}` + `Livepeer-Job-Id` (+ `Retry-After`) | `JobFailed`; status from the table in section 5.4 |

Only the 409s and the 413 carry a machine-readable `code`. There is no catch-all handler, so an unexpected exception is the framework's plain 500.

### 3.1 Health and catalog (public)

#### `GET /livez`

Liveness. Not in OpenAPI (`http/app.py:165-167`). **Works.**

```json
{"status":"ok"}
```

#### `GET /readyz` → `EngineHealth`

Readiness and health. Status 200 when `ready`, 503 otherwise, same body (`http/app.py:169-173`). `ready` is true once discovery has been attempted at all, even if it failed (`runtime/engine.py:124-136`), so read `discovery_fresh`, `discovery_error` and `cost_sync_error` for real health. **Works.**

```json
{
  "ready": true,
  "discovery_fresh": true,
  "discovery_observed_at": "2026-11-17T21:13:22.927098Z",
  "discovery_error": null,
  "cost_sync_at": "2026-11-17T21:13:07.870880Z",
  "cost_sync_error": null,
  "running_jobs": 0,
  "allocation_mode": "per_actor",
  "version": "0.0.1.dev1+g15142129e"
}
```

#### `GET /v1/offerings` → `Offering[]`

The public catalog (`services/discovery.py` `offerings`). Query: `app` (optional, exact match; an unknown app is `[]`, not 404). Sorted by app, then currency and unit. No pagination. **Works.** 27 offerings live: 21 `single-shot`, 6 `persistent`, all `rate_status: "available"`, none stale; `transcription` appears twice (once per `fixed`, once per `seconds`).

```json
[
  {
    "app": "blueclaw/chat/qwen3.8-27b",
    "modes": ["single-shot"],
    "rate_low":  {"amount": "6185382086", "currency": "wei", "unit": "seconds", "price_usd": null,
                  "source": "orchestrator", "observed_at": "2026-11-17T21:13:22.927098Z", "observed_by": "engine"},
    "rate_high": {"amount": "6185382086", "currency": "wei", "unit": "seconds", "price_usd": null,
                  "source": "orchestrator", "observed_at": "2026-11-17T21:13:22.927098Z", "observed_by": "engine"},
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:22.927098Z"
  },
  {
    "app": "image-edit",
    "modes": ["single-shot"],
    "rate_low":  {"amount": "11136884956480", "currency": "wei", "unit": "fixed", "price_usd": "0.02",
                  "source": "orchestrator", "observed_at": "2026-11-17T21:13:10.560858Z", "observed_by": "orchestrator"},
    "rate_high": {"amount": "11136884956480", "currency": "wei", "unit": "fixed", "price_usd": "0.02",
                  "source": "orchestrator", "observed_at": "2026-11-17T21:13:10.560858Z", "observed_by": "orchestrator"},
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:22.927098Z"
  }
]
```

(2 of 27 shown.) Field meanings: `rate_low`/`rate_high` are the cheapest and dearest runner in the group, `null` when no runner has a usable rate; `rate_status` is `available` only for a rate the signer will pay (`wei` per `seconds` or `fixed`); `stale` means the snapshot missed three polls or the oldest rate is older than `LPB_RATE_MAX_AGE_S`; `ready_count` counts runners with free or unknown capacity; `observed_at` is the engine's last good poll (`docs/contracts/engine.md`, "Offering status").

### 3.2 Discovery (authenticated)

#### `GET /v1/runners?app=<name>` → `Runner[]`

Runner URLs for one app. `app` is required (422 without it) and travels as a query parameter because app names contain `/`. Needs `discover`. An unknown app is `[]`. **Works** with the reader token. Shape is the live engine's (finding 0.1).

```json
[
  {
    "url": "https://orch-a.example:38935/apps/qwen3-8-27b-int4/app",
    "app": "chat",
    "runner_id": null,
    "mode": "single-shot",
    "orchestrator_url": "https://orch-a.example:38935",
    "capacity": 8,
    "capacity_available": 8,
    "rate": {"amount": "10812508130", "currency": "wei", "unit": "seconds",
             "price_usd": "0.000019444444444444444444444444444444", "source": "orchestrator"},
    "rate_error": null,
    "observed_at": "2026-11-17T21:13:40.855923Z",
    "version": null,
    "metadata": "{\"deployment_revision\":\"sha256:cd6a…\",\"endpoints\":{\"chat_completions\":{\"profile\":\"openai.chat.v1\"},\"messages\":{\"profile\":\"anthropic.messages.v1\"},\"responses\":{\"profile\":\"openai.responses.stateless.v1\"}},\"limits\":{\"context_tokens\":4096},\"model\":{\"name\":\"qwen3.8-27b\",…},\"runner_contract\":1,\"runner_id\":\"qwen3-8-27b-int4\",\"runtime\":{\"name\":\"vllm\",…}}",
    "gpu": null
  }
]
```

(1 of 1.) `metadata` is a **string** of app-controlled text, often JSON; "the engine never interprets `metadata`". It is the only place a runner describes its endpoints, model and limits.

### 3.3 Jobs

#### `POST /v1/jobs` → the runner's own response

Runs one job and returns the runner's status code, content type and body, with `Livepeer-Job-Id` (`http/app.py:185-215`). Body: `JobRequest`. Query: `stream` (boolean, default false); `Accept: text/event-stream` also selects streaming. Needs `jobs.run`. **Not called. Status from source: implemented** for `mode="immediate"` (buffered and streamed); `mode="async"` → 501 `{"error":"async jobs is defined but not implemented until M4 (ISS-26)","milestone":"M4","ticket":"ISS-26"}` (`services/jobs.py` `_admit_request`). Details in section 5.

#### `GET /v1/jobs` → `Job[]`

Job history, newest first (`http/app.py:217-223`). Query: `limit` 1–500 (default 50; 501 is a 422), `before` (an ISO-8601 time **with** offset; without one it is a 422 `timezone_aware`). To page, pass the last job's `created_at` as `before`. No other filter: no state, app or actor filter, no total. An actor sees its own; an auditor or admin sees every actor in its application. Needs `jobs.read`. **Works.** 9 jobs live (2 succeeded, 7 failed; 8 with one attempt, 1 with two).

```json
[
  {
    "id": "bc22d899-…",
    "actor_id": "acme-studio",
    "application_id": "default",
    "operation_ref": "console-run-dff04ac8-…",
    "mode": "immediate",
    "app": "text-to-image",
    "capability": null,
    "model": null,
    "state": "failed",
    "attempts": [
      {
        "job_id": "bc22d899-…",
        "number": 1,
        "runner_url": "https://orch-b.example:8936/apps/flux-image-…/app",
        "orchestrator_url": "https://orch-b.example:8936",
        "allocation_id": "AaGsRG…",
        "sessions": [
          {"manifest_id": "session_ybny…", "payment_session_id": "AaHrAk…", "match": "matched", "payment_state": "paid"}
        ],
        "payment_sent": true,
        "outcome": "http",
        "status_code": 400,
        "started_at": "2026-11-17T19:35:54.717324Z",
        "ended_at": "2026-11-17T19:35:59.050808Z",
        "timings": {"challenge_ms": 496, "signing_ms": 2987, "response_ms": 806}
      }
    ],
    "failure": {
      "kind": "runner_rejected",
      "message": "HTTP 400 from https://orch-b.example:8936/apps/flux-image-…/app/v1/images/generations",
      "status_code": 400,
      "body": "{\"error\": {\"type\": \"invalid_request_error\", \"message\": \"Unsupported or invalid input\"}}",
      "payment_sent": true,
      "reason": null
    },
    "result": null,
    "usage": null,
    "created_at": "2026-11-17T19:35:54.689378Z",
    "completed_at": "2026-11-17T19:35:59.057105Z"
  },
  {
    "id": "48ebd1d0-…",
    "actor_id": "acme-studio",
    "application_id": "default",
    "operation_ref": "console-run-4abd965d-…",
    "mode": "immediate",
    "app": "fal-flux-schnell",
    "capability": null,
    "model": null,
    "state": "succeeded",
    "attempts": [
      {
        "job_id": "48ebd1d0-…",
        "number": 1,
        "runner_url": "https://orch-b.example:8936/apps/runner_35qk…/app",
        "orchestrator_url": "https://orch-b.example:8936",
        "allocation_id": "AaGsRG…",
        "sessions": [
          {"manifest_id": "fc9b…", "payment_session_id": "AaGsSh…", "match": "matched", "payment_state": "paid"}
        ],
        "payment_sent": true,
        "outcome": "succeeded",
        "status_code": 200,
        "started_at": "2026-11-05T15:18:18.640444Z",
        "ended_at": "2026-11-05T15:18:22.122304Z",
        "timings": {"challenge_ms": 231, "signing_ms": 959, "response_ms": 1980}
      }
    ],
    "failure": null,
    "result": {"storage": "inline", "content_type": "application/json", "size_bytes": 1179608,
               "sha256": "b18462a3…", "location": null},
    "usage": null,
    "created_at": "2026-11-05T15:18:18.628520Z",
    "completed_at": "2026-11-05T15:18:22.126907Z"
  }
]
```

(2 of 9 shown.) Other real values seen: a payment refusal has `failure: {"kind":"payment","message":"the signer refused payment: not authorized (HTTP 403)","status_code":403,"body":null,"payment_sent":false,"reason":"not_authorized"}`, attempt `outcome: "payment"`, session `{"payment_session_id": null, "match": "unmatched", "payment_state": "unpaid"}` and `timings.response_ms: null`.

#### `GET /v1/jobs/{job_id}` → `Job`

One job, same shape as a list item. `job_id` must be a UUID (422 otherwise). Unknown or another actor's job → 404 `{"error":"job <id> not found"}`. Needs `jobs.read`. **Works.**

#### `GET /v1/jobs/{job_id}/result`

Reserved for stored results. Permission (403), then ownership (404), then **501** (`services/jobs.py` `result`). **Returns 501** (verified; 404 for an unknown id):

```json
{"error":"stored job results is defined but not implemented until M4 (ISS-26)","milestone":"M4","ticket":"ISS-26"}
```

#### `POST /v1/jobs/{job_id}/usage` → `Job`

The application reports measured work once. Body `UsageBody` `{"quantities": {"tokens": 1234}}`. Needs `jobs.run` and ownership; only for a `succeeded` job; a second report, an empty map or a negative value is a 400 (`services/jobs.py` `report_usage`). **Not called. Status from source: implemented.** No job in the live engine has `usage` set.

#### `GET /v1/jobs/{job_id}/cost` → `JobCost`

The job's network cost. Needs `costs.read`; 404 as for the job. A running or not-yet-projected job is computed live. **Works.**

```json
{
  "job_id": "bc22d899-…",
  "status": "observed",
  "fees": {"fee_eth": "0.000011209330481934", "fee_usd": "0.020015514359380822", "row_count": 1},
  "attempts": [
    {"attempt_number": 1, "cost_class": "failed_after_payment",
     "fees": {"fee_eth": "0.000011209330481934", "fee_usd": "0.020015514359380822", "row_count": 1}}
  ],
  "first_observed_at": "2026-11-17T19:36:28.590792Z",
  "updated_at": "2026-11-17T19:36:28.590795Z",
  "billable": {"fee_eth": "0", "fee_usd": "0", "row_count": 0}
}
```

### 3.4 Costs and allowance

#### `GET /v1/costs/projections` → `JobCost[]`

The costs of the most recent jobs, newest first. Query: `limit` 1–**25** (default 25; 26 is a 422). No paging and no filter. Scope as for `GET /v1/jobs`. Needs `costs.read`. **Works.**

```json
[
  { "job_id": "bc22d899-…", "status": "observed", "fees": {"fee_eth": "0.000011209330481934", "fee_usd": "0.020015514359380822", "row_count": 1},
    "attempts": [{"attempt_number": 1, "cost_class": "failed_after_payment", "fees": {"fee_eth": "0.000011209330481934", "fee_usd": "0.020015514359380822", "row_count": 1}}],
    "first_observed_at": "2026-11-17T19:36:28.590792Z", "updated_at": "2026-11-17T19:36:28.590795Z",
    "billable": {"fee_eth": "0", "fee_usd": "0", "row_count": 0} },
  { "job_id": "8fd38349-…", "status": "none", "fees": {"fee_eth": "0", "fee_usd": "0", "row_count": 0},
    "attempts": [], "first_observed_at": null, "updated_at": "2026-11-05T20:10:48.288719Z",
    "billable": {"fee_eth": "0", "fee_usd": "0", "row_count": 0} }
]
```

(2 of 3 requested with `limit=3`; 9 jobs exist.)

#### `GET /v1/costs/summary` → `CostSummary`

Totals for the jobs **created** in `[start, end)`. Query: `start`, `end` (optional date-times; `end` defaults to now, `start` to 30 days before `end`), `actor_id` (optional; an actor may only name itself). Needs `costs.read`. **Works.** A `start` without an offset is accepted and echoed back without one (`"start":"2026-11-01T00:00:00"`, verified; tech debt T25), so always send `Z`.

```json
{
  "start": "2026-10-18T21:13:54.399157Z",
  "end": "2026-11-17T21:13:54.399157Z",
  "by_class": {
    "delivered":            {"fee_eth": "0.00000132881526191",   "fee_usd": "0.003067654430465203", "row_count": 2},
    "failed_after_payment": {"fee_eth": "0.000012423806151904",  "fee_usd": "0.022819208579689980", "row_count": 3},
    "uncertain":            {"fee_eth": "0", "fee_usd": "0", "row_count": 0},
    "pending":              {"fee_eth": "0", "fee_usd": "0", "row_count": 0}
  },
  "jobs_with_cost": 4,
  "jobs_pending": 0,
  "by_app": {
    "blueclaw/chat/qwen3.8-27b": {
      "delivered":            {"fee_eth": "4.745768792E-8",      "fee_usd": "0.000109559086789961", "row_count": 1},
      "failed_after_payment": {"fee_eth": "0.00000121447566997", "fee_usd": "0.002803694220309158", "row_count": 2}
    },
    "fal-flux-schnell": {
      "delivered": {"fee_eth": "0.00000128135757399", "fee_usd": "0.002958095343675242", "row_count": 1}
    },
    "text-to-image": {
      "failed_after_payment": {"fee_eth": "0.000011209330481934", "fee_usd": "0.020015514359380822", "row_count": 1}
    }
  }
}
```

`by_class` always has all four classes; `by_app[app]` has only the classes that app's attempts have. An app in `by_app` may no longer be in the catalog (`fal-flux-schnell` is not in today's offerings).

#### `GET /v1/allowance` → `Allowance`

The caller's allocation as Batteries reports it. Query: `actor_id` (optional; defaults to the caller's own actor). Needs `costs.read`. 404 `{"error":"no allocation pays for actor '<id>'"}` when that actor has no allocation, which is what an auditor or admin gets without `actor_id` (verified). A provider failure is a fixed message (`provider HTTP 500: the allowance could not be read`). **Works** with `?actor_id=`.

```json
{
  "allocation_id": "AaGsRG…",
  "status": "active",
  "granted":   {"amount": "0.25", "currency": "USD"},
  "spent":     {"amount": "0.025886863010155183", "currency": "USD"},
  "available": {"amount": "0.224113136989844817", "currency": "USD"}
}
```

`status` is Batteries' own string, not the engine's enum. Each money field may be `null`.

### 3.5 Reserved

#### `GET /v1/events` → `EventPage`

Query: `after` (int, default 0), `limit` 1–1000 (default 500). **Returns 501** (verified) for every authenticated caller:

```json
{"error":"the engine events feed is defined but held by the M3 scope decision of 21 October 2026 (item 4, D60); see ISS-18","milestone":"held","ticket":"ISS-18"}
```

#### `POST /v1/sessions` → `Session`

Body `SessionRequest`. **Not called. Status from source: 501** `{"error":"persistent sessions is defined but not implemented until M4 (ISS-27)","milestone":"M4","ticket":"ISS-27"}` (`services/reserved.py:23-28`). No close, get or proxy route exists.

### 3.6 Admin: keys

Present only while engine API keys are on.

#### `POST /v1/admin/keys` → 201 `IssuedKey`

Body `IssueKeyBody`: `kind` (default `actor`), `actor_id`, `application_id` (default `default`), `permissions` (default: the four actor permissions; ignored for `admin` and `auditor`; unknown names are a 400), `label`, `operation_ref` (**required**). Needs an admin. A repeat of the same reference and body returns 201 with `"token": null`, `"replayed": true` and `Idempotent-Replayed: true`; another body is 409 `operation_conflict`. **Not called. Status from source: implemented** (`services/keys.py:43-69`).

#### `GET /v1/admin/keys` → `AccessKey[]`

Query: `application_id` (optional). No pagination. Needs `admin.read`. **Works.** 12 keys live (1 admin, 1 auditor, 10 actor of which 5 revoked).

```json
[
  {"key_id": "key_0IPu…", "kind": "admin",   "actor_id": "operator",        "application_id": "default",
   "permissions": [], "label": "console",        "created_at": "2026-11-05T14:09:02.388077Z", "revoked_at": null},
  {"key_id": "key_Jl5G…", "kind": "auditor", "actor_id": "console-reader",  "application_id": "default",
   "permissions": [], "label": "console reader", "created_at": "2026-11-05T14:09:04.984207Z", "revoked_at": null},
  {"key_id": "key_P6Th…", "kind": "actor",   "actor_id": "live-check-0931", "application_id": "default",
   "permissions": ["costs.read", "discover", "jobs.read", "jobs.run"], "label": "",
   "created_at": "2026-11-05T14:31:36.388693Z", "revoked_at": null}
]
```

(3 of 12.) One actor can hold several keys. Never the token or its hash.

#### `GET /v1/admin/keys/{key_id}` → `AccessKey`

One key. Unknown → 404 `{"error":"key '<id>' not found"}`. **Works.**

```json
{"key_id": "key_Jl5G…", "kind": "auditor", "actor_id": "console-reader", "application_id": "default",
 "permissions": [], "label": "console reader", "created_at": "2026-11-05T14:09:04.984207Z", "revoked_at": null}
```

#### `POST /v1/admin/keys/{key_id}/rotate` → 201 `IssuedKey`

Body `RotateKeyBody`: `label` (optional; keeps the old one when absent), `operation_ref` (required). New key id and token; the old token stops at once. A revoked or unknown key is a 400. **Not called. Status from source: implemented.**

#### `POST /v1/admin/keys/{key_id}/revoke` → 204

No body, no `operation_ref`. Repeat-safe (204 again); a key that never existed is a 400. **Not called. Status from source: implemented.**

### 3.7 Admin: actors and allocations

`base` = `/v1/admin/applications/{application_id}/actors/{actor_id}/allocation`.

#### `GET /v1/admin/actors` → `KnownActor[]`

Provisioned actors plus people an identity provider signed in. Query: `application_id`, `status` (`active` | `paused` | `exhausted` | `revoked`; filters allocations, so it drops the unprovisioned), `provisioned` (boolean), `limit` 1–1000 (default 500). Sorted by `(application_id, actor_id)`; no cursor. Needs `admin.read`. **Works.** 5 actors live (1 active, 4 revoked).

```json
[
  {
    "application_id": "default",
    "actor_id": "acme-studio",
    "label": "Acme Studio",
    "name": null,
    "allocation": {
      "application_id": "default",
      "actor_id": "acme-studio",
      "grant_id": "AaGsRF…",
      "allocation_id": "AaGsRG…",
      "api_key_id": "AaGsRG…",
      "secret_ref": {"ref": "db:vW51…"},
      "currency": "USD",
      "status": "active",
      "created_at": "2026-11-05T15:12:07.552116Z",
      "updated_at": "2026-11-05T15:12:07.552116Z",
      "label": "Acme Studio"
    },
    "first_seen_at": null,
    "last_seen_at": null,
    "provisioned": true
  },
  {
    "application_id": "default",
    "actor_id": "live-check-0931",
    "label": "Live check",
    "name": null,
    "allocation": { "…": "same shape", "status": "revoked" },
    "first_seen_at": null,
    "last_seen_at": null,
    "provisioned": true
  }
]
```

(2 of 5.) `provisioned` is `allocation !== null`, so it is `true` for a **revoked** allocation too. `name`, `first_seen_at` and `last_seen_at` are filled only in JWT mode. The list has no balance: that is one `GET /v1/allowance?actor_id=` per actor.

#### `GET base` → `ProvisionedActor`

One actor's allocation. Not provisioned → 404 `{"error":"actor '<id>' is not provisioned"}`. Needs `admin.read`. **Works.**

```json
{"application_id": "default", "actor_id": "acme-studio", "grant_id": "AaGsRF…", "allocation_id": "AaGsRG…",
 "api_key_id": "AaGsRG…", "secret_ref": {"ref": "db:vW51…"}, "currency": "USD", "status": "active",
 "created_at": "2026-11-05T15:12:07.552116Z", "updated_at": "2026-11-05T15:12:07.552116Z", "label": "Acme Studio"}
```

#### `POST base` (provision) → 201 `ProvisionedActor`

Body `ProvisionBody`: `amount` (`Money`; may be zero, which leaves the allocation `exhausted`), `label`, `grant_id` (empty uses the grant of the calling admin's own allocation; none → 400 `choose a grant`), `operation_ref` (required). Only in `per_actor` mode; amount must be in the engine's default currency. Already provisioned under a new reference → 409 `already_provisioned`. The `lpg_` key is never returned. **Not called. Status from source: implemented** (`services/payments.py:116-187`).

#### `POST base/fund` → `ProvisionedActor`

Body `FundRequest`: `amount` (positive, in the allocation's currency), `operation_ref` (required), `grant_id` (ignored here). An `exhausted` actor becomes `active`. **Not called. Status from source: implemented.**

#### `POST base/status` → `ProvisionedActor`

Body `StatusBody` `{"status": "active" | "paused"}`. The schema also lists `exhausted` and `revoked`, but the service refuses them with a 400 (`services/payments.py:273-274`). No `operation_ref`. **Not called. Status from source: implemented.**

#### `POST base/revoke` → `ProvisionedActor`

No body. Revokes the allocation (unused funds return to the grant) and deletes the stored key. Repeat-safe. **Not called. Status from source: implemented.**

#### `POST base/rotate-key` → `ProvisionedActor`

Body `RotateBody` `{"operation_ref": …}`. New payment key on the same allocation, old one revoked. **Not called. Status from source: implemented.**

### 3.8 Admin: grants

#### `GET /v1/admin/grants` → `GrantRecord[]`

Every Batteries grant (the provisioning catalog). No parameters, no pagination. Needs `admin.allocations` (an admin; an auditor is refused by design). Route exists only with `LPB_BATTERIES_OPERATOR_TOKEN`. **Errors for both tokens I have: 403** (reader: `"admin.allocations is not a read; an auditor credential only reads"`; admin token: finding 0.2). Shape from source only (`contracts/payments.py:46-56`, `adapters/batteries.py:225-235`): `{id, name, status, currency, total, metadata}` where `currency` is upper-cased (`"USD"`), `total` is a decimal **string** of the grant's total (not a remaining balance) and `metadata` is `{}` or the engine's tag `{"lpb_operation": "…"}`.

#### `POST /v1/admin/grants` → 201 `GrantRecord`

Body `GrantBody`: `name`, `amount` (positive, default currency), `operation_ref` (required). **Not called. Status from source: implemented** (`services/grants.py:55-78`).

#### `POST /v1/admin/grant/fund` → 204

Note the singular `grant`. Body `FundRequest`: `amount`, `operation_ref`, `grant_id` (empty uses the calling admin's own allocation's grant). Exists even without the grant desk. **Not called. Status from source: implemented.**

### 3.9 Admin: costs

#### `GET /v1/admin/reconciliation` → `Reconciliation`

Query: `application_id` (default `default`), `actor_id` (optional). In `per_actor` mode it needs `actor_id`: without it the lookup falls to the shared allocation, which is unset, and the answer is 404 `{"error":"no allocation pays for that actor or application"}` (verified; `services/payments.py:105-109`). Needs `admin.read`. **Works** with `?actor_id=`.

```json
{
  "application_id": "default",
  "actor_id": "acme-studio",
  "allocation_id": "AaGsRG…",
  "provider_spent": {"amount": "0.025886863010155183", "currency": "USD"},
  "by_class": {
    "delivered":            {"fee_eth": "0.00000132881526191",  "fee_usd": "0.003067654430465203", "row_count": 2},
    "failed_after_payment": {"fee_eth": "0.000012423806151904", "fee_usd": "0.022819208579689980", "row_count": 3},
    "uncertain":            {"fee_eth": "0", "fee_usd": "0", "row_count": 0},
    "pending":              {"fee_eth": "0", "fee_usd": "0", "row_count": 0}
  },
  "unattributed": {"fee_eth": "0", "fee_usd": "0", "row_count": 0},
  "balanced": true
}
```

Here 0.003067654430465203 + 0.022819208579689980 = 0.025886863010155183 = `provider_spent`, so `balanced` is true. `balanced` is `null` when the provider figure is unavailable or a USD fee is missing.

#### `POST /v1/admin/costs/sync` → `SyncReport`

No body. Runs a cost sync now. Needs `admin.costs`. **Not called (the task forbids it). Status from source: implemented** (`services/costs.py` `sync_now`); 503 when no usage source is configured.

---

## 4. Schemas

All 43 entries of the live `components.schemas`, condensed. Notation: `Decimal` = a decimal string (may use `E` notation); `DateTime` = ISO-8601 string; `UUID` = string. Response types list every field as present (section 3.0). `?` marks a field a **request** may omit, with its default in a comment.

```ts
type Decimal = string;
type DateTime = string;
type UUID = string;

// ── shared enums (inline in OpenAPI; names are the Python aliases) ─────────────
type Currency = "USD" | "ETH";                                             // contracts/common.py:15
type CredentialKind = "actor" | "admin" | "auditor" | "service";           // contracts/access.py:31
type AllocationMode = "per_application" | "per_actor";                     // contracts/payments.py:16
type AllocationStatus = "active" | "paused" | "exhausted" | "revoked";     // contracts/payments.py:17
type ExecutionMode = "immediate" | "async";                                // contracts/jobs.py:13
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type JobState = "queued" | "running" | "succeeded" | "failed" | "uncertain";
type AttemptOutcome = "in_flight" | "succeeded" | "refused" | "unreachable" | "payment_refused"
                    | "payment" | "timeout" | "http" | "abandoned" | "payment_unknown";
type FailureKind = "no_offering" | "no_capacity" | "not_provisioned" | "refused" | "unreachable"
                 | "payment" | "payment_unknown" | "timeout" | "runner_rejected" | "runner_error"
                 | "interrupted" | "abandoned";
type PaymentReason = "not_authorized" | "allowance_exhausted" | "signer_unavailable" | "signer_unknown";
type SessionMatch = "unmatched" | "matched" | "ambiguous";
type PaymentState = "unknown" | "paid" | "unpaid";
type CostClass = "delivered" | "failed_after_payment" | "uncertain" | "pending";
type CostStatus = "none" | "pending" | "observed" | "corrected";
type EventType = "job.created" | "job.finished" | "usage.reported" | "cost.observed" | "cost.corrected";
type SessionState = "opening" | "open" | "closed" | "failed";

// ── access ─────────────────────────────────────────────────────────────────────
interface AccessKey {
  key_id: string;
  kind: CredentialKind;
  actor_id: string;
  application_id: string;
  permissions: string[];          // Operation values; [] for admin and auditor
  label: string;
  created_at: DateTime;
  revoked_at: DateTime | null;
}
interface IssuedKey {
  key: AccessKey;
  token: string | null;           // "lpk_…", shown once; null on a replay
  replayed: boolean;
}
interface IssueKeyBody {          // request
  kind?: CredentialKind;          // default "actor"
  actor_id: string;               // d67836b: minLength 1, maxLength 200
  application_id?: string;        // default "default"; d67836b: 1–200 chars
  permissions?: string[] | null;
  label?: string;                 // default ""; d67836b: maxLength 200
  operation_ref: string;          // minLength 1, maxLength 200
}
interface RotateKeyBody {         // request
  label?: string | null;          // d67836b: maxLength 200
  operation_ref: string;          // 1–200
}

// ── money ──────────────────────────────────────────────────────────────────────
interface MoneyInput  { amount: number | string; currency: Currency; }   // "Money-Input"; send a string
interface MoneyOutput { amount: Decimal;         currency: Currency; }   // "Money-Output"
interface Fees {
  fee_eth: Decimal;               // ETH; always present
  fee_usd: Decimal | null;        // USD; null when an applied row lacks a USD price
  row_count: number;              // applied Batteries usage rows counted
}

// ── discovery ──────────────────────────────────────────────────────────────────
interface NetworkRate {           // live engine only as a named schema
  amount: Decimal;                // wei on-chain; 0 = free
  currency: string;               // "wei" (lower-cased)
  unit: string;                   // "seconds" | "fixed" are the payable ones
  price_usd: Decimal | null;      // the advertiser's figure, not a conversion
  source: "orchestrator";
}
interface ObservedRate extends NetworkRate {
  observed_at: DateTime;
  observed_by: "orchestrator" | "engine";
}
interface Offering {
  app: string;
  modes: string[];                // "single-shot" | "persistent" | other strings
  rate_low: ObservedRate | null;
  rate_high: ObservedRate | null;
  rate_status: "available" | "missing";
  stale: boolean;
  runner_count: number;
  ready_count: number;
  observed_at: DateTime;
}
interface RunnerGPU { id: string | null; name: string | null; vram_mb: number | null; }

// Runner on the LIVE engine (15142129e)
interface Runner {
  url: string;
  app: string;
  runner_id: string | null;
  mode: string | null;
  orchestrator_url: string | null;
  capacity: number | null;
  capacity_available: number | null;
  rate: NetworkRate | null;
  rate_error: string | null;
  observed_at: DateTime | null;
  version: string | null;
  metadata: string | null;        // free text, often a JSON string
  gpu: RunnerGPU | null;
}
// Runner at d67836b / v0.2.0 (not served by the live engine)
interface RunnerV020 {
  url: string;
  app: string;
  mode: string | null;
  orchestrator_url: string | null;
  capacity: number | null;
  capacity_used: number | null;
  capacity_available: number | null;
  price_info: PriceInfo | null;
  observed_at: DateTime | null;
  version: string | null;
  metadata: string | null;
  gpu: RunnerGPU | null;
}
interface PriceInfo {             // d67836b only
  price: Decimal | null;
  price_usd: Decimal | null;
  currency: string | null;
  unit: string | null;
}

// ── jobs ───────────────────────────────────────────────────────────────────────
interface JobRequest {            // request; unknown fields are a 422
  app: string;                    // minLength 1 (d67836b: maxLength 200)
  path?: string;                  // default ""; must start with "/" when set
  method?: HttpMethod;            // default "POST"
  payload?: Record<string, unknown> | null;
  raw_body?: string | null;       // URL-safe base64; at most 8 MiB decoded; needs content_type
  content_type?: string | null;   // 1–256 chars, printable ASCII
  headers?: [string, string][];   // default []; at most 32, 16 KiB; reserved names refused
  return_http_errors?: boolean;   // default false; only with streaming
  operation_ref?: string | null;  // maxLength 200
  capability?: string | null;     // label only
  model?: string | null;          // label only
  mode?: ExecutionMode;           // default "immediate"; "async" → 501
  max_attempts?: number;          // int 1–10, default 3
  timeout_s?: number;             // 0 < x ≤ 3600, default 300
  first_byte_timeout_s?: number;  // 0 < x ≤ 3600, default 60; streams only; ≤ timeout_s
  idle_timeout_s?: number | null; // 0 < x ≤ 3600, default 60; streams only; null = off
}
interface SignedSession {
  manifest_id: string;
  payment_session_id: string | null;
  match: SessionMatch;
  payment_state: PaymentState;
}
interface CallTimings {
  challenge_ms: number | null;
  signing_ms: number | null;
  response_ms: number | null;
}
interface Attempt {
  job_id: UUID;
  number: number;                 // 1-based; equals AttemptCost.attempt_number
  runner_url: string | null;
  orchestrator_url: string | null;
  allocation_id: string | null;   // null when the call was unpaid
  sessions: SignedSession[];
  payment_sent: boolean;
  outcome: AttemptOutcome;
  status_code: number | null;
  started_at: DateTime;
  ended_at: DateTime | null;
  timings: CallTimings | null;
}
interface Failure {
  kind: FailureKind;
  message: string;
  status_code: number | null;     // the runner's status, or the signer's for a payment failure
  body: string | null;            // the runner's own words, bounded (4096)
  payment_sent: boolean;          // true when ANY attempt was paid
  reason: PaymentReason | null;   // only on kind "payment" | "payment_unknown"
}
interface ResultRef {
  storage: "inline" | "stored";   // "stored" is reserved
  content_type: string;
  size_bytes: number;
  sha256: string;
  location: string | null;
}
interface MeasuredUsage {
  quantities: Record<string, number>;   // integers, the app's own units
  source: "app_reported" | "engine_meter";
  reported_at: DateTime;
}
interface Job {
  id: UUID;
  actor_id: string;
  application_id: string;
  operation_ref: string | null;
  mode: ExecutionMode;
  app: string;
  capability: string | null;
  model: string | null;
  state: JobState;
  attempts: Attempt[];
  failure: Failure | null;
  result: ResultRef | null;
  usage: MeasuredUsage | null;
  created_at: DateTime;
  completed_at: DateTime | null;
}
interface UsageBody { quantities: Record<string, number>; }   // request

// ── costs ──────────────────────────────────────────────────────────────────────
interface AttemptCost { attempt_number: number; cost_class: CostClass; fees: Fees; }
interface JobCost {
  job_id: UUID;
  status: CostStatus;
  fees: Fees;                     // everything the job's attempts cost the allocation
  attempts: AttemptCost[];        // only attempts that opened a payment session
  first_observed_at: DateTime | null;
  updated_at: DateTime | null;
  billable: Fees;                 // the "delivered" attempts only
}
interface CostSummary {
  start: DateTime;
  end: DateTime;
  by_class: Record<CostClass, Fees>;                    // all four keys
  jobs_with_cost: number;                               // status observed | corrected
  jobs_pending: number;
  by_app: Record<string, Partial<Record<CostClass, Fees>>>;
}
interface Reconciliation {
  application_id: string;
  actor_id: string | null;
  allocation_id: string;
  provider_spent: MoneyOutput | null;
  by_class: Record<CostClass, Fees>;
  unattributed: Fees;
  balanced: boolean | null;
}
interface SyncReport { pages: number; rows_seen: number; rows_new: number; jobs_updated: number; }

// ── payments ───────────────────────────────────────────────────────────────────
interface SecretRef { ref: string; }                    // an opaque handle, e.g. "db:…"; never a secret
interface ProvisionedActor {
  application_id: string;
  actor_id: string;
  grant_id: string;
  allocation_id: string;
  api_key_id: string;             // Batteries' id of the lpg_ key, not the key
  secret_ref: SecretRef;
  currency: Currency;
  status: AllocationStatus;
  created_at: DateTime;
  updated_at: DateTime;
  label: string;                  // maxLength 200
}
interface KnownActor {
  application_id: string;
  actor_id: string;
  label: string;                  // operator's label, else the provider's name, else ""
  name: string | null;            // JWT mode only
  allocation: ProvisionedActor | null;
  first_seen_at: DateTime | null;
  last_seen_at: DateTime | null;
  provisioned: boolean;           // computed: allocation !== null (true for revoked too)
}
interface Allowance {
  allocation_id: string;
  status: string;                 // the provider's string
  granted: MoneyOutput | null;
  spent: MoneyOutput | null;
  available: MoneyOutput | null;
}
interface GrantRecord {
  id: string;
  name: string;
  status: string;
  currency: string;               // "USD" | "ETH" in practice
  total: string;                  // decimal string
  metadata: Record<string, string>;
}
interface FundRequest {           // request; unknown fields are a 422
  amount: MoneyInput;
  operation_ref: string;          // 1–200
  grant_id?: string;              // default ""; only for grant funding
}
interface ProvisionBody {         // request
  amount: MoneyInput;
  label?: string;                 // default ""; maxLength 200
  grant_id?: string;              // default ""; d67836b: maxLength 200
  operation_ref: string;          // 1–200
}
interface GrantBody   { name: string; amount: MoneyInput; operation_ref: string; }   // request
interface StatusBody  { status: AllocationStatus; }     // request; only "active" | "paused" are accepted
interface RotateBody  { operation_ref: string; }        // request

// ── health ─────────────────────────────────────────────────────────────────────
interface EngineHealth {
  ready: boolean;
  discovery_fresh: boolean;
  discovery_observed_at: DateTime | null;
  discovery_error: string | null;
  cost_sync_at: DateTime | null;
  cost_sync_error: string | null;
  running_jobs: number;
  allocation_mode: AllocationMode;
  version: string;
}

// ── reserved (defined, served by routes that answer 501) ───────────────────────
interface EngineEvent {
  sequence: number;               // the cursor; strictly increasing
  id: string;                     // stable; de-duplicate on it
  type: EventType;
  schema_version: number;
  occurred_at: DateTime;
  application_id: string;
  actor_id: string;
  job_id: UUID;
  operation_ref: string | null;
  payload: Record<string, unknown>;   // the Job for job events; the JobCost for cost events
}
interface EventPage { events: EngineEvent[]; next_cursor: number; }
interface SessionRequest {        // request
  app: string;
  operation_ref?: string | null;
  max_duration_s?: number;        // int > 0, default 3600
  idle_timeout_s?: number;        // int > 0, default 300
}
interface Session {
  id: UUID;
  job_id: UUID;
  application_id: string;
  actor_id: string;
  app: string;
  state: SessionState;
  proxy_path: string;             // engine-relative; forwards HTTP, SSE and WebSocket
  opened_at: DateTime | null;
  closed_at: DateTime | null;
}

// ── FastAPI validation errors (422) ────────────────────────────────────────────
interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}
interface HTTPValidationError { detail?: ValidationError[]; }
```

On the wire but not in `components.schemas`:

```ts
interface EngineErrorBody { error: string; }
interface ReservedErrorBody extends EngineErrorBody { milestone: string; ticket: string; }           // 501
interface JobFailedBody extends EngineErrorBody { job: Job; }                                        // failed POST /v1/jobs
interface OperationErrorBody extends EngineErrorBody {                                               // 409
  code: "operation_exists" | "operation_in_progress" | "operation_conflict";
  job?: Job;
  operation?: { command: string; operation_ref: string; state: "started" | "done" };
}
interface AlreadyProvisionedBody extends EngineErrorBody { code: "already_provisioned"; actor: ProvisionedActor; }
interface TooLargeBody extends EngineErrorBody { code: "request_too_large"; limit_bytes: number; }   // 413
```

---

## 5. Jobs

Sources: `docs/contracts/engine.md`, `services/jobs.py`, `services/failover.py`, `services/streams.py`, `http/app.py`, `http/streaming.py`.

### 5.1 How a job is run today

**Synchronously.** `POST /v1/jobs` holds the HTTP request open while the engine dispatches, and the response **is** the runner's answer: its status code, its content type, its bytes, plus the header `Livepeer-Job-Id: <uuid>`. The engine does not wrap the body in an envelope.

Sequence (`services/jobs.py` `run`, `_admit_request`, `_candidates`):

1. Policy check `jobs.run`; `mode="async"` → 501; `path` must start with `/`.
2. Idempotency check on `(application_id, actor_id, operation_ref)`.
3. Admission slot (`LPB_MAX_CONCURRENT_JOBS`, default 64) → 503 + `Retry-After` when full.
4. Job row written `running`.
5. Candidates for the app from the discovery snapshot; none → `no_offering`; all busy → `no_capacity`.
6. The actor's payment credential; none → `not_provisioned` (402).
7. Runners ordered (`MostCapacityFirst`, paid-capable first), then tried up to `max_attempts`. Each attempt row is written `in_flight` before the call. The engine answers the runner's 402 by asking the signer, stores the manifest before signing, sends the paid request.
8. Job finished `succeeded`, `failed` or `uncertain`.

The body is **returned once and not retained**: the job records only a `ResultRef` (`storage: "inline"`, content type, size, sha256). The request body is not stored either, only a fingerprint (`services/request_identity.py`).

A missing `payload` is sent to the runner as `{}` (tech debt T15).

### 5.2 Interaction modes and their code names

| Mode | Code name | Status |
| --- | --- | --- |
| Single-shot, buffered | `JobRequest.mode = "immediate"` (`ExecutionMode`, `contracts/jobs.py:13`); `jobs.run`; `RunnerTransport.call` | **Implemented** |
| Single-shot, streamed | Still `mode = "immediate"`: "streaming is a delivery choice, not an execution mode". Selected by `?stream=true` or `Accept: text/event-stream`; `jobs.streaming.stream` → `JobStream`; `StreamingRunnerTransport.open` | **Implemented** |
| Queued | `mode = "async"`, job state `queued`, `ResultRef.storage = "stored"`, `jobs.submit` | **Reserved: 501** (M4, ISS-26) |
| Persistent session | `Runner.mode = "persistent"` / `Offering.modes`; `SessionRequest`, `Session`, `SessionState`; `SessionManager.open/close` (`protocols/__init__.py:449-454`) | **Reserved: 501** (M4, ISS-27) |
| Continuous media | none | Stretch scope, explicitly distinct from persistent sessions |

Runner-side, the engine distinguishes `Runner.mode` `"single-shot"` and `"persistent"` but "the engine never filters runners by `mode`": a `POST /v1/jobs` to a persistent app with no `path` reserves a paid session and returns the orchestrator's `{session_id, app_url, control_url}` inline (defect P1, `docs/design-docs/m4-guides/iss-27-persistent-endpoints.md`). Six of the 27 live offerings are persistent-only: `live-transcode`, `live/flux-klein`, `live/sd-turbo`, `live/video-to-video`, `livepeer-example/swarm-publish-demo`, `media/ffmpeg-live`.

### 5.3 States and lifecycle

```text
POST /v1/jobs ─► running ─► succeeded      a runner answered 2xx
                        ├─► failed         a known outcome: nothing ran, or the runner answered an error
                        └─► uncertain      payment went out (or may have) and the outcome is unknown
(queued is reserved for async)
```

- `uncertain` is never retried automatically, and is kept by retention.
- A restart resolves leftover `running` jobs to `uncertain` (may have paid) or `failed`, with `failure.kind = "interrupted"` (`services/failover.py` `recover_interrupted`).
- There is no cancel route and no delete route.
- A job's `failure` is its **last** attempt's; `failure.payment_sent` is true when any attempt was paid.

Attempt outcomes: `in_flight`, `succeeded`, `refused` (orchestrator 503), `unreachable`, `payment_refused` (signer refused this orchestrator), `payment`, `timeout`, `http`, `abandoned` (caller stopped reading a stream), `payment_unknown`.

Failover in short (`docs/contracts/engine.md`, "Behavior the contract fixes"): an unpaid refusal fails over; a paid refusal (503, 404, 409) fails over to **another orchestrator**, at most `LPB_MAX_PAID_ATTEMPTS` (2) times; a paid timeout, 502 or 504 is `uncertain`; a paid 500 or 4xx is `failed`. The live history has one such job: attempt 1 paid, HTTP 404, failed over; attempt 2 paid, HTTP 400; job `failed`, both attempts `failed_after_payment`.

### 5.4 Failure kinds and the REST status of a failed `POST /v1/jobs`

Body `{"error": message, "job": Job}`, header `Livepeer-Job-Id` (`http/app.py:78-93`, `407-421`).

| `failure.kind` | `reason` | Status | `Retry-After` |
| --- | --- | --- | --- |
| `no_offering` | | 404 | |
| `no_capacity` | | 503 | 5 |
| `not_provisioned` | | 402 | |
| `refused`, `unreachable` | | 503 | 5 |
| `payment` | `not_authorized` | 403 | |
| `payment` | `allowance_exhausted` | 402 | |
| `payment` | `signer_unavailable` or none | 503 | 10 |
| `payment_unknown` | `signer_unknown` | 503 | |
| `timeout` | | 504 | |
| `runner_rejected` | | the runner's own 4xx (else 422) | |
| `runner_error` | | 502 | |
| `interrupted` | | 502 | |
| `abandoned` | | n/a (the response had started) | |

Two ambiguities to code for: 402 is both `not_provisioned` and `allowance_exhausted`; 403 is either the access policy (no `job` in the body) or `not_authorized` (with `job`). Branch on `job.failure.kind` and `reason`, not the status.

### 5.5 Idempotency (`operation_ref`)

Fingerprint: `app`, `path`, `method`, `payload` or raw body digest, `capability`, `model`, `content_type`, `headers`, `return_http_errors`. Timeouts may differ.

| The reference names a job that… | Answer |
| --- | --- |
| does not exist, or no reference given | runs |
| has a different fingerprint | 409 `operation_conflict` |
| is `running` | 409 `operation_in_progress`, `Retry-After: 1`, the job in the body |
| `succeeded` or `uncertain` | 409 `operation_exists`, the job in the body |
| `failed` and never reached a runner | runs a **new job** under the same reference |
| `failed` any other way | 409 `operation_exists` |

A repeat never returns the first result, because the engine did not keep it.

### 5.6 Streaming

`POST /v1/jobs?stream=true` (or `Accept: text/event-stream`):

- The headers wait for the runner's first chunk, so any failure before it is an ordinary error response with the job.
- After the first chunk the engine relays bytes untouched (SSE, ndjson, audio all the same) with `Livepeer-Job-Id` and `Cache-Control: no-cache`.
- A failure after the first chunk **aborts the connection**; nothing is written into the stream. Read `GET /v1/jobs/{id}` for the outcome.
- Deadlines: `timeout_s` (whole job), `first_byte_timeout_s`, `idle_timeout_s`.
- A client disconnect gives the runner `LPB_STREAM_SETTLE_S` (1 s) to finish; otherwise the attempt is `abandoned` and the job `uncertain` if paid.
- `return_http_errors: true` (streaming only) hands back the runner's non-2xx status and bytes instead of an engine error; the job is still recorded failed.

### 5.7 What async, sessions and events return today, and the planned shape

| Surface | Today | Planned (proposals, "nothing here is decided until it is locked") |
| --- | --- | --- |
| `POST /v1/jobs` with `mode:"async"` | 501 `milestone: "M4"`, `ticket: "ISS-26"` | **202** with the `Job` (`state: "queued"`), `Location: /v1/jobs/{id}`; an in-process queue on the engine database; a repeat returns the existing job with `Idempotent-Replayed: true`; `EngineHealth` gains `queued_jobs`, `oldest_queued_s` (`docs/design-docs/m4-guides/iss-26-async-jobs.md`) |
| `GET /v1/jobs/{id}/result` | 501 `M4` / `ISS-26` (after 403 and 404 checks) | The stored bytes and content type; 409 + `Retry-After` while queued or running; **410** for an expired result and for an immediate job; `ResultRef(storage="stored", location="/v1/jobs/{id}/result", expires_at)` |
| `POST /v1/sessions` | 501 `M4` / `ISS-27` | A session is a job holding one paid reservation; `Session.proxy_path`; traffic through `ANY /v1/sessions/{id}/app/{path}` including WebSocket upgrade; clients never see the runner's URL (`…/iss-27-persistent-endpoints.md`) |
| `GET /v1/events` | 501 `milestone: "held"`, `ticket: "ISS-18"` | `{events, next_cursor}`; five event types; payload is the `Job` or the `JobCost`; a retention window and **410** on an expired cursor; "no replay from zero"; pull only (`docs/contracts/events.md`, `…/iss-46-events-feed.md`) |

Until then a UI has polling only: `GET /v1/jobs/{id}` and `/cost`.

### 5.8 Usage reporting

`POST /v1/jobs/{id}/usage` with `{"quantities": {"<unit>": <int>}}`: once per job, by its owner (or an admin), only for a `succeeded` job. Stored as `Job.usage` with `source: "app_reported"`. Units are the app's own and are "never summed across apps", so no summary endpoint totals usage. `engine_meter` is a later extension.

---

## 6. Money

Source: `docs/contracts/payments.md` (the task's "docs/payments.md"), `contracts/costs.py`, `services/costs.py`, `adapters/batteries.py`.

### 6.1 Summary of the payments contract

- **Path.** The engine presents the actor's allocation key (`lpg_…`) to the remote signer; the signer asks Batteries, which checks the balance; the signer signs a ticket and emits one `create_signed_ticket` event; Batteries de-duplicates and debits the allocation.
- **Modes.** `per_actor` (default): one allocation and key per actor, cap enforced by the signer, exact per-user spend. `per_application`: one shared key from settings, nobody enforces a per-user cap. In `per_actor` there is no fallback: an unprovisioned actor fails before payment (`not_provisioned`).
- **Provisioning is explicit.** Provision, fund, fund grant, create grant, set status, revoke and rotate key are admin commands. Money-moving ones take a required `operation_ref` and are recorded in the operation ledger before the first provider call; a repeat is answered from the record (`Idempotent-Replayed: true`), a different request under the same reference is 409 `operation_conflict`, one still running is 409 `operation_in_progress` with `Retry-After`, and one stuck for `LPB_OPERATION_STALE_S` (120 s) is resumed.
- **Three things called "funding".** An *allowance change* (engine admin command, Batteries bookkeeping); *signer funding* (the payer's on-chain TicketBroker deposit, outside the engine); a *spending guarantee* (does not exist: the allowance can overshoot).
- **Wholesale vs retail.** The engine shows wholesale only: rates before a job (`Offering.rate_low/high`), fees after (`JobCost.fees`, `billable`).
- **Pricing assumptions.** A rate is a price per unit exactly as advertised, not a quote. `seconds` rates cost rate × funded time, so the total is known only after the job; `fixed` is one price per paid request. Failover can pay more than once. The engine's price ceiling is the advertised rate + 1.2 %. It never signs without a ceiling. Tickets are probabilistic: reported cost is expected value at signing. `price_usd` is the advertiser's figure. A rate has an age; staleness is information, never a payment gate.
- **Correlation.** A charge joins an attempt by `(allocation_id, payment_session_id)`, resolved from the `manifest_id` the attempt recorded. Manifests are 32 bits, so collisions can turn a match `ambiguous` (about 1 % by 10,000 sessions on one allocation).
- **Who answers a refusal.** Batteries decides, the signer passes it on, the engine reports `Failure.reason`. A paused allocation reads as `not_authorized`.
- **Mode B** (a hosted payment operator serving many enterprises) is deferred to M4.

### 6.2 How wholesale cost is recorded

1. Each attempt records its `allocation_id` and one `SignedSession` per manifest it asked the signer for, with `payment_state` `unknown` → `paid` | `unpaid`.
2. A background **cost sync** (every `LPB_COST_SYNC_INTERVAL_S`, 30 s; on demand with `POST /v1/admin/costs/sync`) pages Batteries `GET /v1/usage`, stores the rows, matches sessions (`match`: `unmatched` → `matched` | `ambiguous`) and stores a projection for each affected job that has ended.
3. Reads (`for_job`, `recent`, `summary`, `reconcile`) use stored projections and compute live any job not covered, in one consistent snapshot.

Only `applied` usage rows count.

### 6.3 How it is reported

| Route | Type | Scope |
| --- | --- | --- |
| `GET /v1/jobs/{id}/cost` | `JobCost` | one job |
| `GET /v1/costs/projections` | `JobCost[]` | the 25 most recent jobs at most |
| `GET /v1/costs/summary` | `CostSummary` | jobs created in a window, by class and by app and class |
| `GET /v1/allowance` | `Allowance` | one allocation's granted, spent, available |
| `GET /v1/admin/reconciliation` | `Reconciliation` | one allocation: classes + unattributed vs provider spent |

**Cost class** (per attempt that opened a payment session):

| Class | Rule | Typical treatment |
| --- | --- | --- |
| `delivered` | the attempt succeeded | bill |
| `failed_after_payment` | payment went out and the attempt failed, including one the job failed over from | absorb |
| `uncertain` | the attempt that left the job `uncertain`, or an ambiguous match | hold, then reconcile |
| `pending` | the job is still running, or no applied usage row has arrived yet | wait; **never zero** |
| `unattributed` (reconciliation only) | rows on the allocation that match no recorded attempt | operator's problem |

**Cost status** (per job): `none` (ended, no attempt recorded a session), `pending`, `observed`, `corrected` (the total changed after first being observed).

**Pending vs settled.** In the engine's terms the final states are `observed` and `corrected`: "`fees` and `billable` are final once `status` is `observed` or `corrected`". `pending` figures can still grow. "Settled" in the on-chain sense (winning-ticket redemption) is never reported per job.

**`fees` vs `billable`.** `fees` is everything the job cost the allocation; `billable` is the `delivered` attempts only. A failed job has `billable` zero; a job that failed over then succeeded bills only the delivering attempt.

### 6.4 Units, currency, precision

| Field | Unit | Notes |
| --- | --- | --- |
| `ObservedRate.amount` / `NetworkRate.amount` | **wei** per `unit` | integer-valued decimal string; can exceed 2^53 (`"11136884956480"` live). `0` is free |
| `…unit` | `seconds` (metered) or `fixed` (per paid request) | other units make the offering `missing` |
| `…price_usd` | USD per the same unit | the advertiser's figure; `null` for go-livepeer orchestrators; up to 36 decimal places and `E` notation live |
| `Fees.fee_eth` | ETH | always present; 18 decimal places typical; `E` notation possible (`"4.745768792E-8"`) |
| `Fees.fee_usd` | USD | `null` when an applied row lacks a USD price; `"0"` with no rows |
| `Fees.row_count` | count | applied Batteries usage rows |
| `Money.amount` | `USD` or `ETH` (`Money.currency`) | exact decimal string. USD grants are the default (`LPB_DEFAULT_CURRENCY`) |
| `GrantRecord.total` | the grant's currency | decimal string |
| `MeasuredUsage.quantities` | the app's own | integers |
| `CallTimings.*_ms` | milliseconds | integers |

"Batteries amounts are exact decimal strings; the engine stores them as strings and sums them as `Decimal`." A client must parse with a decimal type and accept `E` notation; `parseFloat` loses precision, and a naive `BigInt()` on a wei string fails if it ever carries an exponent. The engine does **no** currency conversion: `fee_usd` is Batteries' own computed figure per row.

The live allocation is in USD: granted `0.25`, spent `0.025886863010155183`.

---

## 7. Provider protocols

All extension interfaces are `typing.Protocol` classes in **`src/livepeer_builder/protocols/__init__.py`**. "Cross-cutting concerns enter only through `livepeer_builder.protocols`" (`ARCHITECTURE.md`, "Providers"). They are wired in `runtime/assembly.py` (`EngineSupply` to replace a part, `Decorate` to wrap one, `default_parts` for the defaults).

### 7.1 Identity

```python
class Authenticator(Protocol):                                   # protocols/__init__.py:57-68
    async def authenticate(self, request: AuthRequest) -> ActorContext | None: ...
    def challenge(self) -> str | None: ...                       # a WWW-Authenticate value

class AccessPolicy(Protocol):                                    # :71-76
    def check(self, actor: ActorContext, operation: Operation,
              resource: ResourceRef | None = None) -> None: ...  # raises AccessDenied

class SecretStore(Protocol):                                     # :79-86
    async def put(self, name: str, secret: str) -> SecretRef: ...
    async def get(self, ref: SecretRef) -> str: ...
    async def delete(self, ref: SecretRef) -> None: ...
```

| Protocol | Implementations |
| --- | --- |
| `Authenticator` | `ApiKeyAuthenticator` and `AuthenticatorChain` (`adapters/auth.py`); `JwtBearerAuthenticator` with `JwksCache` (`adapters/jwt.py`, built by `jwt_authenticator(settings)`); `SightingRecorder` wraps the chain to record sign-ins (`services/sightings.py`). A trusted-backend `ServiceCredentialAuthenticator` is defined in the docs, not built |
| `AccessPolicy` | `DefaultPolicy` (`services/policy.py`) |
| `SecretStore` | `SettingsSecretStore`, `EncryptedDbSecretStore` (Fernet, `LPB_SECRET_KEY`), `RoutingSecretStore` (`adapters/secrets.py`) |

Identity contracts: `ActorContext`, `AuthRequest`, `AuthProvenance`, `ResourceRef`, `Operation` (`contracts/access.py`).

### 7.2 Payment

```python
class CredentialResolver(Protocol):                              # :169-172
    async def credential(self, actor: ActorContext) -> PaymentCredential: ...   # raises NotProvisioned

class AllocationManager(Protocol):                               # :175-207  (the provider's management API)
    async def create_key_for_grant(self, grant_id: str, name: str, amount: Money, idempotency_key: str) -> NewAllocationKey: ...
    async def create_key(self, allocation_id: str, name: str, idempotency_key: str) -> NewAllocationKey: ...
    async def fund_allocation(self, allocation_id: str, amount: Money, idempotency_key: str) -> None: ...
    async def fund_grant(self, grant_id: str, amount: Money, idempotency_key: str) -> None: ...
    async def set_allocation_status(self, allocation_id: str, status: str) -> None: ...
    async def revoke_allocation(self, allocation_id: str) -> None: ...
    async def revoke_key(self, api_key_id: str) -> None: ...
    async def read_allocation(self, allocation_id: str) -> Allowance: ...
    async def list_grants(self) -> list[GrantRecord]: ...
    async def grant_page(self, cursor: str | None) -> GrantPage: ...
    async def create_grant(self, name: str, amount: Money, metadata: Mapping[str, str] | None = None) -> GrantRecord: ...

class UsageSource(Protocol):                                     # :210-213
    async def page(self, cursor: str | None, limit: int = 1000) -> UsagePage: ...   # raises CursorMismatch

class AllowanceReader(Protocol):                                 # :216-221
    async def allocation_for(self, application_id: str, actor_id: str | None) -> str | None: ...
    async def read_allowance(self, allocation_id: str) -> Allowance: ...
```

| Protocol | Implementations |
| --- | --- |
| `AllocationManager` | `BatteriesClient` (`adapters/batteries.py:40`). Used twice: with `LPB_BATTERIES_TOKEN` as the allocation manager, with `LPB_BATTERIES_OPERATOR_TOKEN` as the grant desk's manager |
| `UsageSource` | `BatteriesUsageSource` (`adapters/batteries.py:165`) |
| `CredentialResolver`, `AllowanceReader` | `PaymentsService` (`services/payments.py:87-112`) |

Batteries is the only payment provider implemented. The Batteries routes each method calls are tabled in `docs/references/batteries-api.md`.

### 7.3 The rest

| Protocol | Signature | Default |
| --- | --- | --- |
| `DiscoverySource` (`:92-93`) | `async fetch() -> tuple[Runner, ...]` | `HttpDiscoverySource` (`adapters/sdk.py:37`) |
| `SelectionPolicy` (`:96-97`) | `order(candidates, request) -> Sequence[Runner]` | `MostCapacityFirst` (`services/discovery.py`) |
| `RunnerTransport` (`:104-119`) | `async call(runner, request, credential, on_signed=None) -> RunnerReply` | `SdkRunnerTransport` (`adapters/sdk.py:82`; the paid call itself is `adapters/runner_call.py`) |
| `StreamingRunnerTransport` (`:150-163`) | adds `async open(...) -> RunnerStream` | `SdkRunnerTransport` |
| `EngineStore` (`:428-437`) = `ActorRepo`, `KeyRepo`, `JobRepo`, `OperationRepo`, `CostRepo`, `SecretRepo` | persistence | `SqlStore` (`store/sql.py`; SQLite or PostgreSQL) |
| `Clock` (`:50-51`) | `now() -> datetime` | `SystemClock` |
| `EventFeed` (`:443-446`) | `async after(actor, cursor, limit=500) -> EventPage` | `ReservedEventFeed` (501) |
| `SessionManager` (`:449-454`) | `async open(actor, request) -> Session`, `async close(actor, session_id) -> Session` | `ReservedSessions` (501) |

What the engine *offers* (as opposed to needs) is in `src/livepeer_builder/api.py`: `ActorApi`, `AdminApi`, `EngineApi` and their parts (`JobsApi`, `CostsApi`, `DiscoveryApi`, `PaymentsAdminApi`, `KeysApi`, `GrantsApi`, …). Fakes for tests are in `src/livepeer_builder/testing/` (`FakeEngine`, `make_engine`). Generated listings: `docs/generated/interfaces.md`, `docs/generated/contracts.md`.

---

## 8. Configuration, running and versioning

### 8.1 How the live engine is run

From `docker ps` (names and images only; nothing was inspected):

| Container | Image | Port |
| --- | --- | --- |
| `builder-console-engine-1` | `builder-console/engine:1514212` | `127.0.0.1:8090 → 8080` |
| `builder-console-discovery-1` | `builder-console/engine:1514212` (presumably the `lpb discovery` service that commit still had; inferred from the name) | internal |
| `builder-console-signer-1` | `builder-console/node:406b248` | internal |
| `builder-console-clearinghouse-1` | `builder-console/clearinghouse:ca09e47` | internal |
| `builder-console-console-1` | `builder-console/console:local` | `127.0.0.1:3060 → 3000` |

So the engine at `:8090` appears to belong to the compose project of the reference app ("the console", `NE-Build-Track/builder-core-console`; inferred from the project name `builder-console`), built locally from engine commit `1514212`. Its version reads `0.0.1.dev1+g15142129e` because it was built from a git context without tags (`docs/design-docs/m5-guides/iss-38-release.md`, "Versioning"). Live settings visible through the API: `allocation_mode: per_actor`, API keys on, grant desk on, cost sync working, Swagger UI at `/docs`.

### 8.2 Images, packages, tags

- **Nothing is published.** No PyPI package ("`livepeer-builder` is not on PyPI"), no GitHub release, no registry image ("builds never push. No GHCR packages") (`…/iss-38-release.md`).
- **The only Dockerfile** is `deploy/dev-stack/engine/Dockerfile`: `python:3.12.7-slim`, `pip install ".[server,postgres]"` from the source tree, runs as uid 10001 `lpb`, `LPB_DATABASE_URL=sqlite+aiosqlite:////data/livepeer-builder.db`, `LPB_HTTP_HOST=0.0.0.0`, `LPB_HTTP_PORT=8080`, `CMD ["lpb","serve"]`.
- **Dev-stack image names** (`deploy/dev-stack/compose.yaml`): `[<IMAGE_REGISTRY>/]livepeer-builder-dev/engine:local`, `…/livepeer-builder-dev/node:f45d83f` (signer and discovery), `…/livepeer-builder-dev/clearinghouse:ca09e47`. `IMAGE_REGISTRY=registry.livepeer.tools` in `.env.example` only prefixes local tags. CI builds `livepeer-builder-engine:ci` and discards it.
- **Version** comes from git tags through hatch-vcs (`pyproject.toml`); only `v[0-9]*` tags count. Tags present: `v0.1.0` = `m2-foundation-and-integration-contracts` (`153f0de`, 19 Oct), `v0.2.0` = `m3-complete-builder-journey` (`28ae6a9`, 11 Nov).
- **Upstream pins** (`docs/references/upstream-baseline.md`): livepeer-python-gateway `2017a80` (a git direct reference, so installing needs `git`), livepeer/node `f45d83f`, clearinghouse-batteries `ca09e47`.
- **Repository:** `https://github.com/NE-Build-Track/livepeer-builder-core.git`. License MIT.

### 8.3 What "pinning the engine" should reference

A **git commit SHA of `NE-Build-Track/livepeer-builder-core`**, used as a Docker build context (the console does `context: https://github.com/NE-Build-Track/livepeer-builder-core.git#<sha>`), with the tag named beside it for readers. There is no image digest or package version to pin instead. Choose deliberately between:

- `15142129ebbf51103658f8ad48fd5adae052c56d`: what is running now (pre-`v0.2.0`; old `Runner` shape; needs the old `lpb discovery` sidecar).
- `28ae6a9` (`v0.2.0`): the M3 release; new `Runner` shape; needs `LPB_DISCOVERY_URL` pointing at livepeer/node's `livepeer-discovery` at `f45d83f`.

Record the pin's `/openapi.json` (or `docs/generated/openapi.json` at that commit) with it and diff on every bump: the generated schema is the contract and is drift-checked in the engine's CI (`lpb gen-docs --check`). Check at runtime that `GET /readyz` → `version` ends in the pinned short SHA (a tagless build reports `0.0.1.dev1+g<sha>`).

### 8.4 Configuration

Environment variables only, prefix `LPB_`, one per `EngineSettings` field (`config.py`, `EngineSettings.from_env`); there is no config file for the engine itself. Full table: `docs/RELIABILITY.md#configuration`. The ones that change what a client sees:

| Variable | Default | Effect |
| --- | --- | --- |
| `LPB_DATABASE_URL` | `sqlite+aiosqlite:///./livepeer-builder.db` | or `postgresql+asyncpg://…` |
| `LPB_DISCOVERY_URL` | required at `v0.2.0` | the `/discovery` document; polled every `LPB_DISCOVERY_INTERVAL_S` (15 s) |
| `LPB_SIGNER_URL` | unset | the remote signer; without it nothing is paid |
| `LPB_ALLOCATION_MODE` | `per_actor` | or `per_application` with `LPB_SHARED_PAYMENT_KEY`, `LPB_SHARED_ALLOCATION_ID` |
| `LPB_BATTERIES_URL`, `LPB_BATTERIES_TOKEN` | unset | provisioning, allowance and cost sync; without them those answer 503 |
| `LPB_BATTERIES_OPERATOR_TOKEN` | unset | turns on `GET`/`POST /v1/admin/grants` |
| `LPB_SECRET_KEY` | unset | Fernet key for stored payment keys; required to provision |
| `LPB_DEFAULT_CURRENCY` | `USD` | grant and allocation currency |
| `LPB_AUTH` | `api_keys` | `jwt` turns key routes off; `jwt,api_keys` accepts both |
| `LPB_JWT_*` | | issuer, audience, claims, admin and auditor scopes |
| `LPB_MAX_CONCURRENT_JOBS`, `…_PER_APP` | 64, unset | admission (503) |
| `LPB_MAX_PAID_ATTEMPTS` | 2 | paid failover cap |
| `LPB_COST_SYNC_INTERVAL_S` | 30 | how soon a cost leaves `pending` |
| `LPB_RATE_MAX_AGE_S` | 600 | when an offering turns `stale` |
| `LPB_RETENTION_JOBS_DAYS`, `LPB_RETENTION_USAGE_DAYS` | unset (keep forever) | purged jobs disappear from history; `uncertain` jobs are kept |
| `LPB_HTTP_HOST`, `LPB_HTTP_PORT` | `127.0.0.1`, `8080` | |
| `LPB_HTTP_MAX_REQUEST_BYTES` | 16 MiB | 413 limit |
| `LPB_OPERATION_STALE_S` | 120 | when a stuck admin command is resumed |

Config files exist only for the neighbours in the dev stack: `deploy/dev-stack/config/{clearinghouse,signer,discovery}.toml`, `deploy/dev-stack/.env.example`.

### 8.5 Running and health

```sh
uv run lpb migrate            # or LPB_AUTO_MIGRATE=true (default)
uv run lpb bootstrap-admin    # prints the first admin key once: {"key_id", "token", "note"}
uv run lpb serve
```

Other commands: `lpb revision`, `lpb gen-secret-key`, `lpb smoke`, `lpb backup|verify|restore`, `lpb purge`, `lpb gen-docs [--check]` (`cli.py`).

- `GET /livez` → `{"status":"ok"}`.
- `GET /readyz` → `EngineHealth`, 200 or 503.
- No `/healthz`, no `/metrics` (404; tech debt T4). Logs are JSON lines with an `event` field.
- One engine process per database: "No HA", "No exactly-once", "No SLA".
- The engine starts background loops for discovery, cost sync and retention (`runtime/engine.py:73-102`).

---

## 9. Gaps and surprises for a front end

**Environment**

1. **Version skew** (0.1): the running engine is `15142129e`, the reference clone is `v0.2.0`+. `Runner` differs. Decide the pin before generating types.
2. **The "admin" token is not an admin** (0.2). No admin-only route could be verified, and no admin write will work with it.
3. **No builder key** in `.env`: nothing was verified from a builder's point of view.

**Shape of the API**

4. **No CORS.** A browser cannot call the engine directly; livepeer needs a server-side proxy, which is also where tokens must stay ("browsers never hold admin, management or payment credentials").
5. **No "who am I" route.** A token cannot be asked for its kind, actor, application or permissions. The UI must remember that beside the token, or probe.
6. **No application or customer model.** `application_id` is a bare string; nothing lists applications; an actor has only `actor_id` and a `label`. Names, emails and organisations must live in livepeer.
7. **`POST /v1/jobs` returns the runner's raw response**, not JSON about the job. The job id is only in the `Livepeer-Job-Id` header. The client must keep the body: the engine cannot give it again (`/result` is 501, and immediate results will be 410 even in M4).
8. **Job history has no inputs and no outputs.** Neither the request payload nor the result is stored; a history view can show only app, state, attempts, a result hash and size.
9. **Two error envelopes** (`{"error"}` and FastAPI's `{"detail"}`), and **no machine-readable `code`** except on 409 and 413. The reference console "decides state by matching error text". 402 and 403 are each ambiguous (5.4).
10. **Route presence varies by deployment**: key routes vanish with `LPB_AUTH=jwt`, grant list/create without the operator token. Read `/openapi.json` at start rather than assuming.

**Lists**

11. **`GET /v1/jobs`**: time cursor only (`before`), max 500, no total, **no filter by state, app or actor** (an auditor gets every actor's jobs mixed), and two jobs with the same microsecond `created_at` can be split across pages and one skipped.
12. **`GET /v1/costs/projections`**: 25 rows at most, no paging, no filter. Costs for a longer history are one `GET /v1/jobs/{id}/cost` per job (N+1). `Job` carries no cost.
13. **`GET /v1/admin/keys`** and **`GET /v1/admin/grants`**: no pagination or search. **`GET /v1/admin/actors`**: `limit` only, no cursor.
14. **No balances in lists.** `KnownActor` has no allowance: one `GET /v1/allowance?actor_id=` per actor. `GrantRecord.total` is the grant's total, not what is left.
15. **`GET /v1/costs/summary`** has `by_class` and `by_app` only: no time series, no per-actor or per-orchestrator breakdown, no usage totals. Charts over time need one call per bucket.

**Catalog**

16. **An offering's identity is `(app, currency, unit)`**, not `app`: `transcription` is listed twice. Key React lists accordingly.
17. **Offerings carry no description, input schema, model or examples.** The only descriptive data is `Runner.metadata`, a free-form JSON *string* behind an authenticated route. `capability` and `model` are unvalidated labels and are `null` on every live job.
18. **Persistent apps cannot be used** (sessions are 501), and running a plain job against one reserves a paid session (5.2). Hide or disable the 6 persistent offerings.
19. **No price quote.** A `seconds` rate has no total until the job ends. Rates are wei strings; `price_usd` can be `null`.
20. **History can name apps the catalog no longer lists** (`fal-flux-schnell`).

**Money**

21. **Decimal strings with `E` notation** and up to 36 decimal places; wei amounts beyond 2^53. Use a decimal library end to end.
22. **`fee_usd` can be `null`**, `Allowance.granted/spent/available` can each be `null`, `Reconciliation.balanced` can be `null`. Render "unknown", not zero.
23. **`pending` is not zero** and can grow; `none` means "ended without paying". A cost appears up to ~30 s after the job (cost sync interval).
24. **Allowance can overshoot**: `available` may go slightly negative.

**Admin**

25. **`GET /v1/allowance` and `GET /v1/admin/reconciliation` need `actor_id`** for an auditor or admin (404 otherwise), and reconciliation has no application-wide view in `per_actor` mode.
26. **`KnownActor.provisioned` is true for a revoked allocation.** Use `allocation.status`.
27. **`ProvisionedActor` exposes internals** (`secret_ref.ref`, `api_key_id`, `grant_id`, `allocation_id`). Not secrets, but not for display.
28. **`StatusBody` advertises four statuses; only `active` and `paused` are accepted.** A paused allocation surfaces to the builder as `not_authorized` (403), indistinguishable from an invalid key.
29. **Every money- or credential-creating POST needs a caller-chosen `operation_ref`** (422 without). Generate a UUID per user action and reuse it on retry.
30. **A key's token is shown once.** A replayed issue returns `token: null`. There is no way to recover it; rotate instead.
31. **An admin key is scoped to its own application for `/v1/jobs` and `/v1/costs/*`**, but not for `/v1/admin/keys` and `/v1/admin/actors`.
32. **No job cancel, no key or allocation un-revoke, no delete of anything.**

**Liveness**

33. **No events, webhooks or job-status stream** (events are 501): polling only.
34. **`/readyz` → `ready: true` does not mean healthy**; check `discovery_fresh` and the two `*_error` fields.
35. **`GET /v1/costs/summary` accepts a time with no offset** and treats it as UTC (and echoes it without `Z`), while `GET /v1/jobs?before=` rejects one with 422. Always send `Z`.

---

## 10. Not verified

- Any admin-only behaviour live (finding 0.2), including the success shape of `GET /v1/admin/grants`.
- Anything as a builder (`actor` key): the builder column of section 2.4 is from `services/policy.py` and the services, not from calls.
- Every non-GET route: status is from the source at `d67836b` only. The files involved (`services/jobs.py`, `services/payments.py`, `services/keys.py`, `services/grants.py`, `services/reserved.py`) are identical at the live commit `15142129e`, but nothing was executed.
- Streaming behaviour, 409 bodies, 413, the 401 for a bad `lpk_` key and the 503 `/readyz` body: from the source and docs.
- JWT mode: not enabled on the live engine.
- How the console's compose file configures the engine (env values were not read).
