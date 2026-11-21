# Capabilities and discovery on the Livepeer Network

Research for livepeer, 17 November 2026. Everything here is read from the cloned repos under
`.reference/` or from GET requests to the live engine. File paths are relative to the repo named in
each heading. Orchestrator hostnames are redacted (shape kept), digests are shortened, and no token
or wallet value appears.

| Source | Revision read |
| --- | --- |
| `node/` (livepeer/node) | `v1.0.7`, commit `eee09c4` |
| `livepeer-builder-core/` | `d67836b` (17 Nov 2026) |
| `live-runner-standard/` | `d1e9760`; registry release `2026.11.3`, tool `v0.3.0` |
| `livepeer-onchain-discovery/` | `29c6ad9` |
| Live engine `http://127.0.0.1:8090` | reports `0.0.1.dev1+g15142129e`, which is builder-core commit `1514212` (2 Nov 2026), an ancestor of the clone's HEAD |

**The live engine is older than the cloned source.** `/v1/offerings` has the same shape in both.
`/v1/runners` does not (section 4).

## The short version

1. The network has **no capability registry, on chain or off**. An orchestrator advertises *runner
   apps*: an open string `app`, a `mode`, capacity and a price. The chain only says which
   orchestrators exist and where their service URI is.
2. Discovery (`GET /discovery`) returns, per app: `url`, `app`, `mode`, capacity, `price_info`,
   `version`, `gpu`, and an opaque `metadata` **string**. There is no kind, pipeline, model,
   input schema or description field.
3. Meaning is layered on by the **live runner standard** (runner contract v1): `app` should be one of
   21 capability names, and `metadata` should be a JSON *envelope* of at most 1,024 bytes naming the
   model and one *wire profile* per endpoint. A wire profile ID resolves to a registry entry, an
   OpenAPI 3.1 document with the request JSON Schema. That registry is a git repository, not a
   network service.
4. The engine's public `/v1/offerings` throws the envelope away. It returns only `app`, `modes`, a
   price range and counts. The envelope is visible only through the authenticated `/v1/runners?app=`.
5. On the live network today, 10 of 26 app names are on the capability list, and 7 of the 16 wire
   profile IDs in use have no registry entry.

---

## 1. How a capability gets onto the network

### What a runner declares

A runner is an HTTP service behind an orchestrator. It registers one or more *apps* in one of two
ways (`node/docs/orchestrator.md`, "Register runners"):

**Static**: the orchestrator's `RunnerConfig` TOML file, loaded at startup. The real example,
`node/configs/orchestrator/runners.example.toml`:

```toml
[[Runners]]
ID = "local-runner"
RunnerURL = "http://127.0.0.1:9000"
App = "example"
Mode = "persistent"
Status = "ready"
Capacity = 2
HealthURL = "http://127.0.0.1:9000/healthz"
HealthCode = 200

# [Runners.GPU]
# ID = "0"
# Name = "H100"
# VRAMMB = 80000
```

With a price and GPU, from the test `TestStaticRunnerTOML` in `node/orchestrator/app_test.go`:

```toml
[[Runners]]
ID = "r"
RunnerURL = "https://runner.example/base"
App = "test"
HealthCode = 204
[Runners.GPU]
ID = "0"
Name = "H100"
VRAMMB = 80000
[Runners.PriceInfo]
Price = 1.5
Currency = "usd"
Unit = "fixed"
```

The full key set is the `StaticRunner` struct in `node/orchestrator/registry.go`: `ID`, `Proxy`,
`RunnerURL`, `Version`, `Metadata`, `GPU{ID, Name, VRAMMB}`, `App`, `Mode`, `Status`, `Capacity`,
`HealthURL`, `HealthCode`, `PriceInfo{Price, Currency, Unit}`. Unknown keys fail the whole file.

**Dynamic**: the runner calls `POST /runners/heartbeat` on the orchestrator with the bootstrap
credential (`BootstrapSecretFile`), then with the runner-scoped credential the response returns.
Each heartbeat carries a full snapshot (`heartbeatRequest` and `appRequest` in
`node/orchestrator/registry.go`, documented in `node/docs/http-api.md`, "Live Runner HTTP"):

| Level | Fields |
| --- | --- |
| Heartbeat | `runner_id`, `version` (runner SDK version), `seq` (strictly increasing), `apps[]` |
| Each app | `id`, `app`, `version` (application version), `runner_url`, `mode`, `proxy`, `capacity`, `price_info{price, currency, unit}`, `status`, `metadata`, `gpu`, `session_ids` |

An app dropped from a later snapshot is removed from discovery and its sessions drain
(`DrainTimeout`, default and maximum 12 hours).

### What the orchestrator enforces at registration

`validateApp` in `node/orchestrator/registry.go`:

| Field | Rule |
| --- | --- |
| `app` | Any non-empty string. No list, no pattern |
| `id` | ASCII letters, digits, `-`, `_`; at most 128 bytes. Unique per node; generated when omitted |
| `mode` | `"persistent"` or `"single-shot"`; empty becomes `"persistent"` |
| `status` | Any string; empty becomes `"ready"`. Only `"ready"` apps are advertised |
| `capacity` | 1 to 10000; 0 becomes 1 |
| `price_info.unit` | `"hour"` or `"fixed"` (or empty). `"720p"` is rejected by name |
| `price_info.currency` | `"usd"` only (`normalizePriceAt`) |
| `runner_url` | Absolute HTTP(S) URL |
| `metadata`, `version` | Any string; not interpreted |

Limits: 256 runners, 512 apps per runner, 1,024 apps per orchestrator (`maxRunners`,
`maxAppsPerRunner`, `maxApps`).

### On-chain and off-chain parts

| Part | Where it lives |
| --- | --- |
| Which orchestrators exist | On chain. `livepeer-onchain-discovery` walks the `BondingManager` pool on Arbitrum and keeps those where `isActiveTranscoder` is true (`livepeer-onchain-discovery/README.md`, "Who is eligible") |
| Where an orchestrator is reached | On chain: its `getServiceURI` in the AI Service Registry |
| Which apps (capabilities) it serves, capacity, price, metadata | **Off chain only.** They live in the orchestrator's in-memory registry and are served at `GET <service URI>/discovery` |
| Payment | On chain: probabilistic tickets redeemed through TicketBroker. Only an orchestrator on an on-chain `Network` advertises a price |
| What a capability name or wire profile *means* | Off chain: the `live-runner-standard` git repository |

An off-chain orchestrator (the default `Network = "offchain"`) "accepts quoted prices but advertises
free service" (`node/docs/orchestrator.md`): `price_info` is omitted from its discovery records.

### What the standard asks a runner to declare on top

`live-runner-standard/SPEC.md`, "Registration fields": `App` is a capability from
`capabilities.json` and nothing else, `Mode` matches that capability's mode, and `Metadata` is the
envelope as compact JSON. The node does not check any of this. The `runner-contract block` tool
prints this block (`live-runner-standard/python/runner-contract/README.md`):

```toml
[[Runners]]
ID = "qwen38-rig2"
App = "chat"
Mode = "single-shot"
Capacity = 8
RunnerURL = "http://vllm:8000"
HealthURL = "http://vllm:8000/health"
HealthCode = 200
Status = "ready"
Version = "vllm-0.32.0-qwen38"
Metadata = '{"runner_contract":1,"deployment_revision":"sha256:…",…}'
[Runners.PriceInfo]
Price = 1.00
Currency = "usd"
Unit = "hour"
```

---

## 2. The discovery endpoints

| Endpoint | Served by | Params | Auth | Notes |
| --- | --- | --- | --- | --- |
| `GET <ServiceURL>/discovery` | Each orchestrator (default `127.0.0.1:8935`) | None | None | That orchestrator's ready apps. Supports a deployment base path |
| `GET /discovery` | `livepeer-discovery` (default `127.0.0.1:8939`) | None | None | Aggregates the `Nodes` it is configured with; prepends a `nodes` metadata entry |
| `GET /discovery` | `livepeer-onchain-discovery` (`127.0.0.1:8939`) | None ("There is no app filter") | None | Sources come from the chain. Answers 503 until the first load completes |
| `GET /discover-orchestrators?app=&gpu=` | The remote signer (default `127.0.0.1:8937`) | `app` (exact app name), `gpu` (exact GPU name). Repeated values match any; both filters must match | Deployment-defined (kept private or behind a proxy) | Same runner fields, plus `last_seen` per orchestrator |
| `GET /v1/offerings?app=` | The engine | `app` optional, exact match | None (public) | Section 4 |
| `GET /v1/runners?app=` | The engine | `app` **required**, exact match | Bearer key with the `discover` permission | Section 4 |

Every `/discovery` shares one contract, `node/docs/discovery.schema.json`. A consumer cannot tell
the three servers apart.

### Response schema (`node/docs/discovery.schema.json`)

The body is a JSON array. Each item is a metadata entry or an orchestrator entry. Every object
allows additional properties.

| Object | Field | Type | Required | Meaning |
| --- | --- | --- | --- | --- |
| Metadata entry | `nodes[]` | array of node | Yes | Sources the aggregator queried. This entry has no `address` |
| Node | `url` | HTTP(S) base URL | Yes | The queried source |
| Node | `queried_at` | RFC 3339 | Yes | Its last successful query |
| Orchestrator entry | `address` | HTTP(S) base URL | Yes | The orchestrator's base URL. **Not an Ethereum address** |
| Orchestrator entry | `runners[]` | array of runner | Yes | Its ready apps |
| Runner | `url` | HTTP(S) URL | Yes | The app endpoint on the orchestrator |
| Runner | `app` | string, min length 1 | Yes | Application name |
| Runner | `observed_at` | RFC 3339 | Yes | Stamped by the orchestrator at response time; preserved by aggregators |
| Runner | `version` | string | No | Application version |
| Runner | `metadata` | string | No | "Application-supplied metadata" |
| Runner | `gpu` | `{id: string, name: string, vram_mb: integer}` | No | |
| Runner | `mode` | string | No | "This orchestrator emits persistent or single-shot; discovery forwards other upstream values unchanged" |
| Runner | `capacity` | integer | No | Configured concurrent sessions |
| Runner | `capacity_used` | integer | No | Reserved sessions |
| Runner | `capacity_available` | integer | No | Free slots |
| Runner | `price_info.price` | number | No | Price per unit in `currency`. Exact numeric token |
| Runner | `price_info.price_usd` | number | No | The registered USD price per the same unit. Hourly quotes are divided by 3600 |
| Runner | `price_info.currency` | string | No | "This orchestrator emits wei" |
| Runner | `price_info.unit` | string | No | "This orchestrator emits seconds or fixed" |

The Go struct that produces a runner record is `discoveryRunner` in `node/orchestrator/registry.go`.
The orchestrator emits no `runner_id` and no `app_id` (asserted in
`node/orchestrator/discovery_test.go`).

### The runner `url` encodes the mode

`appURL` and `discoveryURL` (`node/orchestrator/registry.go`, `node/orchestrator/proxy.go`):

| Mode | Advertised `url` | How it is used |
| --- | --- | --- |
| `single-shot` | `<service>/apps/<app_id>/app` | Call `<url>/<app path>` directly; a transient reservation per request |
| `single-shot` with `Proxy` | A generated proxy URL (`ServiceURL/run/{proxy}` or `ProxyURLTemplate`) | Same |
| `persistent` | `<service>/apps/<app_id>/session` | `POST` reserves a session and returns `session_id`, `app_url`, `control_url`; traffic then goes to `<service>/apps/<app_id>/session/<session_id>/app/...` |

### Real examples

From `node/docs/http-api.md`, "Discovery HTTP":

```json
[
  {"nodes": [
    {"url": "https://orch.example.com:8935", "queried_at": "2026-10-22T18:05:00Z"}
  ]},
  {"address": "https://orch.example.com:8935", "runners": [
    {"url": "https://orch.example.com:8935/apps/a1/app", "app": "example", "observed_at": "2026-10-22T18:05:00Z"}
  ]}
]
```

A full runner record, from the test fixture in `node/discovery/server_test.go` (reformatted; the
`extension` key shows that unknown properties are forwarded):

```json
{
  "url": "https://orch.example/apps/runner/session",
  "app": "test",
  "observed_at": "2000-01-01T00:00:00.123+00:00",
  "mode": "persistent",
  "capacity": 4,
  "capacity_used": 1,
  "capacity_available": 3,
  "gpu": {"id": "0", "name": "H100", "vram_mb": 80000},
  "price_info": {
    "price": 123456789012345678901234567890,
    "price_usd": 0.123456789012345678901234567890123456,
    "currency": "wei",
    "unit": "tokens"
  },
  "extension": {"value": 9007199254740993, "ratio": 1.2300e+04}
}
```

Collection rules (`node/docs/discovery.md`, `node/discovery/shared/inventory.go`): a response over
1 MiB drops the whole source; a runner with a missing or invalid `observed_at`, or one more than 30
seconds ahead, is skipped; duplicate runner URLs keep the newest record; refresh every
`RefreshInterval` (default 5 minutes), evicted after `MaxFailedRefreshes` (default 6).

---

## 3. The capability data model

### What discovery carries per app, and what it does not

| Concept the UI wants | Is it in `/discovery`? | Where it actually is |
| --- | --- | --- |
| Capability ID / name | `app` only, an open string | By convention a name from `capabilities.json` |
| Display name, description | **No** | A one-line `summary` per capability in `capabilities.json`; `info.description` in a registry entry |
| Kind / type / pipeline | **No field** | `group` in `capabilities.json` (`text`, `images`, `video`, `audio`, `media`, `live`) |
| Model ID | **No field** | Envelope `model.name`, `model.source`, `model.revision`, inside the `metadata` string |
| Interaction mode | `mode` | Also `mode` per capability and per registry entry |
| Streaming or not | **No** | Registry entry operation `x-livepeer.framing` |
| Input / output schema | **No** | Registry entry (OpenAPI request and response schemas) |
| Input / output media kinds | **No** | Registry entry `x-livepeer.inputs[]`, `outputs[]`, `x-media` |
| Price and unit | `price_info` | |
| Constraints / limits | **No field** | Envelope `limits`, `attributes`; registry `presets` |
| Capacity | `capacity`, `capacity_used`, `capacity_available` | |
| Orchestrator | Entry `address` (a URL) | No name, no wallet address, no stake, no region |
| Runner identity | **No `runner_id`** | Optionally envelope `runner_id`; the app ID is the path segment of `url` |
| Hardware | `gpu{id, name, vram_mb}` | Envelope `runtime`, `capacity_group` |
| Wire profile | **No field** | Envelope `endpoints.{name}.profile` |
| Versions | `version` (app build label, information only) | Envelope `runner_contract`, `deployment_revision`; the major in each profile ID |

### Enumerations, with code names quoted exactly

**Node (livepeer/node)**

| Value set | Values | Closed or open |
| --- | --- | --- |
| `mode` | `"persistent"`, `"single-shot"` | **Closed at registration** (`validateApp`: "mode must be persistent or single-shot"). **Open in the discovery schema**: aggregators forward other values; `node/discovery/schema_test.go` accepts `"mode":"future"` |
| `price_info.unit` at registration | `"hour"`, `"fixed"` | Closed (`"720p"` rejected explicitly) |
| `price_info.unit` in discovery | `"seconds"`, `"fixed"` | Closed for this orchestrator (`pm.ConvertRunnerPrice` in `node/pm/price.go`); open in the schema (the test uses `"tokens"`) |
| `price_info.currency` | `"usd"` in, `"wei"` out | Closed for this orchestrator; open in the schema (the test uses `"credits"`) |
| `status` | `"ready"` is the only advertised value | Open string; never appears in discovery |
| Signer payment `type` | `live`, `fixed` | Closed (`node/docs/http-api.md`) |
| `app`, `version`, `metadata`, `gpu.name` | | **Open strings** |

**Live runner standard**

| Value set | Values | Closed or open |
| --- | --- | --- |
| Capability names (`capabilities.json`) | `chat`, `embeddings`, `translation`, `decision`, `text-to-image`, `image-edit`, `image-to-3d`, `text-to-3d`, `text-to-video`, `image-to-video`, `audio-to-video`, `video-to-video`, `video-transcode`, `text-to-speech`, `transcription`, `music`, `sound-effects`, `media-tools`, `live-video-to-video`, `live-transcode`, `live-transcription` | A reviewed list, extended by pull request. **Not enforced by the node** |
| Capability `group` | `text`, `images`, `video`, `audio`, `media`, `live` | As above |
| Capability / registry `mode` | `single-shot`, `persistent` | Closed (schema enum). Every `live-*` is `persistent`; every other capability is `single-shot` |
| Registry entry `kind` | `profile`, `shared` | Closed |
| `framing` | `json`, `sse`, `ndjson`, `binary` | Closed |
| Input / output `kind`, `x-media.by` | `inline`, `body`, `url`, `storage-grant`, `trickle` | Closed |
| URL input `origin` | `public`, `deployment` | Closed |
| Storage `grant` | `s3-post-policy`, `presigned-put` | Closed |
| Session channel `direction` | `in`, `out` | Closed |
| `attempts` | `caller`, `gateway` | Closed |
| Error base kinds | `input_invalid`, `input_unsupported`, `busy`, `unavailable`, `deadline_exceeded`, `output_failed`, `upstream_failed`, `internal`, `input_unreadable` | Closed |
| Work-report `measure` | `input_tokens`, `output_tokens`, `images`, `audio_seconds`, `media_seconds`, `characters` | Closed |
| Envelope `admission` | `candidate` (default), `private` | Open string; any unknown value means `private` |
| Envelope `reasoning.default` | `on`, `off` | Open string; anything else is undeclared |
| Registry index `status` | `active`, `deprecated` | Closed |
| Wire profile IDs | `<namespace>.<name>.v<major>`, pattern `^[a-z][a-z0-9]*(\.[a-z0-9]+(-[a-z0-9]+)*)+\.v[1-9][0-9]*$` | Open set, 95 entries in release `2026.11.3` |
| Model `source` origins | `hf`, `ollama`, `fal`, `vendor` | Open ("settle the list" is a SPEC open question) |
| Envelope `limits` keys, `attributes` keys | e.g. `context_tokens`, `max_input_bytes`, `max_duration_s`; `presets`, `compute`, `estimated_startup_s` | Open |

**Engine (livepeer-builder-core)**

| Value set | Values | Source |
| --- | --- | --- |
| `Offering.rate_status` | `"available"`, `"missing"` | `contracts/discovery.py` |
| `ObservedRate.observed_by` | `"orchestrator"`, `"engine"` | `contracts/discovery.py` |
| `NetworkRate.source` | `"orchestrator"` (a constant) | `contracts/payments.py` |
| Payable units | `PAYMENT_TYPES_BY_UNIT = {"seconds": "live", "fixed": "fixed"}`, currency `"wei"` | `contracts/payments.py` |
| `JobRequest.mode` (`ExecutionMode`) | `"immediate"`, `"async"` (`async` answers 501) | `contracts/jobs.py` |
| `SessionState` | `"opening"`, `"open"`, `"closed"`, `"failed"` | `contracts/reserved.py` |
| `Offering.modes[]`, `Runner.mode` | Strings, forwarded unchanged | Open |

### Interaction modes: what exists and what does not

There are exactly two modes in discovery: **`single-shot`** and **`persistent`**. There is no
"streaming" mode. Streaming is a property of an endpoint's answer (`framing: ["json", "sse"]`), and
the orchestrator proxies HTTP, SSE and WebSocket for both modes. A chat runner that streams tokens
is `single-shot`. Real-time media is `persistent` plus Trickle channels.

---

## 4. How the engine reshapes discovery

The engine polls one `/discovery` URL (`LPB_DISCOVERY_URL`) every `discovery_interval_s` (default
15 seconds; the live engine's setting was not visible), reads each runner record into a `Runner`
(`src/livepeer_builder/adapters/discovery_inventory.py`), and builds offerings on every request
(`DiscoveryService.offerings` in `src/livepeer_builder/services/discovery.py`). It "never
interprets `metadata`" (`docs/contracts/discovery.md`).

### `GET /v1/offerings`

Grouping rule: **one offering per `(app, currency, unit)`**. An app whose runners quote two units
is two offerings. An app's runners with no usable price form one more offering with null rates.

Live call, no credential, 17 Nov 2026: HTTP 200, **27 items**, identical with and without the
reader token. Four representative items, verbatim:

```json
[
  {
    "app": "text-to-image",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "chat",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "10812508130",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000019444444444444444444444444444444",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "10812508130",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000019444444444444444444444444444444",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "live/sd-turbo",
    "modes": ["persistent"],
    "rate_low": {
      "amount": "54137635206",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000097222222222222222222222222222222",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "54137635206",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000097222222222222222222222222222222",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "live-transcode",
    "modes": ["persistent"],
    "rate_low": {
      "amount": "110055886320",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000197916666666666666666666666666667",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "110055886320",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000197916666666666666666666666666667",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  }
]
```

**Every distinct value across all 27 items**

| Field | Values seen |
| --- | --- |
| `app` (26 distinct) | `blueclaw/chat/qwen3.8-27b`, `chat`, `image-edit`, `image-to-3d`, `live-transcode`, `live/flux-klein`, `live/sd-turbo`, `live/video-to-video`, `livepeer-example/swarm-publish-demo`, `media/ffmpeg-compose`, `media/ffmpeg-extract-frame`, `media/ffmpeg-images-to-video`, `media/ffmpeg-live`, `media/ffmpeg-loudnorm`, `media/ffmpeg-merge-audio-video`, `media/ffmpeg-merge-videos`, `media/ffmpeg-metadata`, `media/ffmpeg-publish`, `media/ffmpeg-scale-video`, `media/ffmpeg-trim-video`, `music`, `text-to-image`, `text-to-speech`, `transcription` (twice: once per `fixed`, once per `seconds`), `translation`, `video-transcode` |
| `modes` | `["single-shot"]` (21 items), `["persistent"]` (6 items). No item mixes both |
| `currency` | `wei` only |
| `unit` | `fixed` (15 items), `seconds` (12 items) |
| `rate_status` | `available` only |
| `stale` | `false` only |
| `observed_by` | `orchestrator` (26), `engine` (1: `blueclaw/chat/qwen3.8-27b`, whose runner has no `observed_at`) |
| `price_usd` | A decimal string on 26 items; `null` on `blueclaw/chat/qwen3.8-27b` |
| `runner_count`, `ready_count` | `1` and `1` on every item |

Persistent apps: `live-transcode`, `live/flux-klein`, `live/sd-turbo`, `live/video-to-video`,
`livepeer-example/swarm-publish-demo`, `media/ffmpeg-live`.

**Field by field** (`Offering`, `ObservedRate` in `src/livepeer_builder/contracts/discovery.py`;
OpenAPI sets `additionalProperties: false` and requires all nine fields)

| Field | Type | Meaning |
| --- | --- | --- |
| `app` | string | The runner app name, exactly as advertised. This is the only identity an offering has, and it is what `POST /v1/jobs` takes |
| `modes` | string[] | The sorted distinct `mode` values of the group's runners |
| `rate_low`, `rate_high` | object or `null` | The cheapest and dearest rate in the group. Equal when one runner. `null` when no runner in the group has a usable price |
| `rate_*.amount` | decimal **string** | The advertised `price_info.price`: wei per `unit`. This is what is paid |
| `rate_*.currency` | string | Lowercased. `wei` on chain |
| `rate_*.unit` | string | Lowercased. `seconds` means per second of runner time; `fixed` means per request |
| `rate_*.price_usd` | decimal string or `null` | The operator's registered USD price per the same unit, echoed. Not an engine conversion. `seconds` values are USD per second (multiply by 3600 for the hourly quote) |
| `rate_*.source` | `"orchestrator"` | Constant |
| `rate_*.observed_at` | RFC 3339 | When that rate was last known |
| `rate_*.observed_by` | `"orchestrator"` or `"engine"` | Whose clock: the runner's `observed_at` stamp, or the engine's poll time when the stamp is missing or unusable |
| `rate_status` | `"available"` or `"missing"` | `missing`: no rate, or a currency and unit the signer takes no ceiling in (anything but wei per `seconds` or `fixed`), so the engine will not pay it |
| `stale` | boolean | The snapshot missed three polls, or the oldest rate is older than `LPB_RATE_MAX_AGE_S` (600 s) |
| `runner_count` | integer | Runners in this group |
| `ready_count` | integer | Runners with `capacity_available > 0` or unknown |
| `observed_at` | RFC 3339 | The engine's last successful discovery poll |

**The `app` query parameter.** It is an exact, case-sensitive match on the app name.

| Request | Result |
| --- | --- |
| `/v1/offerings` | 200, all 27 |
| `/v1/offerings?app=transcription` | 200, 2 items (the `fixed` and `seconds` offerings) |
| `/v1/offerings?app=live/sd-turbo` | 200, 1 item |
| `/v1/offerings?app=live` | 200, `[]` (no prefix match) |
| `/v1/offerings?app=nonexistent` | 200, `[]` |

No other query parameter exists (live OpenAPI). There is no filter by mode, unit, group or model.

### `GET /v1/runners?app=`

| Request | Result |
| --- | --- |
| No credential | 401 `{"error":"a credential is required"}` |
| Reader token, no `app` | 422 (`app` is required) |
| Reader token, `app=chat` | 200, an array of runners for exactly that app |

There is no "all runners" call. Calling it once per distinct app returned **27 runners on 3
orchestrator hosts** (20, 6 and 1 runners). Each host is a three-label DNS name with a port, and
every runner's `orchestrator_url` was set.

Two representative items from the live engine. Hosts are redacted to `orch-b` and `orch-c` with the
shape kept; digests and GPU IDs are shortened with `…`:

```json
[
  {
    "url": "https://orch-c.<redacted>.example:<port>/apps/eliteprd1-ada-flux-image/app",
    "app": "text-to-image",
    "runner_id": null,
    "mode": "single-shot",
    "orchestrator_url": "https://orch-c.<redacted>.example:<port>",
    "capacity": 1,
    "capacity_available": 1,
    "rate": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator"
    },
    "rate_error": null,
    "observed_at": "2026-11-17T21:13:10.560858Z",
    "version": "inference.runner.v2",
    "metadata": "{\"runner_contract\":1,\"deployment_revision\":\"sha256:5f13533b…\",\"model\":{\"name\":\"black-forest-labs/FLUX.2-klein-4B\",\"source\":\"hf:black-forest-labs/FLUX.2-klein-4B\",\"revision\":\"e7b7dc27…\"},\"endpoints\":{\"images\":{\"profile\":\"openai.images.v1\"}},\"runtime\":{\"image\":\"sha256:fc6cfca2…\"},\"capacity_group\":{\"id\":\"eliteprd1-ada4000\",\"slots\":1}}",
    "gpu": {"id": "GPU-e2a79b…", "name": "NVIDIA RTX 4000 Ada Generation", "vram_mb": 20475}
  },
  {
    "url": "https://orch-b.<redacted>.example:<port>/apps/zio-live-transcode/session",
    "app": "live-transcode",
    "runner_id": null,
    "mode": "persistent",
    "orchestrator_url": "https://orch-b.<redacted>.example:<port>",
    "capacity": 1,
    "capacity_available": 1,
    "rate": {
      "amount": "110055886320",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000197916666666666666666666666666667",
      "source": "orchestrator"
    },
    "rate_error": null,
    "observed_at": "2026-11-17T21:13:10.577279Z",
    "version": "75ca99d77f22",
    "metadata": "{\"runner_contract\":1,\"deployment_revision\":\"sha256:9723c468…\",\"endpoints\":{\"session\":{\"profile\":\"zio.live-transcode.v1\",\"stop\":\"/v1/live/stop\",\"channels\":{\"in\":[\"source\"],\"out\":[\"renditions-*\",\"events\"]},\"drain_timeout_s\":10}},\"runtime\":{\"name\":\"ffmpeg\",\"encoder\":\"h264_nvenc\",\"image\":\"sha256:3c56a296…\",\"versions\":{\"ffmpeg\":\"8.1.3\"}},\"admission\":\"private\",\"attributes\":{\"presets\":[\"h264-hls-1080-live\"]}}",
    "gpu": null
  }
]
```

**Field by field, and the version drift**

| Field | Live engine (`1514212`) | Clone HEAD (`d67836b`) | Meaning |
| --- | --- | --- | --- |
| `url` | Yes | Yes | The runner's app endpoint on the orchestrator. Ends `/app` (single-shot) or `/session` (persistent) |
| `app` | Yes | Yes | App name |
| `mode` | Yes | Yes | As advertised |
| `orchestrator_url` | Yes | Yes | The entry `address`, kept only when its origin equals the runner URL's origin |
| `capacity`, `capacity_available` | Yes | Yes | As advertised |
| `capacity_used` | **No** | Yes | |
| `rate` | Yes (`NetworkRate`: `amount`, `currency`, `unit`, `price_usd`, `source`) | **No** | The parsed price |
| `rate_error` | Yes | **No** | Why an advertised price is not a rate |
| `price_info` | **No** | Yes (`price`, `price_usd`, `currency`, `unit`, as advertised) | Replaces `rate` and `rate_error` |
| `runner_id` | Yes, always `null` live | **No** | Node's discovery has no such field |
| `observed_at` | Yes | Yes | The orchestrator's stamp |
| `version` | Yes | Yes | The runner's `Version` label |
| `metadata` | Yes | Yes | The registered `Metadata` **string**, uninterpreted. Parse it as JSON yourself |
| `gpu` | Yes | Yes | `{id, name, vram_mb}` or `null` |

A UI that reads `/v1/runners` must tolerate both shapes, or the engine must be pinned.

**What the envelopes on the live network contain** (all 27 runners):

| Observation | Count |
| --- | --- |
| `metadata` parses as a `runner_contract: 1` envelope | 26 |
| `metadata` is another JSON shape (`{"blueclaw":1,"capability":"openai:chat-completions","unit":"tokens","model_id":…,"category":"chat","max_context":…}`) | 1 (`blueclaw/chat/qwen3.8-27b`) |
| Envelope size | 155 to 931 bytes |
| Envelopes with `model` | 11 |
| Top-level keys used | `runner_contract`, `deployment_revision`, `endpoints`, `runtime`, `model`, `capacity_group`, `attributes`, `runner_id`, `limits`, `admission` |
| `attributes` keys | `compute` (`cold` / `warm`), `estimated_startup_s`, `presets` |
| `limits` keys | `context_tokens`, `max_duration_s`, `max_input_bytes` |
| Channels declared | in: `video`, `source`, `in`, `stamps`, `control`; out: `video`, `renditions-*`, `events` |

Wire profile IDs seen, against registry release `2026.11.3`:

| Profile ID | In the registry? |
| --- | --- |
| `openai.chat.v1`, `anthropic.messages.v1`, `openai.responses.stateless.v1` | Yes, all three **deprecated** |
| `openai.images.v1`, `openai.speech.v1`, `openai.transcriptions.v1`, `openai.translations.v1` | Yes |
| `zio.live-transcode.v1`, `zio.vod-transcode.v1` | Yes |
| `comfystream.live.v1`, `comfystream.ffmpeg.v1`, `comfystream.workflow.v1`, `comfystream.image-transformations.v1`, `comfystream.meshes.v1`, `comfystream.music.v1`, `comfystream.swarm-publish.v1` | **No.** There is no `registry/comfystream/` directory; the README lists `comfystream.*` entries as "still to come" |

App names against `capabilities.json`: **10 on the list** (`chat`, `image-edit`, `image-to-3d`,
`live-transcode`, `music`, `text-to-image`, `text-to-speech`, `transcription`, `translation`,
`video-transcode`), **16 off it** (`blueclaw/chat/qwen3.8-27b`, the three `live/*`, the eleven
`media/ffmpeg-*`, `livepeer-example/swarm-publish-demo`).

---

## 5. What input description discovery provides for a generic "run" form

**Directly: nothing.** A discovery record has no JSON Schema, no parameter list, no description and
no example. `metadata` is an opaque string of at most 1,024 bytes, and the standard forbids prose in
it ("Never in the envelope: prices, URLs, secrets, prose…"). The engine's `/v1/offerings` carries
even less: no `metadata` at all.

**Indirectly, for runners that follow runner contract v1:** a three-step lookup.

1. Read the runner's `metadata` (only through `/v1/runners?app=`, which needs a credential) and parse
   the envelope.
2. Take `endpoints.{name}.profile`, a wire profile ID such as `openai.images.v1`.
3. Load `registry/<namespace>/<name>.v<major>.json` from a pinned release of `live-runner-standard`.
   That file is an **OpenAPI 3.1.0 document**. The operation whose `operationId` equals the endpoint
   `{name}` gives:

| From the entry | Use for a form |
| --- | --- |
| `paths.<path>.<method>` | The default `path` and `method` for the engine's `JobRequest` (the envelope may override `path` and `method`) |
| `requestBody.content.<type>.schema` | **JSON Schema (2020-12 dialect) of the request**: types, enums, defaults, min/max, `required`, per-field `description` |
| `requestBody` content type | `application/json` or `multipart/form-data` (file upload, e.g. `openai.transcriptions.v1`) |
| `requestBody…examples` | A valid example request |
| `x-livepeer.inputs[]` | Which fields carry media and how: `kind` (`inline`, `body`, `url`, `storage-grant`, `trickle`), `field` (a JSON pointer), `media_types`, `max_bytes`, `origin` |
| `x-livepeer.outputs[]` | Where results are and how to show them: `field`, `kind`, `media_types`, `expires` |
| `x-media` on schema fields | A per-field media hint `{by, accept, type}` "for forms and players" |
| `x-livepeer.framing` | Whether to render a single result (`json`, `binary`) or a stream (`sse`, `ndjson`) |
| `x-livepeer.presets` (entry root) | Named presets; the runner's `attributes.presets` lists the ones it offers |
| `x-livepeer.cost_hint` | Optional typical duration or speed, for a cost estimate |

Example: `registry/fal/lightricks-ltx-2-5-text-to-video-fast.v1.json` has a request schema with
`prompt` (string, 1 to 5000, required), `duration` (enum 6…20 or `"auto"`), `resolution` (enum
`720p`…`2160p`, default `1080p`), `aspect_ratio` (`16:9`, `9:16`), `fps` (enum), `generate_audio`
(boolean), `camera_motion` (enum or null), plus the vendor's `x-fal-order-properties` field order.

**Limits of this path, measured**

- `x-media` appears in only 16 of 95 entries (the `openai`, `anthropic`, `zio`, `typesafe`
  namespaces). The 74 `fal.*` entries mark media through `x-livepeer.inputs[].field` pointers
  instead (for example `/image_url`, kind `url`, `media_types: ["image/*"]`).
- The registry is not served by any network or engine endpoint. A client bundles or fetches a pinned
  git tag and should check each entry's `sha256` against `registry/index.json`.
- 7 of the 16 profile IDs in use on the live network have no entry, so there is no schema for them.
  That includes every live video-to-video runner (`comfystream.live.v1`, `comfystream.workflow.v1`).
- One runner publishes a pre-v1 metadata shape.
- A form built this way is per **wire profile**, not per capability. Two `text-to-image` runners can
  speak different profiles with different fields.

The standard is explicit about the intent (SPEC, gateway rule 10): "Build its surfaces from the
registry: HTTP routes, MCP tools, SDK methods and console forms come from entries, not from code
per runner." It also forbids two shortcuts: showing metadata strings to people as text, and fetching
anything a runner's metadata points to.

---

## 6. What the live runner standard defines

### The envelope (`schemas/envelope.v1.schema.json`, SPEC "The envelope")

| Key | Required | Holds |
| --- | --- | --- |
| `runner_contract` | Yes | `1` |
| `deployment_revision` | Yes | `sha256:` plus 64 hex digits, computed by a fixed recipe over images, model, profiles and settings. Approvals key on it |
| `endpoints.{name}.profile` | Yes, one or more | A wire profile ID. `{name}` is the `operationId` in that profile's entry |
| `endpoints.{name}.path`, `.method` | No | Only where they differ from the entry's defaults |
| `endpoints.{name}.stop`, `.channels{in[], out[]}`, `.idle_timeout_s`, `.drain_timeout_s` | Persistent runners | Session keys |
| `model{name, source, revision}` | When a model is served | `name` is what requests send; `source` is `<origin>:<id>` |
| `runner_id` | No | The node's runner ID, since discovery does not report it |
| `runtime{name, image, versions, encoder}` | No | |
| `limits` | No | Numeric limits the runner enforces |
| `admission` | No | `candidate` or `private` |
| `capacity_group{id, slots}` | No | Registrations that share one GPU |
| `reasoning{default}` | No | `on` or `off` |
| `attributes` | No | App-specific selection values, passed through uninterpreted |

The `Metadata` string is at most 1,024 bytes as registered. The SPEC's two-endpoint chat example:

```json
{"runner_contract":1,"deployment_revision":"sha256:…",
 "model":{"name":"qwen3.8-27b","source":"hf:Qwen/Qwen3.8-27B-AWQ","revision":"…"},
 "endpoints":{"chat_completions":{"profile":"openai.chat.v2"},"messages":{"profile":"anthropic.messages.v2"}},
 "limits":{"context_tokens":131072}}
```

### `capabilities.json`

`{"capability_list": 1, "capabilities": [{name, group, mode, summary}, …]}`, 21 entries:

| Group | Capabilities | Mode |
| --- | --- | --- |
| `text` | `chat`, `embeddings`, `translation`, `decision` | `single-shot` |
| `images` | `text-to-image`, `image-edit`, `image-to-3d`, `text-to-3d` | `single-shot` |
| `video` | `text-to-video`, `image-to-video`, `audio-to-video`, `video-to-video`, `video-transcode` | `single-shot` |
| `audio` | `text-to-speech`, `transcription`, `music`, `sound-effects` | `single-shot` |
| `media` | `media-tools` | `single-shot` |
| `live` | `live-video-to-video`, `live-transcode`, `live-transcription` | `persistent` |

Rules: an App ID is the capability and nothing else (no operator, model or version in it), and "a
live form is its own capability". The SPEC's migration table maps `live/flux-klein` to
`live-video-to-video` with model `flux-klein`, and `blueclaw/chat/qwen3.8-27b` to `chat`.

There is **no** capability for video understanding or captioning, avatars or characters, stream
delivery, or lip sync (the `fal` lip-sync and avatar profiles are filed under `image-to-video`).

### The wire-profile registry (`registry/`, `schemas/registry-entry.v1.schema.json`)

One immutable OpenAPI 3.1.0 file per profile, plus a generated `registry/index.json`
(`{registry_index: 1, entries: {<id>: {path, sha256, steward, status, aliases}}}`). Release
`2026.11.3` holds 95 entries: 91 profiles and 4 shared shapes (`livepeer.errors.v1`,
`livepeer.health.v1`, `livepeer.io.v1`, `livepeer.conformance-report.v1`).

| Namespace | Entries | Notes |
| --- | --- | --- |
| `openai` | `chat.v1`, `chat.v2`, `responses.stateless.v1`, `responses.stateless.v2`, `embeddings.v1`, `images.v1`, `speech.v1`, `transcriptions.v1`, `translations.v1` | `chat.v1` and `responses.stateless.v1` deprecated |
| `anthropic` | `messages.v1`, `messages.v2` | `v1` deprecated |
| `typesafe` | `systemone.v1` | Capability `decision` |
| `zio` | `live-transcode.v1`, `live-transcribe.v1`, `transcribe.v1`, `translate.v1`, `vod-transcode.v1` | All `admission: private` |
| `fal` | `queue.v1` plus 73 endpoint entries generated from fal's OpenAPI | All `single-shot`, one `run` operation at `POST /`, framing `json`, `extends: fal.queue.v1` |
| `livepeer` | 4 shared shapes | |

Profiles per capability in the release: `image-to-video` 21, `text-to-video` 11, `media-tools` 11,
`video-to-video` 10, `image-edit` 9, `text-to-image` 9, `chat` 6, `transcription` 5, `translation` 4,
`text-to-speech` 3, `music` 3, `sound-effects` 3, `audio-to-video` 2, `image-to-3d` 2, `text-to-3d` 2,
`embeddings` 1, `decision` 1, `video-transcode` 1, `live-transcode` 1, `live-transcription` 1.
**No profile serves `live-video-to-video`.** Only 2 of 91 profiles are `persistent`.

The root `x-livepeer` object: `registry_entry: 1`, `profile`, `kind`, `extends`, `mode`,
`capabilities[]`, `admission{default, reason}`, `attempts`, `readiness`, `presets`, `cost_hint`. Each
operation's `x-livepeer`: `framing`, `success`, `errors[]`, `work_reports[]`, `inputs[]`,
`outputs[]`, `attempts`, `cost_hint`, `session`, `recovery`.

### Single-shot versus live, as described by the standard

| | Single-shot | Persistent (live) |
| --- | --- | --- |
| Capability | Any non-`live-*` name | A `live-*` name |
| Registration `Mode` | `single-shot` | `persistent` |
| Discovery `url` | `…/apps/<id>/app` | `…/apps/<id>/session` |
| Envelope endpoint | `{"profile": …}` | Adds `stop`, `channels{in, out}`, `idle_timeout_s`, `drain_timeout_s` |
| Registry operation | `framing` of `json`, `sse`, `ndjson` or `binary`; `inputs` and `outputs` of kind `inline`, `body`, `url`, `storage-grant` | A `session` object: `channels{<name>: {direction, media_type, max_segment_bytes, timing}}`, `events{channel, schema, counter}`, `controls[]`, `stop`, timeouts. Inputs and outputs of kind `trickle` |
| Streaming | SSE or NDJSON in the HTTP answer; headers within 1 s, a keepalive every 15 s | Trickle channels of segments, at most 10,000,000 bytes each |
| Capacity | Concurrent requests | Concurrent sessions |
| Price unit in practice | `fixed` or `seconds` | `seconds` |

The one fully specified live example is `registry/zio/live-transcode.v1.json`: `POST
/v1/live/start` (operation `session`, success status 201) takes `{schema_version, broadcast_id,
epoch, profile}` and returns Trickle channel URLs. Input channel `source` is `video/mp2t`; outputs
are `renditions-1080p`, `-720p`, `-480p`, `-360p` (`video/mp2t`, 2 s segments, keyframe-aligned) and
`events` (`application/json`, with an `epoch` counter). `POST /v1/live/stop` (operation `stop`)
ends it. Preset `h264-hls-1080-live`.

"A gateway that can't carry the channels skips the profile; one that speaks HTTP but not Trickle
doesn't list a Trickle profile" (SPEC, "Sessions and live media").

### What `node/trickle` and `node/destination` are

**`node/trickle`** is the transport for live media and events inside a session. From
`node/trickle/README.md`: "a segmented publish-subscribe protocol that streams data in realtime,
mainly over HTTP". Channels are content-agnostic (video, audio, JSON).

| Operation | Shape |
| --- | --- |
| Publish a segment | `POST /<channel-name>/<seq>` |
| Subscribe | `GET /<channel-name>/<seq>`; `seq = -1` gets the most recent |
| Next sequence number | `GET /<channel-name>/next` (also header `Lp-Trickle-Latest`) |
| Headers | `Lp-Trickle-Seq`, `Lp-Trickle-Latest`, `Lp-Trickle-Closed: terminated`, `Lp-Trickle-Reset`, `Lp-Trickle-Size` |
| Retention | The last five segments per channel, 10 MB each by default |

On an orchestrator the server is mounted at `/ai/trickle/{channel...}`. Channels are created **by
the runner**, not the client: `POST /runner/{app_id}/session/{session_id}/channels` with
`{"channels":[{"name", "mime_type"}]}` (at most 25 per request, authorized by the session callback
token) returns `{"channels":[{"name", "channel_name", "url", "internal_url", "mime_type"}]}`
(`node/orchestrator/http.go`). The runner hands the public `url`s to the client in its own start
response. There is also an orchestrator-to-runner control channel (`o2r` in the heartbeat response)
carrying session events and a `{"keep":"alive"}` message (`node/orchestrator/trickle.go`).

**`node/destination` is not stream delivery.** It is the outbound-connection policy: it blocks
loopback, private and link-local addresses at dial time unless a grant allows them
(`node/destination/policy.go`). It backs `RunnerGrants`, `SessionProxyGrants`, `HealthGrants`,
`DiscoveryGrants` and `Grants`.

**Transcoding and delivery.** The node repository contains no transcoder and no RTMP, WHIP, WebRTC
or HLS code. ("Transcoder" appears only as a legacy protobuf field name holding the orchestrator
URL, in `node/pm/wire/wire.go`.) Transcoding is a runner capability: `video-transcode` (single-shot,
`zio.vod-transcode.v1`) and `live-transcode` (persistent, `zio.live-transcode.v1`). Delivery to
viewers is not a network capability in any of these repos: a live transcoder writes MPEG-TS segments
to Trickle channels, and turning those into a playable HLS stream or CDN origin is left to the
gateway.

---

## 7. PROPOSAL: mapping capability to UI surface

> This section is a proposal, not something the repos define. Nothing on the network names a UI
> surface.

### Fields that can drive a mapping, and how far each can be trusted

| Field | Available from | Reliability |
| --- | --- | --- |
| `app` → `capabilities.json` `group` and `mode` | `/v1/offerings` plus a bundled `capabilities.json` | Good for the 10 conforming apps; fails for 16 of 26 live app names |
| `modes` | `/v1/offerings` | Reliable. Cleanly separates request/response from session work |
| `rate_low.unit` | `/v1/offerings` | Reliable, but about billing, not interaction |
| Envelope `endpoints.*.profile` → registry `x-livepeer.capabilities`, `framing`, `inputs`, `outputs`, `session.channels` | `/v1/runners` (credential) plus a bundled registry | The most precise signal where the profile is registered; missing for all `comfystream.*` runners |
| Envelope `endpoints.*.channels` | `/v1/runners` | Present on live runners even where the profile has no entry. Channel **names** only; no media type |
| Envelope `model`, `limits`, `attributes` | `/v1/runners` | Good for labels and selection, not for classification |

### Proposed interaction classes (derived, then mapped to surfaces)

| Class | Rule | Capabilities today |
| --- | --- | --- |
| Conversation | `mode = single-shot` and a profile whose `framing` includes `sse`, capability `chat` | `chat` |
| Generation | `mode = single-shot`, group `images`, `video` or `audio`, output kind `url`, `inline` or `body` with a media type | `text-to-image`, `image-edit`, `text-to-video`, `image-to-video`, `audio-to-video`, `video-to-video`, `text-to-speech`, `music`, `sound-effects`, `image-to-3d`, `text-to-3d` |
| Understanding | `mode = single-shot`, media in, text or data out | `transcription`, `translation`, `embeddings`, `decision`; image input through `chat` (`openai.chat.v2` accepts inline images) |
| Media processing | `mode = single-shot`, media in, media out, no model | `media-tools`, `video-transcode` |
| Real-time session | `mode = persistent`, Trickle channels in and out | `live-video-to-video`, `live-transcription` |
| Stream pipeline | `mode = persistent`, video in, renditions or events out | `live-transcode` |

| Surface | Classes it would list | Form source |
| --- | --- | --- |
| Chat | Conversation, and Understanding where the profile takes media in a message | Fixed chat UI; parameters from the profile's request schema |
| Studio | Generation | Generic form from the registry request schema, `x-livepeer.inputs`, `x-media` |
| Characters | Real-time session (camera in, video out) | Session UI; controls from `session.controls` and presets from `attributes.presets` |
| Library | Understanding, Media processing and Stream pipeline, applied to stored assets and streams | Per-profile forms; presets |

### What is missing to do this reliably

1. **A machine-readable class on the offering.** `/v1/offerings` has `app` and `modes` only. The
   group, model and profiles all sit behind `/v1/runners`, a credential and a second repository.
2. **App names that are capabilities.** 16 of 26 live names are operator- or model-shaped
   (`live/sd-turbo`, `media/ffmpeg-trim-video`), so `app` → group lookup needs a fallback table that
   livepeer would have to invent, which the brief rules out.
3. **Registry entries for the profiles actually in use**, above all `comfystream.live.v1`.
4. **Capabilities the product needs that the list lacks:** video understanding or captioning,
   avatar or character sessions, stream delivery.
5. **Display metadata.** No human name, description, icon, thumbnail or example output exists
   anywhere except the one-line capability `summary` and each entry's `info.description`.
6. **A model-level catalog.** The SPEC describes "a catalog that combines discovery from every
   orchestrator and groups it by capability, then model", but no endpoint returns one. The engine
   groups by app and price unit only.
7. **A way to run persistent offerings.** See section 9.

---

## 8. Mock offerings

Fourteen objects in the exact shape of a live `/v1/offerings` item (the same nine keys, the same
nested rate keys, decimal strings for amounts). Wei amounts use the conversion implied by the live
data (about 5.568e14 wei per USD). `seconds` prices are per second of runner time. The set
deliberately includes a price range, a runner at capacity, a stale rate, an engine-stamped rate and
a missing rate.

The naming provenance cannot live inside the objects (`additionalProperties: false`), so it is in
the table after the block.

```json
[
  {
    "app": "text-to-video",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "222737699129600",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.4",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "334106548694400",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.6",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:41.004217Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 3,
    "ready_count": 2,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "image-to-video",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "194895486738400",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.35",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "278422123912000",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.5",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:41.004217Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 2,
    "ready_count": 0,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "text-to-image",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "22273769912960",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.04",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:41.004217Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 4,
    "ready_count": 4,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "image-edit",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "live-video-to-video",
    "modes": ["persistent"],
    "rate_low": {
      "amount": "54137635206",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000097222222222222222222222222222222",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "54137635206",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000097222222222222222222222222222222",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 2,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "live-avatar",
    "modes": ["persistent"],
    "rate_low": {
      "amount": "185614749275",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000333333333333333333333333333333333",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:01:12.330118Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "185614749275",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000333333333333333333333333333333333",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:01:12.330118Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": true,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "text-to-speech",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "15446440186",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000027777777777777777777777777777778",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "15446440186",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000027777777777777777777777777777778",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "music",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "chat",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "10812508130",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000019444444444444444444444444444444",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "15467895773",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": null,
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:13:07.907543Z",
      "observed_by": "engine"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 2,
    "ready_count": 2,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "video-understanding",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "38669739433",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000069444444444444444444444444444444",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "38669739433",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000069444444444444444444444444444444",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "transcription",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "11136884956480",
      "currency": "wei",
      "unit": "fixed",
      "price_usd": "0.02",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.208908Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "video-transcode",
    "modes": ["single-shot"],
    "rate_low": {
      "amount": "110055886320",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000197916666666666666666666666666667",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "110055886320",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000197916666666666666666666666666667",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "live-transcode",
    "modes": ["persistent"],
    "rate_low": {
      "amount": "110055886320",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000197916666666666666666666666666667",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_high": {
      "amount": "110055886320",
      "currency": "wei",
      "unit": "seconds",
      "price_usd": "0.000197916666666666666666666666666667",
      "source": "orchestrator",
      "observed_at": "2026-11-17T21:12:40.213591Z",
      "observed_by": "orchestrator"
    },
    "rate_status": "available",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  },
  {
    "app": "live-delivery",
    "modes": ["persistent"],
    "rate_low": null,
    "rate_high": null,
    "rate_status": "missing",
    "stale": false,
    "runner_count": 1,
    "ready_count": 1,
    "observed_at": "2026-11-17T21:13:07.907543Z"
  }
]
```

| # | `app` | Covers | Naming | Basis |
| --- | --- | --- | --- | --- |
| 1 | `text-to-video` | Text to video | **Naming from repo** | `capabilities.json`; 11 registry profiles. Not on the live network today |
| 2 | `image-to-video` | Image to video (runner at capacity) | **Naming from repo** | `capabilities.json`; 21 registry profiles. Not live today |
| 3 | `text-to-image` | Text to image | **Naming from repo** | `capabilities.json`; live |
| 4 | `image-edit` | Image editing | **Naming from repo** | `capabilities.json`; live |
| 5 | `live-video-to-video` | Real-time video restyle, persistent session | **Naming from repo** | `capabilities.json`. Live runners still use the pre-v1 names `live/sd-turbo`, `live/flux-klein`, `live/video-to-video` |
| 6 | `live-avatar` | Live avatar or character session (stale rate) | **Naming assumed** | No such capability. Follows the `live-*` rule (persistent). Single-request avatar and lip-sync profiles are filed under `image-to-video` |
| 7 | `text-to-speech` | Speech | **Naming from repo** | `capabilities.json`; live |
| 8 | `music` | Music and audio | **Naming from repo** | `capabilities.json`; live. `sound-effects` is the sibling capability |
| 9 | `chat` | LLM chat, streamed (range with an engine-stamped rate) | **Naming from repo** | `capabilities.json`; live. Streaming is the profile's `sse` framing; the mode stays `single-shot` |
| 10 | `video-understanding` | Video understanding or captioning (VLM) | **Naming assumed** | No such capability. Image understanding rides `chat` today |
| 11 | `transcription` | Transcription | **Naming from repo** | `capabilities.json`; live, in both `fixed` and `seconds` |
| 12 | `video-transcode` | File transcoding | **Naming from repo** | `capabilities.json`; live |
| 13 | `live-transcode` | Live transcoding | **Naming from repo** | `capabilities.json`; live |
| 14 | `live-delivery` | Stream delivery (missing rate) | **Naming assumed** | No such capability. The nearest live names are the pre-v1 `media/ffmpeg-publish` (single-shot) and `livepeer-example/swarm-publish-demo` (persistent) |

For the envelope side of a mock (what `/v1/runners` would return in `metadata`), reuse the real
envelopes in section 4 and the profile IDs in section 6.

---

## 9. Open questions and gaps for the engine maintainer

**Catalog shape**

1. Will `/v1/offerings` expose the envelope's facts (capability group, model, wire profiles,
   framing), or a parsed form of them? Today a public client cannot tell a chat model from an
   image model except by the app name.
2. Should offerings group by capability then model, as the SPEC's "catalog" describes? Today the
   key is `(app, currency, unit)`, so `transcription` appears twice and two different models under
   one app are one row.
3. Is there to be a list-all form of `/v1/runners`? It requires `app`, so reading every envelope
   costs one authenticated call per app.
4. `/v1/runners` changed shape between the running build (`rate`, `rate_error`, `runner_id`) and
   HEAD (`price_info`, `capacity_used`). Which will livepeer's engine run, and is the route stable?
5. No filter exists for mode, unit, group or model. Is client-side filtering the intended design?

**Capability identity**

6. `JobRequest.capability` and `model` are "label only"; "Capability → app resolution … is a later
   contract" (`docs/contracts/engine.md`). When does the engine select by capability, model and
   profile instead of by `app`?
7. When do live runners move to v1 names (`live/sd-turbo` → `live-video-to-video`)? Until then
   `app` cannot be joined to `capabilities.json` for 16 of 26 apps.
8. Who proposes capabilities for video understanding, avatar sessions and stream delivery, and is
   the list the right place for them?
9. Does the engine intend to enforce or flag non-v1 metadata (one live runner publishes a pre-v1
   shape), as gateway rules 1 and 2 require?

**Input schemas**

10. Will the engine serve registry entries (or a derived form schema) for the profiles it lists, and
    pin a registry release? Otherwise every UI bundles the registry itself.
11. `comfystream.*` profiles have no registry entry. Is there a draft, and where does a UI get the
    request shape for `comfystream.live.v1` in the meantime?
12. Three of the profiles in use (`openai.chat.v1`, `anthropic.messages.v1`,
    `openai.responses.stateless.v1`) are deprecated. Should a UI hide them, or follow them to `v2`?

**Running things**

13. Persistent sessions: `POST /v1/sessions` is documented as answering 501 (M4, ISS-27), and async
    jobs likewise (ISS-26). When can a UI open a `persistent` offering through the engine? Six of
    the 27 live offerings are persistent.
14. The planned session design proxies HTTP, SSE and WebSocket, and defers handing out Trickle
    channel URLs (`docs/design-docs/2026-10-29-media-work-plan.md`). How does browser video reach a
    `live-video-to-video` runner: through the engine, or directly to the orchestrator's
    `/ai/trickle/…` URLs?
15. The ISS-27 guide records that the job path ignores `mode`, and a persistent runner's discovery
    URL is the reserve route. Should the UI refuse to send `POST /v1/jobs` to a `persistent`
    offering?
16. Results are returned inline once and not stored (`engine.md`, "Results"), and requests are
    capped (8 MiB `raw_body`, 16 MiB request). What is the intended path for video-sized inputs and
    outputs: `url` inputs the runner fetches, and `url` outputs with an expiry?
17. Is there a delivery or playback story for `live-transcode` output (MPEG-TS on Trickle), or is
    HLS packaging livepeer's to build?

**Pricing and display**

18. `seconds` pricing bills runner wall-clock time, also for `chat` and `text-to-speech`. Is there a
    planned estimate (the registry's `cost_hint` is optional and mostly absent) so a UI can show an
    expected cost before a run?
19. Should the UI show `price_usd` (the operator's quote, `null` for older nodes) or convert
    `amount` itself? The engine deliberately does no conversion.
20. No orchestrator identity beyond a URL is exposed (no name, address, stake or region). Is that
    intended to stay out of the catalog?

### Not verified

- **Anything that needs a write.** No POST, PUT, PATCH or DELETE was sent, so the 501 on
  `/v1/sessions` and on async jobs is from the docs and source, not observed.
- **Which discovery source the live engine polls** (a single orchestrator, `livepeer-discovery` or
  `livepeer-onchain-discovery`). `/readyz` reports only freshness.
- **The behavior of the `comfystream.*` endpoints.** There is no registry entry; only the envelope's
  endpoint and channel names were seen.
- **The raw upstream `/discovery` document.** Only the engine's reading of it was available, so
  `capacity_used` and any extra properties orchestrators send were not seen.
- **The admin token.** Not needed; the reader token returned everything used here.
