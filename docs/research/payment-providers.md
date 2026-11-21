# Payment and identity providers: Clearinghouse Batteries, PymtHouse, and the engine's provider protocols

Research note for the livepeer front end. Written 17 November 2026.

**What was read**

| Source | Version read | How |
| --- | --- | --- |
| Clearinghouse Batteries | `livepeer/clearinghouse-batteries` `fb76150` (VERSION `0.0.3`) | `.reference/clearinghouse-batteries`: README, API.md, SECURITY.md, config/creds examples, `migrations/*.sql`, `internal/` |
| Engine | `NE-Build-Track/livepeer-builder-core` `d67836b` | `.reference/livepeer-builder-core`: `protocols/`, `adapters/batteries.py`, `services/`, `http/app.py`, `docs/contracts/payments.md` |
| Live engine | `0.0.1.dev1+g15142129e` at `http://127.0.0.1:8090` (commit `1514212`, 15 commits behind the clone, same route list) | GET requests only |
| PymtHouse | Public site and docs as of 17 November 2026 | `pymthouse.com`, `docs.pymthouse.com`, the live OpenAPI and OIDC discovery documents, `github.com/pymthouse/pymthouse` |
| Console and node | `builder-core-console` `274a361`, `livepeer/node` `eee09c4` | grep and targeted reads |

Paths in backticks are relative to the named repository. There is no `docs/payments.md` in the engine; the payments contract is `docs/contracts/payments.md`.

**Three things to know before reading further**

1. **PymtHouse is not wired into the engine in any code I could read.** The engine, console and node clones contain no PymtHouse adapter, setting or test. The only mentions are statements that the engine must not depend on it (`docs/product-specs/build-track-baseline.md`, `docs/references/upstream-baseline.md`). Everything about how it will connect is inference.
2. **The engine has no plan concept and no retail concept, by design.** `docs/contracts/payments.md` ("Wholesale and retail") says the engine never computes, stores or applies a retail price, margin or invoice. There is no plans protocol to implement. Plans exist only in PymtHouse.
3. **`ENGINE_ADMIN_TOKEN` in `.env` is not an admin credential on this engine.** It authenticates as the actor `acme-studio` (an `lpk_` actor key): it reads that actor's own allowance and costs and gets `403 admin.read requires an admin credential` on every admin route. So `GET /v1/admin/grants` could not be sampled live. An admin key does exist on the engine (kind `admin`, actor `operator`, label `console`); it is just not the one in `.env`.

---

## 1. Clearinghouse Batteries

### What it is

A single Go binary (`clearinghouse`, module `github.com/livepeer/clearinghouse`) with a SQLite database. Its README title is "Livepeer grants clearinghouse": it "manages grants, usage accounting, and API keys for Livepeer network payments". It is a budget ledger that sits beside a Livepeer remote signer and decides, per signing request, whether an API key's allocation may pay.

It runs up to five components, each enabled by a flag (`README.md`, "Run the services"; `internal/app/server.go`):

| Component | Flag | Purpose |
| --- | --- | --- |
| Signer authorization webhook | `--enable-auth-webhook :PORT` | `POST /v1/signer/authorize`: approve or reject a payment |
| Management API | `--enable-management-api :PORT` | Grants, allocations, keys, sessions, reports |
| Embedded Kafka broker | `--enable-kafka` | Receives the signer's ticket events |
| Accounting | `--enable-accounting` | Consumes ticket events and debits allocations |
| On-chain listener | `--enable-onchain-listener` | Records TicketBroker escrow and redemptions (reporting only) |

The same operations exist as local CLI commands (`grant`, `allocation`, `api-key`, `session`, `usage`, `ledger`, `settlement`, `escrow`, `migrate`) that write the database directly and need no credential.

No licence file is published in the repository (the engine's `docs/references/upstream-baseline.md` records "None published").

### Data model

All tables are in `migrations/001_initial.sql` to `004_*.sql`. IDs are base64url-encoded UUIDv7 values, 22 characters (`internal/store/store.go`, `ID()`). Timestamps are Unix milliseconds. Amounts are stored as integer strings at 10^18 scale for **both** currencies (`internal/units/eth.go`) and shown by the API as decimal strings with up to 18 fractional digits.

| Entity (table) | Fields as the API returns them | Notes |
| --- | --- | --- |
| **Grant** (`grants`) | `id`, `name`, `sponsor`, `total_usd` or `total_eth`, `currency` (`usd` \| `eth`), `starts_at_ms`, `ends_at_ms`, `status` (`draft` \| `active` \| `paused` \| `closed`), `metadata` (free text), `created_at_ms` | A funded pool. Currency is fixed at creation; default USD, default amount 0, default status `draft`. A closed grant cannot reopen. The read does **not** include the unallocated balance; that is only in the ledger report. |
| **Allocation** (`grant_allocations`) | `id`, `grant_id`, `name`, `beneficiary` (free text), `allocated_<cur>`, `available_<cur>`, `spent_<cur>`, `currency`, `starts_at_ms`, `ends_at_ms`, `status` (`active` \| `paused` \| `exhausted` \| `revoked`), `metadata`, `created_at_ms` | A budget inside one grant, in the grant's currency. `available` can be negative. Zero funding makes it `exhausted`; funding reactivates it unless paused. Revoking returns the unused balance to the grant and is final. |
| **API key** (`api_keys`) | `id`, `allocation_id`, `name`, `prefix`, `created_at_ms`, `last_used_at_ms`, `revoked_at_ms` | Format `lpg_<key id>_<base64url of 32 random bytes>` (`internal/store/manage.go`, `newKeyRecord`). Only a SHA-256 hash is stored; the secret is returned once at creation. Many keys per allocation. |
| **Payment session** (`payment_sessions`) | `id`, `allocation_id`, `api_key_id`, `state_id`, `app`, `payment_type`, `orchestrator`, `status` (`active` \| `revoked`), `created_at_ms`, `last_seen_at_ms` | Created by the webhook on first authorization of a signer state. Its `id` is the `auth_id` the signer carries. Bound to one key, app, payment type and orchestrator address. |
| **Usage event** (`usage_events`) | `id`, `event_id`, `topic`, `partition`, `offset`, `status` (`applied` \| `quarantined` \| `ignored` \| `duplicate`), `error`, `computed_fee_eth`, `computed_fee_usd`, `created_at_ms`, `payment_session_id`, `request_id`, `pipeline`, `manifest_id`, `allocation_id`, `currency` | One row per Kafka message. Also stored but not returned: `raw_payload`, `started_at_ms`, `ended_at_ms`, `billable_seconds`, `pixels`. |
| **Signing authorization** (`signing_authorizations`) | not exposed by the API | One per applied ticket event: `request_id`, `sequence_number`, `pm_session_id`, `orchestrator`, `computed_fee_wei`, `computed_fee_usd`, `num_tickets` (1–100), `signed_at_ms`. |
| **Ledger** (`ledger_transactions`, `ledger_entries`, `account_balances`) | Report rows: `account_type`, `account_id`, `currency`, `balance_<cur>` | Append-only double entry (update and delete are blocked by triggers). Account types: `grant_funding_source`, `grant_unallocated`, `allocation_available`, `allocation_spent`, `treasury_cash`, `treasury_settled_spend`, `escrow_deposit`, `escrow_reserve`. Individual transactions are not exposed by the API, only balances. |
| **Settlement** (`settlements`) | `id`, `chain_id`, `contract_address`, `tx_hash`, `log_index`, `block_number`, `block_hash`, `sender`, `recipient`, `face_value_eth`, `paid_amount_eth`, `deposit_paid_eth`, `reserve_paid_eth`, `win_probability`, `sender_nonce`, `recipient_rand`, `pm_session_id`, `aux_data`, `payment_session_id`, `authorization_id`, `match_status` (`matched` \| `unmatched` \| `ambiguous`), `status` (`settled` \| `orphaned`), `generation`, `created_at_ms`, `settled_at_ms` | Winning-ticket redemptions seen on-chain. Always ETH. |
| **Escrow** (`escrow_snapshots`, `ticket_broker_events`) | Report: `chain_id`, `contract_address`, `sender`, `confirmed_through_block`, `deposit_balance_eth`, `reserve_balance_eth`, `total_balance_eth`. Activity: `event_type` (`opening_snapshot`, `deposit_funded`, `reserve_funded`, `reserve_claimed`, `withdrawal`, `winning_ticket_transfer`, `winning_ticket_redeemed`), amounts, block and tx fields | The signer wallet's TicketBroker deposit and reserve. |
| **Idempotency** (`management_idempotency`) | not exposed | Saved successful responses per `(grant_id, Idempotency-Key)`. Includes API-key secrets in plain text (`SECURITY.md`). |

**What does not exist:** users, actors, applications, tenants, plans, subscriptions, prices, invoices, payments from customers. The nearest things are the allocation's free-text `beneficiary` and `metadata`, and the session's `app`, which is the runner app name the signer reports, not a customer application. Actors and applications are engine records (section 2).

### Management API

Separate listener from the webhook. Every route needs the header `Livepeer-Clearinghouse-Token: <secret>` (`internal/serviceauth/registry.go`). Bodies are JSON objects with string values, or form encoded; unknown fields are rejected; 1 MiB limit (`internal/app/management.go`). Creation returns 201, everything else 200. All responses carry `Cache-Control: no-store`.

| Method and path | Permission | Request | Response |
| --- | --- | --- | --- |
| `GET /v1/grants` | `grants.read` | `limit`, `cursor` | `{items: Grant[], next_cursor}` |
| `GET /v1/grants/{id}` | `grants.read` | | `Grant` |
| `POST /v1/grants` | `grants.create` (+ `grants.fund` if amount > 0) | `name` (required), `sponsor`, `amount_usd` \| `amount_eth`, `status` (`draft` \| `active` \| `paused`), `metadata`, `starts_at`, `ends_at` (RFC 3339) | `{id}`. **No idempotency key support.** |
| `POST /v1/grants/{id}/fund` | `grants.fund` | `amount_usd` \| `amount_eth` (positive, grant's currency) | `{id}` |
| `PATCH /v1/grants/{id}/status` | `grants.status` | `status`: `draft` \| `active` \| `paused` \| `closed` | `{id, status}` |
| `GET /v1/allocations` | `allocations.read` | `limit`, `cursor`, `grant_id` | page of `Allocation` |
| `GET /v1/allocations/{id}` | `allocations.read` | | `Allocation` |
| `POST /v1/allocations` | `allocations.create` (+ `.fund` if amount > 0 or `all`) | `grant_id`, `name` (required), `beneficiary`, `amount_*` (a decimal or `all`), `status` (`active` \| `paused`), `metadata`, `starts_at`, `ends_at` | `{id}` |
| `POST /v1/allocations/{id}/fund` | `allocations.fund` | `amount_*` (positive, or `all`) | `{id}`. Moves unallocated grant funds to the allocation; 409 if the grant has too little. |
| `PATCH /v1/allocations/{id}/status` | `allocations.status` | `status`: `active` \| `paused` | `{id, status}` |
| `POST /v1/allocations/{id}/revoke` | `allocations.revoke` | | `{id, status: "revoked"}`; unused funds return to the grant |
| `GET /v1/api-keys` | `api_keys.read` | `limit`, `cursor`, `grant_id`, `allocation_id` | page of `ApiKey` (no secret) |
| `GET /v1/api-keys/{id}` | `api_keys.read` | | `ApiKey` |
| `POST /v1/api-keys` | `api_keys.create` (+ `allocations.create` and `.fund` with `grant_id`) | `name` and exactly one of `allocation_id` or `grant_id`; with `grant_id`, `amount_*` is required and a new allocation is created atomically | `{allocation_id, id, api_key}`; the secret is shown only here |
| `POST /v1/api-keys/{id}/revoke` | `api_keys.revoke` | | `{id, status: "revoked"}` |
| `GET /v1/sessions` | `sessions.read` | `limit`, `cursor`, `grant_id`, `allocation_id` | page of `PaymentSession` |
| `GET /v1/sessions/{id}` | `sessions.read` | | `PaymentSession` |
| `POST /v1/sessions/{id}/revoke` | `sessions.revoke` | | `{id, status: "revoked"}` |
| `GET /v1/settlements` | `settlements.read` | `limit`, `cursor`, `grant_id`, `allocation_id` | page of `Settlement` |
| `GET /v1/usage` | `usage.read` | `limit`, `cursor`, `grant_id`, `allocation_id`, `manifest_id` | page of `UsageEvent`. Oldest first. **No time filter.** |
| `GET /v1/ledger/report` | `ledger.read` | | array of account balances |
| `GET /v1/escrow/report` | `escrow.read` | | array of escrow balances |
| `GET /v1/escrow/activity` | `escrow.read` | | array of escrow events |
| `GET /livez`, `GET /readyz` | none | | 200, or 503 during shutdown or database failure |

Lists: `limit` defaults to 100, maximum 1,000; `cursor` is opaque and bound to the resource and its filters; `next_cursor` is `""` on the last page; order is insertion order (`internal/app/pagination.go`).

Idempotency: `Idempotency-Key` (1–256 base64url characters) is honoured on allocation create, API-key create, grant fund and allocation fund. A matching retry replays the original response, secret included; a different body is 409. Keys are shared across callers within a grant.

Errors: `{"error": "..."}` with 400, 404, 409, 413, 415 or 500. Missing credential is plain-text 401; missing permission is plain-text 403.

### How credits are funded, spent and reconciled

**Funding is bookkeeping, not money.** Creating or funding a grant posts a ledger transfer from `grant_funding_source` to `grant_unallocated` (`internal/store/manage.go`, `createGrant`, `fundGrant`). Nothing is collected from anyone. Real money enters separately: the operator deposits ETH into the signer wallet's TicketBroker deposit and reserve on Arbitrum One.

| Step | Ledger movement | Code |
| --- | --- | --- |
| Create or fund a grant | `grant_funding_source` → `grant_unallocated` | `createGrant`, `fundGrant` |
| Create or fund an allocation | `grant_unallocated` → `allocation_available` | `createAllocation`, `fundCurrency` |
| A ticket event is applied | `allocation_available` → `allocation_spent` | `internal/store/ingest.go`, `Ingest` |
| Revoke an allocation | remaining `allocation_available` → `grant_unallocated` | `SetStatus` |

**Spending.** The signer publishes a `create_signed_ticket` event to Kafka for each signing request. Accounting reads it, checks it against the payment session (`auth_id`, state, app, pipeline, orchestrator), and debits the allocation by `computed_fee` in wei for an ETH allocation or `computed_fee_usd` for a USD allocation. Events that fail a check are stored as `quarantined` and charge nothing; repeats are `duplicate`; other event types are `ignored`. When the balance reaches zero or below, the allocation becomes `exhausted`.

**No reservation.** Authorization only checks that the balance is positive and at least the proposed fee. It does not hold funds, so accounting lag can take an allocation negative (README, "How accounting works"). The webhook refuses all payments with 503 when Kafka lag reaches `--max-kafka-lag` (default 60 s) or cannot be measured.

**Reconciliation, inside Batteries.** The on-chain listener matches each winning-ticket redemption to a payment session by `(pm_session_id, recipient)` and marks it `matched`, `unmatched` or `ambiguous`. It "does not charge for usage again". Reports: `ledger report` (every account balance), `escrow report`, `escrow activity`, `settlement list`. Prometheus metrics cover overdrawn allocations, quarantines and settlement shortfall (`migrations/003_metric_summaries.sql`, `examples/monitoring/`).

### How it authenticates

Three credential types in one credentials file (`creds.example.toml`), each entry with an `id`, a `secret` and exactly one block:

| Block | Used by | How |
| --- | --- | --- |
| `management` with an `allow` list | Management API clients | Secret sent as-is in `Livepeer-Clearinghouse-Token`. Permissions are `resource.action` or `resource.*`. **A permission covers every resource of that type; there is no per-grant scoping.** |
| `webhook` with `authorize = true` | The signer | Same header on `POST /v1/signer/authorize` |
| `kafka` with `username` and `allow` (`read` \| `write`) | The signer's producer and the accounting consumer | SASL/PLAIN or SCRAM-SHA-512 |

The `lpg_` API key is not a management credential. It only authorizes signing against its allocation, and it arrives nested inside the webhook body.

There is no login, no session, no user account and no OAuth or OIDC anywhere in the code.

### How it connects to the node remote signer

```text
client (the engine)  --Authorization: Bearer lpg_...-->  remote signer
remote signer  --POST /v1/signer/authorize {headers, state}-->  Batteries webhook
Batteries  --{status: 200, auth_id: <payment session id>}-->  remote signer
remote signer  --signs tickets, returns payment-->  client
remote signer  --create_signed_ticket event (durable outbox)-->  Kafka topic livepeer-signing
Batteries accounting  --consumes, debits allocation-->  SQLite ledger
```

- **Signer side** (`node/docs/signer.md`, "Authorization" and "Kafka accounting and budgets"): `AuthWebhookFile` and `AuthWebhookHeadersFile` point at the Batteries webhook and carry the webhook token; a `[Kafka]` block (`Broker`, `Topic`, credentials, `OutboxDB`) enables accounting events. The Batteries README shows the equivalent go-livepeer flags (`-remoteSignerWebhookUrl`, `-remoteSignerWebhookHeaders`, `-kafkaBootstrapServers`, `-kafkaGatewayTopic`).
- **Webhook request** (`API.md`, `internal/store/auth.go`): `{headers: {Authorization: ["Bearer lpg_..."]}, state: {StateID, OrchestratorAddress, App, Type, FeeWei, FeeUSD, AuthID}}`.
- **Decision**: always HTTP 200 with `{status, reason?, expiry: 0, auth_id?}`. `status` is 200 (approved), 400 (bad fee), 401 (invalid or revoked key), 402 (exhausted or insufficient balance), 403 (grant or allocation inactive, outside its time window, or session binding mismatch) or 503 (Kafka lag). `expiry` is always 0, so every payment is re-authorized.
- **Event** (`internal/store/ingest.go`, `SignedTicketEvent`): `session_id`, `auth_id`, `app`, `pipeline`, `request_id`, `manifest_id`, `orch_address`, `pm_session_id`, `computed_fee` (wei), `computed_fee_usd`, `sequence_number`, `num_tickets`, `previous_time_unix`, `current_time_unix`, `billable_secs`, `pixels`.
- **Deployment**: `examples/compose/compose.yaml` runs Batteries and the signer in one network namespace with Litestream backups. The console's stack (`builder-core-console/deploy/compose.yaml`) does the same, pinned to Batteries `ca09e47`.

### What it does not do

- No plans, subscriptions, recurring allowances or periodic resets. An allocation has an optional `starts_at`/`ends_at` window and nothing else.
- No retail pricing or markup. Allocations are debited at the network (wholesale) fee the signer computed.
- No payment collection from anyone: no card, invoice, checkout or crypto intake. Funding a grant is an operator typing a number.
- No invoices, refunds, tax or currency conversion. Currency is USD or ETH per grant, fixed.
- No login, users, roles, tenants or applications.
- No per-grant or per-tenant credential scoping (the engine's "Mode B" gap, `docs/contracts/payments.md`).
- No hard spending limit; balances can overshoot.
- No time filter or newest-first order on usage (console gap G6).
- No idempotency key on grant creation.
- No way to remove funds from a grant, and no ledger transaction history over the API (balances only).
- No outbound webhooks or event feed.
- Single SQLite database, one accounting worker per database (`SECURITY.md`).

---

## 2. The engine's provider protocols

All protocols are in `src/livepeer_builder/protocols/__init__.py`. Contract types are in `src/livepeer_builder/contracts/`. Parts are wired in `src/livepeer_builder/runtime/assembly.py` (`EngineParts`, `EngineSupply`): an embedding application replaces a part by supplying its own.

There is **no single "payment provider" interface, and no identity-provider or plans interface.** The seams are:

| Area | Protocol | Default implementation | Backed by Batteries? |
| --- | --- | --- | --- |
| Identity | `Authenticator` | `ApiKeyAuthenticator` (`adapters/auth.py`), `JwtBearerAuthenticator` (`adapters/jwt.py`), combined by `AuthenticatorChain` | No |
| Authorization | `AccessPolicy` | `DefaultPolicy` (`services/policy.py`) | No |
| Budgets (writes and reads) | `AllocationManager` | `BatteriesClient` (`adapters/batteries.py`) | **Yes, all 11 methods** |
| Budgets (who pays, and the balance) | `AllowanceReader`, `CredentialResolver` | `PaymentsService` (`services/payments.py`) | Indirectly, through `AllocationManager.read_allocation` |
| Usage | `UsageSource` | `BatteriesUsageSource` (`adapters/batteries.py`) | **Yes** |
| Secrets | `SecretStore` | `EncryptedDbSecretStore`, `SettingsSecretStore` (`adapters/secrets.py`) | No |
| Actors and keys | `ActorRepo`, `KeyRepo` (parts of `EngineStore`) | SQL store (`store/`), tables `lpb_actors`, `lpb_actor_sightings`, `lpb_access_keys` | No |
| Plans | none | none | n/a |

### Exact interfaces

```python
@runtime_checkable
class Authenticator(Protocol):
    async def authenticate(self, request: AuthRequest) -> ActorContext | None: ...
    def challenge(self) -> str | None: ...

class AccessPolicy(Protocol):
    def check(self, actor: ActorContext, operation: Operation,
              resource: ResourceRef | None = None) -> None: ...

class SecretStore(Protocol):
    async def put(self, name: str, secret: str) -> SecretRef: ...
    async def get(self, ref: SecretRef) -> str: ...
    async def delete(self, ref: SecretRef) -> None: ...

class CredentialResolver(Protocol):
    async def credential(self, actor: ActorContext) -> PaymentCredential: ...

class AllocationManager(Protocol):
    async def create_key_for_grant(self, grant_id: str, name: str, amount: Money,
                                   idempotency_key: str) -> NewAllocationKey: ...
    async def create_key(self, allocation_id: str, name: str,
                         idempotency_key: str) -> NewAllocationKey: ...
    async def fund_allocation(self, allocation_id: str, amount: Money,
                              idempotency_key: str) -> None: ...
    async def fund_grant(self, grant_id: str, amount: Money, idempotency_key: str) -> None: ...
    async def set_allocation_status(self, allocation_id: str, status: str) -> None: ...
    async def revoke_allocation(self, allocation_id: str) -> None: ...
    async def revoke_key(self, api_key_id: str) -> None: ...
    async def read_allocation(self, allocation_id: str) -> Allowance: ...
    async def list_grants(self) -> list[GrantRecord]: ...
    async def grant_page(self, cursor: str | None) -> GrantPage: ...
    async def create_grant(self, name: str, amount: Money,
                           metadata: Mapping[str, str] | None = None) -> GrantRecord: ...

class UsageSource(Protocol):
    async def page(self, cursor: str | None, limit: int = 1000) -> UsagePage: ...

class AllowanceReader(Protocol):
    async def allocation_for(self, application_id: str, actor_id: str | None) -> str | None: ...
    async def read_allowance(self, allocation_id: str) -> Allowance: ...
```

Key contract types (`contracts/common.py`, `contracts/payments.py`, `contracts/costs.py`, `contracts/access.py`):

```python
Money(amount: Decimal, currency: "USD" | "ETH")          # JSON: {"amount": "0.25", "currency": "USD"}
Allowance(allocation_id: str, status: str, granted: Money | None, spent: Money | None, available: Money | None)
GrantRecord(id: str, name: str, status: str, currency: str, total: str, metadata: dict[str, str])
ProvisionedActor(application_id, actor_id, grant_id, allocation_id, api_key_id, secret_ref: SecretRef,
                 currency, status: "active"|"paused"|"exhausted"|"revoked", created_at, updated_at, label)
KnownActor(application_id, actor_id, label, name: str | None, allocation: ProvisionedActor | None,
           first_seen_at, last_seen_at, provisioned: bool)
AccessKey(key_id, kind: "actor"|"admin"|"auditor"|"service", actor_id, application_id,
          permissions: tuple[str, ...], label, created_at, revoked_at)
UsageRow(id, event_id, status, manifest_id, allocation_id, payment_session_id, request_id, pipeline,
         computed_fee_eth: Decimal | None, computed_fee_usd: Decimal | None, currency, created_at)
Fees(fee_eth: Decimal, fee_usd: Decimal | None, row_count: int)
Reconciliation(application_id, actor_id, allocation_id, provider_spent: Money | None,
               by_class: dict[CostClass, Fees], unattributed: Fees, balanced: bool | None)
```

### Which methods Batteries implements

`BatteriesClient` implements every `AllocationManager` method; `BatteriesUsageSource` implements `UsageSource.page`. The engine's own reference table is `docs/references/batteries-api.md`.

| Protocol method | Batteries call |
| --- | --- |
| `create_key_for_grant` | `POST /v1/api-keys` `{grant_id, name, amount_usd \| amount_eth}` + `Idempotency-Key` |
| `create_key` | `POST /v1/api-keys` `{allocation_id, name}` + `Idempotency-Key` |
| `fund_allocation` | `POST /v1/allocations/{id}/fund` + `Idempotency-Key` |
| `fund_grant` | `POST /v1/grants/{id}/fund` + `Idempotency-Key` |
| `set_allocation_status` | `PATCH /v1/allocations/{id}/status` |
| `revoke_allocation` | `POST /v1/allocations/{id}/revoke` |
| `revoke_key` | `POST /v1/api-keys/{id}/revoke` |
| `read_allocation` | `GET /v1/allocations/{id}` → `Allowance` (`allocated_*` → `granted`, `spent_*`, `available_*`) |
| `list_grants`, `grant_page` | `GET /v1/grants?limit=1000[&cursor=]` |
| `create_grant` | `POST /v1/grants` `{name, status: "active", sponsor: name, amount_*, metadata}` then `GET /v1/grants/{id}` |
| `UsageSource.page` | `GET /v1/usage?limit=&cursor=` (no filters) |

The engine uses two Batteries credentials: `LPB_BATTERIES_TOKEN` (allocations, keys, usage, `grants.fund`) and the optional `LPB_BATTERIES_OPERATOR_TOKEN` (`grants.read`, `grants.create`). Without the second, the "grant desk" is off and the grant list and create routes are not mounted (`services/grants.py`, `GrantDesk`).

Batteries endpoints the engine never calls: sessions, settlements, ledger report, escrow report and activity, API-key reads, allocation lists, grant status. The console reads those **directly from Batteries** with a read-only token (`builder-core-console/web/src/adapters/batteries/reader.ts`).

### Two kinds of key

| | Engine access key | Batteries allocation key |
| --- | --- | --- |
| Prefix | `lpk_` | `lpg_` |
| Issued by | The engine (`services/keys.py`) | Batteries, on the engine's request |
| Stored | Hash in `lpb_access_keys` | Encrypted in the engine's `SecretStore`; hash in Batteries |
| Held by | The builder, operator or app server | Nobody outside the engine. Provisioning and rotation return the actor, never the key (`docs/contracts/payments.md`, "What builders never see") |
| Authorizes | Engine REST calls | Signing against one allocation |
| Many per user | Yes | One live key per actor |

### How engine routes map to provider calls

Routes are in `src/livepeer_builder/http/app.py`. "Admin" means a credential of kind `admin`; "auditor" is the read-only admin kind that the reader token is.

| Engine route | Engine call | Policy operation | Provider call |
| --- | --- | --- | --- |
| `GET /v1/allowance[?actor_id=]` | `payments.allowance` | `costs.read` on the allocation (own actor, or any actor in the application for admin or auditor) | `read_allocation` → `GET /v1/allocations/{id}` |
| `GET /v1/admin/grants` | `payments.grants.list_grants` | `admin.allocations` (**admin only; an auditor is refused**) | `list_grants` → `GET /v1/grants` (operator token) |
| `POST /v1/admin/grants` | `payments.grants.create_grant` | `admin.allocations` | `create_grant` → `POST /v1/grants`, `GET /v1/grants/{id}` |
| `POST /v1/admin/grant/fund` | `payments.fund_grant` | `admin.allocations` | `fund_grant` → `POST /v1/grants/{id}/fund` |
| `GET /v1/admin/actors` | `payments.list_actors` | `admin.read` | **None.** Engine store only |
| `GET /v1/admin/applications/{app}/actors/{actor}/allocation` | `payments.get_actor` | `admin.read` | **None.** Engine store only |
| `POST …/allocation` | `payments.provision` | `admin.allocations` | `create_key_for_grant` → `POST /v1/api-keys` with `grant_id` (allocation + key + funding in one call) |
| `POST …/allocation/fund` | `payments.fund` | `admin.allocations` | `fund_allocation` → `POST /v1/allocations/{id}/fund` |
| `POST …/allocation/status` | `payments.set_status` | `admin.allocations` | `set_allocation_status` → `PATCH /v1/allocations/{id}/status` |
| `POST …/allocation/revoke` | `payments.revoke` | `admin.allocations` | `revoke_allocation` → `POST /v1/allocations/{id}/revoke` |
| `POST …/allocation/rotate-key` | `payments.rotate_key` | `admin.allocations` | `create_key` then `revoke_key` |
| `GET /v1/admin/keys`, `GET /v1/admin/keys/{id}` | `keys.list_keys`, `keys.get` | `admin.read` | **None.** These are `lpk_` engine keys |
| `POST /v1/admin/keys`, `…/rotate`, `…/revoke` | `keys.issue`, `rotate`, `revoke` | `admin.keys` | **None** |
| `GET /v1/admin/reconciliation?application_id=&actor_id=` | `costs.reconcile` | `admin.read` | Engine store for the cost classes, then `read_allowance` → `GET /v1/allocations/{id}` for `provider_spent` |
| `GET /v1/costs/summary`, `/v1/costs/projections`, `/v1/jobs/{id}/cost` | `costs.summary`, `recent`, `for_job` | `costs.read` | **None at read time.** They read usage rows the cost-sync worker cached from `UsageSource.page` (every 30 s by default) |
| `POST /v1/admin/costs/sync` | `costs.sync_now` | `admin.costs` | `UsageSource.page` → `GET /v1/usage` |

Things that follow from the code and matter for the UI:

- **`ProvisionedActor.status` is the engine's cached copy.** It changes only when an engine command runs (`_update_status`). When Batteries marks an allocation `exhausted` after spending, the engine's actor record still says `active`. The live status is `Allowance.status` from `GET /v1/allowance`. (Inferred from `services/payments.py`; not observed live.)
- **Provisioning is never automatic.** A new user needs an explicit admin call, and in `per_actor` mode an unprovisioned actor's job fails with 402 before payment.
- **Money-moving commands need an `operation_ref`** and are replay-safe (`Idempotent-Replayed: true` on a repeat).
- **`GrantRecord` carries only `id`, `name`, `status`, `currency`, `total`, `metadata`.** It has no unallocated, allocated or spent figure, and the engine has no route listing a grant's allocations.
- **The engine has no "who am I" route** (console gap G13) and no top-up history.

### Live responses (17 November 2026)

Health reports `"allocation_mode": "per_actor"`. IDs are truncated to six characters; actor names are the demo labels on this instance. Amounts are JSON strings.

Which token each GET needs, as observed:

| GET | Reader token (auditor) | Result |
| --- | --- | --- |
| `/v1/admin/actors` | 200 | list of `KnownActor` |
| `/v1/admin/keys` | 200 | list of `AccessKey` |
| `/v1/admin/keys/{key_id}` | 200 | `AccessKey` |
| `/v1/admin/applications/default/actors/{actor}/allocation` | 200 | `ProvisionedActor` |
| `/v1/allowance` | 404 | `{"error":"no allocation pays for actor 'console-reader'"}`: the reader has no allocation of its own |
| `/v1/allowance?actor_id={actor}` | 200 | `Allowance` |
| `/v1/admin/reconciliation` | 404 | `{"error":"no allocation pays for that actor or application"}`: in `per_actor` mode it needs `actor_id` (console gap G10) |
| `/v1/admin/reconciliation?application_id=default&actor_id={actor}` | 200 | `Reconciliation` |
| `/v1/costs/summary[?actor_id=]` | 200 | `CostSummary` |
| `/v1/admin/grants` | **403** | `{"error":"admin.allocations is not a read; an auditor credential only reads"}`. **Needs a real admin credential.** |

`GET /v1/admin/actors` (array; one element shown):

```json
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
    "secret_ref": { "ref": "db:vW515k…" },
    "currency": "USD",
    "status": "active",
    "created_at": "2026-11-05T15:12:07.552116Z",
    "updated_at": "2026-11-05T15:12:07.552116Z",
    "label": "Acme Studio"
  },
  "first_seen_at": null,
  "last_seen_at": null,
  "provisioned": true
}
```

Types: every ID and label is a string; `name`, `first_seen_at`, `last_seen_at` are string or null; `allocation` is an object or null; `provisioned` is a boolean. The instance has five actors, one `active` and four `revoked`. `GET …/actors/{actor}/allocation` returns the inner `allocation` object on its own.

`GET /v1/admin/keys` (array; three of twelve shown):

```json
[
  { "key_id": "key_0IPuSe…", "kind": "admin", "actor_id": "operator", "application_id": "default",
    "permissions": [], "label": "console",
    "created_at": "2026-11-05T14:09:02.388077Z", "revoked_at": null },
  { "key_id": "key_Jl5GXc…", "kind": "auditor", "actor_id": "console-reader", "application_id": "default",
    "permissions": [], "label": "console reader",
    "created_at": "2026-11-05T14:09:04.984207Z", "revoked_at": null },
  { "key_id": "key_BVwGhc…", "kind": "actor", "actor_id": "acme-studio", "application_id": "default",
    "permissions": ["costs.read", "discover", "jobs.read", "jobs.run"], "label": "Acme Studio",
    "created_at": "2026-11-05T15:12:07.030921Z", "revoked_at": "2026-11-05T15:18:12.680955Z" }
]
```

The token is never returned. One actor can hold several live keys (this instance's `acme-studio` has four).

`GET /v1/allowance?actor_id=acme-studio`:

```json
{
  "allocation_id": "AaGsRG…",
  "status": "active",
  "granted":   { "amount": "0.25", "currency": "USD" },
  "spent":     { "amount": "0.025886863010155183", "currency": "USD" },
  "available": { "amount": "0.224113136989844817", "currency": "USD" }
}
```

`GET /v1/admin/reconciliation?application_id=default&actor_id=acme-studio`:

```json
{
  "application_id": "default",
  "actor_id": "acme-studio",
  "allocation_id": "AaGsRG…",
  "provider_spent": { "amount": "0.025886863010155183", "currency": "USD" },
  "by_class": {
    "delivered":            { "fee_eth": "0.00000132881526191",  "fee_usd": "0.003067654430465203", "row_count": 2 },
    "failed_after_payment": { "fee_eth": "0.000012423806151904", "fee_usd": "0.022819208579689980", "row_count": 3 },
    "uncertain":            { "fee_eth": "0", "fee_usd": "0", "row_count": 0 },
    "pending":              { "fee_eth": "0", "fee_usd": "0", "row_count": 0 }
  },
  "unattributed": { "fee_eth": "0", "fee_usd": "0", "row_count": 0 },
  "balanced": true
}
```

`provider_spent` equals `delivered` + `failed_after_payment` to the last digit. Note that 88% of this user's spend was on jobs that failed after payment: the allocation is debited for them even though `billable` is zero.

`GET /v1/costs/summary`:

```json
{
  "start": "2026-10-18T21:13:10.050248Z",
  "end": "2026-11-17T21:13:10.050248Z",
  "by_class": {
    "delivered":            { "fee_eth": "0.00000132881526191",  "fee_usd": "0.003067654430465203", "row_count": 2 },
    "failed_after_payment": { "fee_eth": "0.000012423806151904", "fee_usd": "0.022819208579689980", "row_count": 3 },
    "uncertain":            { "fee_eth": "0", "fee_usd": "0", "row_count": 0 },
    "pending":              { "fee_eth": "0", "fee_usd": "0", "row_count": 0 }
  },
  "jobs_with_cost": 4,
  "jobs_pending": 0,
  "by_app": {
    "blueclaw/chat/qwen3.8-27b": {
      "delivered":            { "fee_eth": "4.745768792E-8",     "fee_usd": "0.000109559086789961", "row_count": 1 },
      "failed_after_payment": { "fee_eth": "0.00000121447566997", "fee_usd": "0.002803694220309158", "row_count": 2 }
    },
    "fal-flux-schnell": { "delivered": { "fee_eth": "0.00000128135757399", "fee_usd": "0.002958095343675242", "row_count": 1 } },
    "text-to-image":    { "failed_after_payment": { "fee_eth": "0.000011209330481934", "fee_usd": "0.020015514359380822", "row_count": 1 } }
  }
}
```

Parsing notes: decimals are strings and **can be in scientific notation** (`"4.745768792E-8"`); `fee_usd` can be `null`; `row_count`, `jobs_with_cost` and `jobs_pending` are integers; `by_app` keys are runner app names and only the classes that occurred are present.

`GET /v1/admin/grants`: **not sampled** (no admin credential available). The live OpenAPI schema `GrantRecord` is `{id: string, name: string, status: string, currency: string, total: string, metadata: {[key]: string}}`, an array of which the route returns. Per `adapters/batteries.py`, `currency` is upper case (`"USD"`) and `total` is the decimal string Batteries reports.

---

## 3. PymtHouse

### Status of this section

PymtHouse publishes real documentation, so most of this is documented fact with a URL. Three caveats:

- The docs describe the hosted product's **own** API. None of it has been checked against a live account; I made no authenticated call.
- Most response bodies in the live OpenAPI are typed as a generic object, so shapes below come from the prose docs.
- Nothing public describes an integration with `livepeer-builder-core`. That part is marked as inference.

### What it is

- "The business layer for Livepeer apps": identity, metering and payment signing, hosted, "Free during beta". Source: https://pymthouse.com
- Your backend registers as an OAuth client; PymtHouse is the OIDC issuer, issues signed JWTs and meters usage through OpenMeter. Source: https://docs.pymthouse.com/index.md
- Open repository, "Hosted Builder API providing billing, identity and payments for Livepeer-powered applications", Next.js with PostgreSQL, no licence set on the repository. Source: https://github.com/pymthouse/pymthouse
- The homepage lists: OIDC for people and machines, scoped tokens, white-label login, usage-metered plans with a Starter allowance, per-request metering, remote signing for Livepeer tickets, per-user cost tracking, and tenants ("platforms") with isolated OIDC clients, independent billing per tenant and optional white-label login. Source: https://pymthouse.com

### Identity and OIDC (documented)

Discovery document: https://pymthouse.com/api/v1/oidc/.well-known/openid-configuration (fetched 17 November 2026).

| Item | Value |
| --- | --- |
| Issuer | `https://pymthouse.com/api/v1/oidc` |
| Authorization endpoint | `/api/v1/oidc/auth` |
| Token endpoint | `/api/v1/oidc/token` |
| Userinfo | `/api/v1/oidc/me` |
| JWKS | `/api/v1/oidc/jwks` |
| End session | `/api/v1/oidc/session/end` |
| Device authorization | `/api/v1/oidc/device/auth` |
| Also published | introspection, revocation, pushed authorization requests |
| Grant types | `authorization_code`, `refresh_token`, `client_credentials`, device code |
| Response type, PKCE | `code`; `S256` |
| ID token signing | `RS256` |
| Token endpoint auth | `none`, `client_secret_post`, `client_secret_basic` |
| Scopes | `openid`, `email`, `profile`, `sign:job`, `users:read`, `users:write`, `users:token`, `device:approve`, `admin` |
| Claims | `sub`, `email`, `email_verified`, `name`, `sid`, `auth_time`, `iss` |

Client model (https://docs.pymthouse.com/integration/client-model.md): each app has a public client `app_…` (no secret; also the `{clientId}` in every API path) and a confidential client `m2m_…` with secret `pmth_cs_…`. An optional third client `web_…` does authorization code with redirect for browser sign-in. Whether the public client holds the `users:token` scope decides the billing mode: per-user attribution or app-level only.

Interactive login (https://docs.pymthouse.com/integration/interactive-login.md): standard authorization code with PKCE, a `state` check, `id_token` + `access_token` + rotating refresh token (`pmth_rt_…`), and RP-initiated logout with a pre-registered `post_logout_redirect_uri`.

User tokens minted by a backend (https://docs.pymthouse.com/integration/user-tokens.md): `POST /api/v1/apps/{clientId}/users/{externalUserId}/token` with body `{scope}` returns `{access_token, token_type, expires_in}`, lifetime about 300 s, no refresh. Claims: `iss`, `sub` (PymtHouse's internal app-user ID, **not** your `externalUserId`), `client_id`/`azp` (the `app_…` ID), `scope`, `exp`. The `admin` scope is always refused for user tokens.

**Not documented:** how white-label sign-in is configured (logo, colours, domain, copy), whether it is per tenant in the API, and any role or group claim. "White-label login" and "branded sign-in" appear only on the marketing homepage. The repository README mentions custom domains only as a step in its Vercel deployment guide, not as a sign-in feature.

### Users (documented)

Source: https://docs.pymthouse.com/integration/user-management.md. Base path `/api/v1/apps/{clientId}/users`, M2M auth.

| Call | Shape |
| --- | --- |
| `GET …/users` | list of provisioned users (response shape not documented) |
| `POST …/users` | upsert `{externalUserId, email?, status?: "active" \| "inactive"}`; a new user is subscribed to the Starter plan automatically |
| `PUT …/users` | same body, updates |
| `DELETE …/users?externalUserId=` | soft delete: sets `inactive` |
| `GET/POST/DELETE …/users/{externalUserId}/keys` | per-user API keys; create returns `{keyId, apiKey, createdAt}` once |

Two ID spaces: `externalUserId` (yours, the join key) and `endUserId` (PymtHouse's UUID, used by the Usage API).

### Plans (documented)

Source: https://docs.pymthouse.com/integration/plans.md.

| Call | Auth | Shape |
| --- | --- | --- |
| `GET /api/v1/apps/{clientId}/plans[?apiVersion=2]` | M2M or dashboard session | v1: array of plans. v2: `{apiVersion: 2, products: [...]}` |
| `POST …/plans` | **dashboard session only** | create; returns `{id}` |
| `PUT …/plans` | dashboard session only | body includes `id`; `capabilities`, if sent, replaces the whole list |
| `DELETE …/plans?planId=` | dashboard session only | |
| `POST …/plans/{planId}/sync` | dashboard session only | push to OpenMeter |
| `GET/PUT …/starter-plan` | dashboard session only | `{includedUsdMicros}` |

Plan fields: `id`, `clientId`, `name`, `type` (`free` \| `subscription` \| `usage`), `priceAmount`, `priceCurrency`, `status` (`active` \| `inactive`), `isNetworkDefault`, `isStarterDefault`, `includedUnits`, `includedUsdMicros`, `overageRateWei`, `overageRateUsd`, `chargeThresholdUsd` (pay-per-use only), `billingCycle` (`monthly`), `openmeterPlanId`, `lastSyncedAt`, `syncError`, and `capabilities[]` of `{pipeline, modelId, slaTargetScore?, slaTargetP95Ms?, maxPricePerUnit?, retailRateUsd?}` (read back as `effectiveRetailRateUsd`).

**Markup is a first-class plan field.** `overageRateUsd` is "retail USD per network USD-micro": the docs give `0.0000015` as a 50% markup. `capabilities[].retailRateUsd` overrides it per pipeline and model. This is the closest public match to the brief's "markup rule".

**Plan mutation cannot be done by a backend service.** The docs say plan create, update and delete take a logged-in dashboard session cookie and reject M2M credentials. An operator console that edits plans through an API client would need that to change, or would have to drive PymtHouse's own dashboard.

### Allowances and balances (documented)

Source: https://docs.pymthouse.com/integration/allowances.md. Balances live in OpenMeter, not in PymtHouse's database.

| Call | Shape |
| --- | --- |
| `GET …/users/{externalUserId}/allowances` | `{externalUserId, balanceUsdMicros, consumedUsdMicros, lifetimeGrantedUsdMicros, grants: [{id, amountUsdMicros, source, createdAt, featureKey}]}` |
| `POST …/users/{externalUserId}/allowances` | `{amountUsdMicros, source?: "manual" \| "trial" \| "promo" \| "plan_adjustment", featureKey?}`: an additive top-up |
| `GET /api/v1/builder/apps/{clientId}/usage/balance?externalUserId=` | `{balanceUsdMicros, hasAccess, remainingUsdMicros, consumedUsdMicros, lifetimeGrantedUsdMicros}` |
| `GET …/users/{externalUserId}/subscription` | active plan, period and status (fields not documented) |
| `POST …/users/{externalUserId}/subscription/change` | switch plan; a paid target "may return a Connect `checkoutUrl`" (request body not documented) |

**Vocabulary clash.** In PymtHouse a "grant" is one top-up on one user's allowance. In the engine and Batteries a grant is the operator's funded pool. PymtHouse's "allowance" is what the engine calls an allocation's `Allowance`. The mapping is in section 5.

### Usage (documented)

Source: https://docs.pymthouse.com/integration/usage-api.md.

`GET /api/v1/builder/apps/{clientId}/usage` (M2M Basic only; a bearer token is refused). Query: `startDate`, `endDate`, `groupBy` (`none` \| `user` \| `pipeline_model` \| `daily_pipeline`), `userId` (the internal `endUserId`), `gatewayRequestId`, `include=retail`.

Response: `{clientId, source: "openmeter", period: {start, end}, totals: {requestCount, totalFeeWei, totalFeeEth, networkFeeUsdMicros, ownerChargeWei, ownerChargeUsdMicros, platformFeeWei}, byUser?: [{endUserId, externalUserId, requestCount, feeWei}], byPipelineModel?: [{pipeline, modelId, requestCount, networkFeeUsdMicros, endUserBillableUsdMicros}], byDailyPipeline?}`. Unattributed usage appears under `endUserId: "unknown"`.

End-user routes (bearer `pmth_*` key or user JWT; identity comes only from the token): `GET /api/v1/user/usage`, `/usage/balance`, `/usage/requests` (signed-ticket history; query `groupBy`, `manifestId`, `gatewayRequestId`, `cursor`, `limit`, `from`, `to`). Source: https://pymthouse.com/api/v1/openapi.json

### Billing, payments and invoices (documented)

Sources: https://docs.pymthouse.com/integration/billing.md and https://docs.pymthouse.com/integration/payments.md.

Two billing modes appear: `owner_rollup` (the app owner pays PymtHouse for all of the app's usage) and `merchant` (end users pay through the owner's Stripe Connect account).

| Area | Calls | Notes |
| --- | --- | --- |
| Billing summary | `GET /api/v1/apps/{clientId}/billing` | `{clientId, plan, subscription: {id, status, currentPeriodStart, currentPeriodEnd}, cycle: {periodStart, periodEnd, usage, timeline: [{date, requestCount, feeWei}], overage: {overageUnits, overageWei}}, platformCutPercent}` |
| Spend posture | `GET …/billing/state` | `{status: "active" \| "overage" \| "at_risk" \| "blocked", reason, nextAction, balance: {currency, prepaidCredits, autoDebitAvailable, includedUsage}}` |
| Owner wallet | `GET …/billing/wallet`, `POST …/billing/wallet/top-up` `{amountUsd, successUrl}`, `GET …/billing/wallet/invoices` | Top-up returns a Stripe Checkout URL, $1 to $10,000 |
| Owner subscription | `GET …/billing/tiers`, `GET/PUT/DELETE …/billing/subscription` | `PUT {planKey, confirm: true}` |
| Owner cards | `GET/POST/PATCH/DELETE …/billing/payment-methods[/{id}]` | Setup-mode Checkout |
| Force collection | `POST …/billing/collect` | Invoices unbilled usage |
| End-user billing | `GET …/users/{externalUserId}/invoices`, `…/invoices/{invoiceId}/hosted-url`, `GET/POST …/users/{externalUserId}/payment-methods` | Invoice list is `{items, page, pageSize, totalCount}`; hosted URL is Stripe's |
| End-user checkout | `POST …/billing/checkout` `{planId, externalUserId, successUrl?, cancelUrl?}` | Dashboard session only |
| Stripe Connect | `GET/DELETE …/billing/stripe`, `POST …/billing/stripe/connect` | Connect OAuth starts from a dashboard session |

Denials use RFC 9457 problem details with a `code`: `owner_payment_method_required` (402), `end_user_cap_reached`, `stripe_connect_required`, `stripe_connect_pending` (403), `debt_ceiling_reached`. Auth and tenant mismatches on app-scoped routes return 404 on purpose.

`platformCutPercent` and `platformFeeWei` show that PymtHouse takes a platform fee on top of the network fee (10 in the docs' example; the real rate is not stated).

**Not documented:** refunds, credit notes, tax or VAT handling, any currency other than USD, dunning beyond the "debt ceiling", and a paid one-off credit pack for an end user (the wallet top-up is for the app owner; the per-user allowance grant moves no money).

**Not verified:** whether real charges are live. The homepage says "Free during beta". A search-engine summary of a Livepeer docs page said billing is in sandbox mode with a $5 monthly free allowance, but that page did not show this content when fetched, so treat it as unconfirmed.

### How it reaches the signer (documented)

Source: https://docs.pymthouse.com/integration/signer-routing.md. PymtHouse runs a "signer DMZ" (go-livepeer remote signer behind JWT verification). `GET /api/v1/apps/{clientId}/signer/routing` returns `{dmzUrl, jwksUrl, webhookUrl, meteringMode: "kafka" | "direct"}`. The signer's identity webhook is handled by a package, `@livepeer/clearinghouse-identity-webhook`, embedded at `POST /webhooks/remote-signer` or run as a sidecar at `POST /authorize`; it verifies the end user's JWT or API key and returns an `auth_id`. The credential presented to the signer is a short-lived signer token, obtained by RFC 8693 token exchange from a user JWT or API key (`SignerSession`: `access_token`, `expires_in`, `scope`, `balanceUsdMicros`, `lifetimeGrantedUsdMicros`, `signer_url`, `discovery_url`).

### How it would connect to the engine (inference)

Nothing public describes this. From the engine's seams, a PymtHouse provider would most plausibly:

- **Sign-in:** set `LPB_AUTH=jwt` (or `jwt,api_keys`), `LPB_JWT_ISSUER=https://pymthouse.com/api/v1/oidc`, and an audience. The engine then maps `sub` to `actor_id`. Two frictions: the engine accepts only RFC 9068 `at+jwt` tokens by default, and the docs' example user token decodes to a header with `typ: JWT`, which would need the weaker `LPB_JWT_TOKEN_TYPES` opt-out; and the engine's default display-name claim is `preferred_username`, which PymtHouse does not list (it lists `name`).
- **Budgets:** implement `AllocationManager` over allowances. `read_allocation` ↔ the allowance read; `fund_allocation` ↔ the allowance grant; `create_key_for_grant` ↔ user upsert plus a signer credential. There is no PymtHouse equivalent of an operator-level grant pool, `fund_grant`, `set_allocation_status` (pause) or `revoke_allocation`.
- **Paying:** `CredentialResolver.credential` would return a signer token instead of an `lpg_` key, and `LPB_SIGNER_URL` would point at PymtHouse's signer.
- **Usage:** `UsageSource.page` needs immutable per-ticket rows carrying `manifest_id`, an allocation ID and a session ID. The aggregated Usage API does not provide that; the end-user `usage/requests` route (which accepts `manifestId`) might.
- **Plans:** no engine seam exists. Either the engine gains a plans protocol and routes, or the app talks to the provider directly.

---

## 4. Capability matrix

"Batteries (today)" means Batteries as wired into the engine now, with the engine's own records noted where they fill a gap. "PymtHouse" means as publicly documented, untested. "Neither" means the app must supply it, or mock it.

| Capability | Batteries (today) | PymtHouse (as documented) | Neither |
| --- | --- | --- | --- |
| **Sign-in** | None. The engine accepts `lpk_` keys, or JWTs from any external OIDC issuer (`LPB_AUTH=jwt`) | OIDC issuer: authorization code + PKCE, device flow, refresh, logout | The login UI and session cookie in this app |
| **White-label sign-in** | None | Claimed on the homepage; configuration not documented | Branding of this app's own screens |
| **Users** | None in Batteries. Engine: actors (`lpb_actors`) and JWT sightings; no email or profile | Upsert, list, deactivate by `externalUserId`; email | Roles (user vs operator), profile, preferences, suspension reason |
| **Roles and permissions** | Engine credential kinds `actor`, `admin`, `auditor`; per-key permissions | Scopes only; `admin` scope exists but no role claim documented | Operator vs user role mapping |
| **Grants (funded pools)** | Yes: create, fund, status, list. Through the engine: list, create, fund | No equivalent pool. Nearest: owner wallet (prepaid credits) | Per-grant allocated and spent totals (not in the engine's `GrantRecord`) |
| **Allocations and balances** | Yes: per-actor allocation with `granted`, `spent`, `available`; pause, revoke | Per-user allowance: `balanceUsdMicros`, `consumedUsdMicros`, `lifetimeGrantedUsdMicros`; `hasAccess` gate | |
| **One-off top-up (credit pack)** | Yes: `POST …/allocation/fund` (bookkeeping only) | Yes: allowance grant with a `source` (bookkeeping only) | The sale itself: price, checkout, receipt |
| **Top-up history** | No API (ledger transactions not exposed) | Yes: `allowances.grants[]` | |
| **API keys for users** | Engine `lpk_` keys: issue, list, rotate, revoke. Batteries `lpg_` keys stay inside the engine | Per-user `pmth_*` keys: create, list, revoke | |
| **Plan definitions** | None | Yes: `free`, `subscription`, `usage`; price, included allowance, overage, per-capability bundles. Mutations need a dashboard session | Credit-pack catalogue |
| **Plan allowances** | None (an allocation has a time window but no recurring reset) | Yes: `includedUsdMicros` per plan; Starter plan allowance for every new user | |
| **Plan assignment** | None | Yes: auto-Starter on provision; `subscription/change`; read subscription | |
| **Markup / retail price** | None. The engine refuses to hold retail prices | Yes: plan `overageRateUsd`, per-capability `retailRateUsd`; `include=retail` usage estimates | Markup rules when on Batteries; per-capability enable and price in the console |
| **Usage metering** | Yes: per-ticket usage rows; engine classifies cost per job, attempt, app and actor | Yes: OpenMeter aggregates by user, pipeline/model, day; per-request history for end users | Retail revenue per job when on Batteries |
| **Reconciliation** | Yes: engine vs provider `spent`; Batteries on-chain settlement matching | Not documented | |
| **Hard spending limit** | No (balance can overshoot) | `hasAccess` gate and a "soft-negative debt ceiling" | |
| **End-user payment collection** | None | Stripe Connect "merchant" mode: checkout, cards, invoices. Live status unverified | Anything on Batteries; credit-pack checkout on either |
| **Operator pays the platform** | Operator funds the signer wallet in ETH on-chain, outside any API | Owner wallet top-up, auto-debit card, owner subscription tiers | |
| **Invoices** | None | Owner and end-user invoice lists; Stripe-hosted invoice URL | |
| **Refunds and manual adjustments** | Adjust up only (fund). No refund, no debit adjustment | Adjust up only (allowance grant). Refunds not documented | Refunds, negative adjustments |
| **Failed payments** | n/a | Denial codes and billing `state`; no dunning API documented | Failed-payment handling UI |
| **Tax** | None | Not documented | All of it |
| **Currency** | USD or ETH per grant, fixed; 18 decimals | USD (micros) for balances and prices; wei for network fees | Multi-currency display, FX |
| **Tenants** | None (credentials are global) | Each app is a tenant with its own clients, users, plans and billing | |

---

## 5. Proposed provider-neutral interface (PROPOSAL, not implemented anywhere)

This is a sketch for discussion. It is not in the engine, the console or PymtHouse.

**Rules it follows**

- Engine terms: grant, allocation, usage, plan. PymtHouse's per-user "grant" is called a **top-up** here to avoid the clash.
- Types that the engine already returns keep the engine's exact field names and string-decimal amounts, so the live implementation is a pass-through and the mock must match it.
- A user is an engine actor: `(application_id, actor_id)`.
- A user's credit balance is their allocation balance. A credit pack is a one-off allocation top-up. A plan is the provider's plan. A retail price is a markup rule that converts wholesale cost into credits charged.
- Each method is marked **LIVE** (an engine endpoint that works today, and the credential it needs) or **MOCK** (returns data shaped on PymtHouse's documented API until that provider is connected).

```ts
// ---------- shared ----------
type Decimal = string;                       // exact decimal; may be scientific notation ("4.7E-8")
type Currency = "USD" | "ETH";
interface Money { amount: Decimal; currency: Currency }            // engine Money, verbatim
type AllocationStatus = "active" | "paused" | "exhausted" | "revoked";
type CostClass = "delivered" | "failed_after_payment" | "uncertain" | "pending";
interface Fees { fee_eth: Decimal; fee_usd: Decimal | null; row_count: number }
interface UserRef { application_id: string; actor_id: string }

/** What the connected provider can do, so the UI can hide or label what it cannot. */
interface ProviderInfo {
  id: "batteries" | "pymthouse" | "mock";
  supports: {
    oidc_sign_in: boolean; white_label_sign_in: boolean;
    grants: boolean; allocation_pause: boolean; top_up_history: boolean;
    plans: boolean; plan_mutation: boolean; markup_rules: boolean;
    end_user_payments: boolean; invoices: boolean;
  };
}

// ---------- identity: sign-in and users ----------
interface SignInConfig {
  issuer: string; client_id: string; scopes: string[];
  authorization_endpoint: string; token_endpoint: string;
  end_session_endpoint: string | null; jwks_uri: string;
}
interface User extends UserRef {                 // engine KnownActor, verbatim
  label: string; name: string | null;
  allocation: Allocation | null; provisioned: boolean;
  first_seen_at: string | null; last_seen_at: string | null;
}
interface AccessKey {                            // engine AccessKey, verbatim
  key_id: string; kind: "actor" | "admin" | "auditor" | "service";
  actor_id: string; application_id: string; permissions: string[];
  label: string; created_at: string; revoked_at: string | null;
}
interface IssuedKey { key: AccessKey; token: string | null; replayed: boolean }

interface IdentityProvider {
  getSignInConfig(): Promise<SignInConfig>;
  getCurrentUser(): Promise<User & { role: "user" | "operator" }>;
  listUsers(q?: { application_id?: string; status?: AllocationStatus; provisioned?: boolean; limit?: number }): Promise<User[]>;
  getUser(user: UserRef): Promise<User>;
  provisionUser(input: UserRef & { label?: string; grant_id?: string; amount: Money; operation_ref: string }): Promise<{ user: User; key: IssuedKey }>;
  setUserStatus(user: UserRef, status: "active" | "paused"): Promise<User>;
  listKeys(q?: { application_id?: string }): Promise<AccessKey[]>;
  issueKey(input: UserRef & { label?: string; permissions?: string[]; operation_ref: string }): Promise<IssuedKey>;
  rotateKey(key_id: string, input: { label?: string; operation_ref: string }): Promise<IssuedKey>;
  revokeKey(key_id: string): Promise<void>;
}

// ---------- budgets: grants, allocations, balances ----------
interface Grant {                                // engine GrantRecord, verbatim
  id: string; name: string; status: string; currency: string; total: Decimal;
  metadata: Record<string, string>;
}
interface Allocation extends UserRef {           // engine ProvisionedActor, verbatim
  grant_id: string; allocation_id: string; api_key_id: string;
  secret_ref: { ref: string }; currency: Currency; status: AllocationStatus;
  created_at: string; updated_at: string; label: string;
}
interface Balance {                              // engine Allowance, verbatim
  allocation_id: string; status: string;
  granted: Money | null; spent: Money | null; available: Money | null;   // available may be negative
}
interface TopUp { id: string; amount: Money; source: "manual" | "trial" | "promo" | "plan_adjustment" | "credit_pack"; created_at: string }

interface BudgetsProvider {
  listGrants(): Promise<Grant[]>;
  createGrant(input: { name: string; amount: Money; operation_ref: string }): Promise<Grant>;
  fundGrant(input: { grant_id?: string; amount: Money; operation_ref: string }): Promise<void>;
  getAllocation(user: UserRef): Promise<Allocation>;
  getBalance(user?: UserRef): Promise<Balance>;                       // omitted: the caller's own
  topUpAllocation(user: UserRef, input: { amount: Money; operation_ref: string }): Promise<Allocation>;  // a credit pack lands here
  revokeAllocation(user: UserRef): Promise<Allocation>;
  rotatePaymentKey(user: UserRef, input: { operation_ref: string }): Promise<Allocation>;
  listTopUps(user: UserRef): Promise<TopUp[]>;
}

// ---------- plans: definitions, allowances, assignment, markup ----------
interface MarkupRule {
  /** Retail USD charged per 1 USD of wholesale network cost. "1.5" is a 50% markup. */
  retail_per_wholesale: Decimal;
  per_capability: { app: string; model: string | null; retail_per_wholesale: Decimal }[];
}
interface Plan {
  id: string; name: string;
  type: "free" | "subscription" | "usage";
  status: "active" | "inactive";
  price: Money;                                  // PymtHouse priceAmount + priceCurrency
  billing_cycle: "monthly";
  included_allowance: Money | null;              // PymtHouse includedUsdMicros
  charge_threshold: Money | null;                // PymtHouse chargeThresholdUsd (type "usage")
  markup: MarkupRule;                            // PymtHouse overageRateUsd + capabilities[].retailRateUsd
  is_starter_default: boolean;
}
interface Subscription extends UserRef {
  plan_id: string; status: string;
  current_period_start: string; current_period_end: string;
}
interface CreditPack { id: string; name: string; price: Money; allocation_amount: Money; credits: Decimal }

interface PlansProvider {
  listPlans(): Promise<Plan[]>;
  createPlan(input: Omit<Plan, "id">): Promise<Plan>;
  updatePlan(id: string, patch: Partial<Omit<Plan, "id">>): Promise<Plan>;
  deletePlan(id: string): Promise<void>;
  getSubscription(user: UserRef): Promise<Subscription | null>;
  assignPlan(user: UserRef, plan_id: string): Promise<Subscription | { checkout_url: string }>;
  getMarkupRules(): Promise<MarkupRule>;
  setMarkupRules(rules: MarkupRule): Promise<MarkupRule>;
  listCreditPacks(): Promise<CreditPack[]>;
  saveCreditPack(pack: CreditPack): Promise<CreditPack>;
}

// ---------- usage ----------
interface UsageSummary {                         // engine CostSummary, verbatim
  start: string; end: string;
  by_class: Record<CostClass, Fees>;
  jobs_with_cost: number; jobs_pending: number;
  by_app: Record<string, Partial<Record<CostClass, Fees>>>;
}
interface JobCost {                              // engine JobCost, verbatim
  job_id: string; status: "none" | "pending" | "observed" | "corrected";
  fees: Fees; billable: Fees;
  attempts: { attempt_number: number; cost_class: CostClass; fees: Fees }[];
  first_observed_at: string | null; updated_at: string | null;
}
interface Reconciliation {                       // engine Reconciliation, verbatim
  application_id: string; actor_id: string | null; allocation_id: string;
  provider_spent: Money | null; by_class: Record<CostClass, Fees>;
  unattributed: Fees; balanced: boolean | null;
}
interface UserUsage extends UserRef { request_count: number; wholesale: Fees; retail: Money | null }

interface UsageProvider {
  getSummary(q?: { start?: string; end?: string; actor_id?: string }): Promise<UsageSummary>;
  listJobCosts(q?: { limit?: number }): Promise<JobCost[]>;
  getJobCost(job_id: string): Promise<JobCost>;
  getReconciliation(user: UserRef): Promise<Reconciliation>;
  listUsageByUser(q?: { start?: string; end?: string }): Promise<UserUsage[]>;
  getRetailCharge(job_id: string): Promise<{ wholesale: Fees; credits_charged: Decimal; rule: MarkupRule }>;
  syncNow(): Promise<{ pages: number; rows_seen: number; rows_new: number; jobs_updated: number }>;
}
```

### Backing for each method

| Method | Today | Endpoint, or the PymtHouse shape the mock copies |
| --- | --- | --- |
| **Identity** | | |
| `getSignInConfig` | MOCK | PymtHouse discovery document (`issuer`, `authorization_endpoint`, …). Could also be live for any OIDC issuer once `LPB_AUTH=jwt` is set |
| `getCurrentUser` | MOCK | No engine "who am I" route (gap G13). Role comes from this app's session |
| `listUsers` | LIVE, reader | `GET /v1/admin/actors` |
| `getUser` | LIVE, reader | `GET /v1/admin/actors` filtered, or `GET /v1/admin/applications/{app}/actors/{actor}/allocation` |
| `provisionUser` | LIVE, admin | `POST /v1/admin/keys` then `POST /v1/admin/applications/{app}/actors/{actor}/allocation` |
| `setUserStatus` | LIVE, admin | `POST …/allocation/status`. No PymtHouse equivalent (it has user `active`/`inactive`) |
| `listKeys` | LIVE, reader | `GET /v1/admin/keys` |
| `issueKey`, `rotateKey`, `revokeKey` | LIVE, admin | `POST /v1/admin/keys`, `…/{key_id}/rotate`, `…/{key_id}/revoke` |
| **Budgets** | | |
| `listGrants` | LIVE, **admin** | `GET /v1/admin/grants` (the reader token gets 403) |
| `createGrant` | LIVE, admin | `POST /v1/admin/grants` |
| `fundGrant` | LIVE, admin | `POST /v1/admin/grant/fund` |
| `getAllocation` | LIVE, reader | `GET /v1/admin/applications/{app}/actors/{actor}/allocation` |
| `getBalance` | LIVE, builder key for own; reader for any | `GET /v1/allowance[?actor_id=]` |
| `topUpAllocation` | LIVE, admin | `POST …/allocation/fund` |
| `revokeAllocation` | LIVE, admin | `POST …/allocation/revoke` |
| `rotatePaymentKey` | LIVE, admin | `POST …/allocation/rotate-key` |
| `listTopUps` | MOCK | PymtHouse `GET …/users/{externalUserId}/allowances` → `grants[]` |
| **Plans** | | |
| `listPlans` | MOCK | PymtHouse `GET /api/v1/apps/{clientId}/plans` |
| `createPlan`, `updatePlan`, `deletePlan` | MOCK | PymtHouse `POST/PUT/DELETE …/plans` (dashboard session only today) |
| `getSubscription` | MOCK | PymtHouse `GET …/users/{externalUserId}/subscription` |
| `assignPlan` | MOCK | PymtHouse `POST …/users/{externalUserId}/subscription/change` |
| `getMarkupRules`, `setMarkupRules` | MOCK | PymtHouse plan `overageRateUsd` and `capabilities[].retailRateUsd`. On Batteries this is instance config, held by neither provider |
| `listCreditPacks`, `saveCreditPack` | MOCK | Neither provider has a pack catalogue; instance config |
| **Usage** | | |
| `getSummary` | LIVE, builder key for own; reader for the application | `GET /v1/costs/summary` |
| `listJobCosts` | LIVE | `GET /v1/costs/projections` (25 newest, no paging: gap G3) |
| `getJobCost` | LIVE | `GET /v1/jobs/{job_id}/cost` |
| `getReconciliation` | LIVE, reader | `GET /v1/admin/reconciliation?application_id=&actor_id=` |
| `listUsageByUser` | LIVE by fan-out, else MOCK | One `GET /v1/costs/summary?actor_id=` per actor today. PymtHouse shape: `usage?groupBy=user` |
| `getRetailCharge` | MOCK | Computed from `JobCost.billable` and the markup rule. PymtHouse shape: `endUserBillableUsdMicros` |
| `syncNow` | LIVE, admin | `POST /v1/admin/costs/sync` |

### PymtHouse field mapping for the adapter

| Proposed field | Engine today | PymtHouse (documented) |
| --- | --- | --- |
| `UserRef.actor_id` | `actor_id` | `externalUserId` (path) or JWT `sub` (internal ID). **These differ.** |
| `UserRef.application_id` | `application_id` | `clientId` (`app_…`) |
| `Balance.available` | `Allowance.available` | `balanceUsdMicros` ÷ 10^6, USD |
| `Balance.spent` | `Allowance.spent` | `consumedUsdMicros` ÷ 10^6 ("this period") |
| `Balance.granted` | `Allowance.granted` | `lifetimeGrantedUsdMicros` ÷ 10^6 |
| `TopUp` | none | `grants[]` item: `id`, `amountUsdMicros`, `source`, `createdAt` |
| `Plan.included_allowance` | none | `includedUsdMicros` |
| `MarkupRule.retail_per_wholesale` | none | `overageRateUsd` × 10^6 |
| `Fees.fee_usd` | `fee_usd` | `networkFeeUsdMicros` ÷ 10^6 |
| `Fees.fee_eth` | `fee_eth` | `totalFeeWei` ÷ 10^18 |

---

## 6. Units and money

| | Network | Batteries | Engine | PymtHouse (documented) |
| --- | --- | --- | --- | --- |
| Base unit paid | wei (ETH on Arbitrum One), as probabilistic tickets | | | |
| What a "credit" is | n/a | One unit of an allocation's currency: **1 USD or 1 ETH**. "Grants provide usage credits" (README) | No credit concept: `Money` in USD or ETH | A USD balance: allowance in **USD micros**; owner wallet "prepaid credits" in USD |
| Currencies | ETH | `usd` or `eth` per grant, fixed at creation; allocations inherit | `USD` or `ETH`; default `LPB_DEFAULT_CURRENCY=USD` | USD for balances and plan prices; wei for network fees |
| Storage precision | wei | Integer at 10^18 scale for both currencies | Decimal strings | Integer strings: micros (10^-6 USD) and wei |
| API format | | Decimal string, up to 18 fractional digits (`"0.025886863010155183"`) | `{"amount": "<decimal>", "currency": "USD"}`; fees as `fee_eth`, `fee_usd` strings, sometimes scientific notation | `"4200000"` = $4.20; `*Wei` strings; plan `priceAmount` like `"49.00"` |
| Wei → USD | | Uses the `computed_fee_usd` the **signer** attached to each ticket event. A USD allocation with no USD fee on the event is quarantined, not charged | Passes Batteries' figures through; never converts. `fee_usd` is `null` if any row lacks a USD price | Converted once at signing time with an ETH/USD oracle and stored; `GET /api/v1/prices/eth-usd` exists |
| What a balance decreases by | | **Wholesale** network fee | Reports wholesale only | Network fee in USD micros; retail applied through plan rate cards (my reading; not stated outright) |
| Platform fee | | None | None | `platformCutPercent`, `platformFeeWei` on top of network fee |
| Negative balances | | Possible (no reservation) | `available` may be negative | "Soft-negative debt ceiling" |

**How wholesale cost relates to credits**

- The signer signs tickets in wei up to a ceiling of the advertised rate plus 1.2% (`docs/contracts/payments.md`, "Pricing assumptions"). The cost recorded is the tickets' expected value at signing, not the on-chain settlement.
- On a USD grant, the allocation falls by exactly the USD value of those tickets. With Batteries, **one "credit" of allocation is one wholesale dollar.** There is nowhere in Batteries or the engine to apply a markup.
- The allocation is debited for every paid attempt, including `failed_after_payment`. The engine's `billable` figure counts only `delivered` attempts. The two differ, as the live data shows.
- So "balance = allocation balance" and "retail price = markup rule" only fit together without a second ledger if the markup is **uniform**: sell a pack for retail price P, fund the allocation with P ÷ markup, and display `credits = available × markup × credits_per_usd`. Per-capability markups cannot be read back from one wholesale balance. PymtHouse's rate cards are designed for that case.
- On an ETH grant the balance is in ETH and USD display needs a rate the engine does not provide. Recommend USD grants only for this app.
- Displayed amounts are small. A realistic job here cost $0.0001 to $0.02 wholesale. A credit unit worth well under a cent, or several decimal places, is needed.

---

## 7. Open questions for the builder track

The three the brief requires:

1. **Should the app read usage through the engine or from the payment provider directly?** The console does both: engine for per-job cost, Batteries directly (read-only token) for grants, allocations, sessions, usage, ledger and escrow. Engine-only keeps the UI provider-neutral but loses grant balances, sessions, escrow and settlement. With PymtHouse, per-user and per-model aggregates and retail estimates exist only in its own Usage API.
2. **Does the provider or the app collect payment from end users?** Batteries collects nothing. PymtHouse documents Stripe Connect checkout for plans but not a paid one-off credit pack, and its live-charging status is unverified. Who is merchant of record, and who handles refunds and tax?
3. **Are attested secure-hardware operators planned?** No reference repository mentions TEE or attested operators. The only nearby text is `live-runner-standard/SPEC.md`, which lists "attested evidence" as a possible future form of runner conformance. Nothing in discovery output marks an operator as attested.

Others found during this research:

4. **How will PymtHouse connect to the engine?** As an `AllocationManager` and `UsageSource` implementation inside the engine, as a replacement signer and identity issuer beside it, or as a service the app calls directly? No code or document says. Which engine commit will carry it?
5. **Plans have no engine seam.** Will the engine gain a plans protocol and `/v1/admin/plans` routes, or is the app expected to hold a second provider client for plans? The second breaks "don't couple the UI to one provider" unless the app owns the abstraction in section 5.
6. **Plan mutation needs a PymtHouse dashboard session.** Can plan create, update, delete and Starter-allowance changes be opened to M2M credentials so an operator console and agents can use them?
7. **Balance versus retail.** Is a user's balance wholesale-denominated (as in Batteries) or retail-denominated? Where is a per-capability markup applied without a second ledger? Is a uniform markup acceptable for the Batteries path?
8. **Who absorbs `failed_after_payment` cost?** The user's allocation is debited for failed paid attempts. Should the operator credit it back with a top-up, and should that be automatic?
9. **Overshoot.** Balances can go negative on Batteries. Should the UI show negative balances, and should the app add its own pre-flight check?
10. **Actor identity under PymtHouse.** The engine keys money and history on `actor_id` = JWT `sub`. PymtHouse's `sub` is its internal user ID, while its management API is keyed by `externalUserId`. Which is the actor, and who keeps the mapping?
11. **JWT compatibility.** Does PymtHouse issue RFC 9068 `at+jwt` access tokens with `aud` set to the engine, `client_id`, `jti` and `iat`? If not, the engine needs its weaker token-type opt-out. Which claim carries a display name, and which marks an operator?
12. **White-label sign-in.** What can an instance operator configure (logo, colours, domain, copy), and is it an API or dashboard-only?
13. **Sign-up provisioning.** The engine never provisions automatically, and PymtHouse auto-subscribes new users to a Starter plan. Is the app expected to call provision with the admin token at sign-up, with which grant and what starting amount?
14. **Grant detail.** `GrantRecord` has no unallocated, allocated or spent total, and the engine cannot list a grant's allocations. The console's Grants view needs them. Engine request, or direct Batteries read?
15. **Top-up and adjustment history.** Batteries exposes balances but not ledger transactions; the engine exposes neither. Where does "payments, refunds and manual credit adjustments" history come from on the Batteries path?
16. **Cached allocation status.** The engine's actor record does not learn that Batteries exhausted an allocation. Should the engine refresh it, or should the UI always read `GET /v1/allowance`?
17. **Multi-tenancy.** Batteries management credentials span every grant ("Mode B" gap). Is the hosted instance one Batteries per instance, and is PymtHouse the answer for shared hosting?
18. **Admin read scope.** The reader (auditor) token is bound to one application and cannot list grants. Should grants be readable by an auditor, so the Grants view does not need the admin token for a read?
19. **Decimal format.** Engine decimals arrive as strings, sometimes in scientific notation, with up to 18 fractional digits. Is that stable, and will PymtHouse-backed figures arrive as engine `Money` or as micros?
20. **The `.env` admin token.** `ENGINE_ADMIN_TOKEN` is an actor key for `acme-studio`, not an admin credential. Is that intended? Admin routes cannot be exercised, even read-only, until it is replaced.
21. **PymtHouse licence and self-hosting.** The repository has no licence set. Its README documents deploying your own copy (Next.js app, PostgreSQL, OpenMeter and a signer), but that is a multi-service stack, not a single container. Can a self-hosted livepeer instance bundle or depend on it, and under what terms?
22. **Platform fee.** PymtHouse reports a platform cut on network fees. What is the rate, and does it apply to self-hosted instances?

---

## What could not be verified

- `GET /v1/admin/grants` live shape (no admin credential). The schema comes from the live OpenAPI document and the adapter code.
- Any PymtHouse behaviour: no account, no authenticated call. Response shapes for user list, subscription read and plan change are not documented.
- Whether PymtHouse charges real money today.
- How PymtHouse configures white-label sign-in.
- Any engine-side PymtHouse integration: none exists in the code read.
- The docs site's bundled `api-reference/openapi.json` is a documentation-template placeholder, not PymtHouse's API. The real specification is served at https://pymthouse.com/api/v1/openapi.json.

## Sources

- Batteries: `README.md`, `API.md`, `SECURITY.md`, `creds.example.toml`, `config.example.toml`, `migrations/001_initial.sql`–`004`, `internal/app/management.go`, `internal/app/pagination.go`, `internal/app/presentation.go`, `internal/auth/http.go`, `internal/serviceauth/registry.go`, `internal/store/{manage,auth,ingest,store,settlements}.go`, `internal/units/eth.go`, `examples/compose/`.
- Engine: `src/livepeer_builder/protocols/__init__.py`, `adapters/{batteries,auth,jwt,secrets}.py`, `contracts/{payments,costs,access,common}.py`, `services/{payments,grants,ledger,costs,keys,policy}.py`, `http/{app,bodies}.py`, `runtime/assembly.py`, `config.py`, `docs/contracts/{payments,access}.md`, `docs/references/batteries-api.md`, `docs/design-docs/m4-guides/iss-31-payment-configurations.md`, `docs/design-docs/extending-the-engine.md`, `docs/product-specs/build-track-baseline.md`.
- Console: `web/src/adapters/batteries/reader.ts`, `web/src/domain/gaps.ts`, `deploy/compose.yaml`.
- Node: `docs/signer.md`, `docs/http-api.md`.
- PymtHouse: https://pymthouse.com · https://docs.pymthouse.com/llms.txt · https://docs.pymthouse.com/api-reference/introduction.md · https://docs.pymthouse.com/integration/client-model.md · https://docs.pymthouse.com/integration/interactive-login.md · https://docs.pymthouse.com/integration/user-management.md · https://docs.pymthouse.com/integration/user-tokens.md · https://docs.pymthouse.com/integration/allowances.md · https://docs.pymthouse.com/integration/plans.md · https://docs.pymthouse.com/integration/usage-api.md · https://docs.pymthouse.com/integration/billing.md · https://docs.pymthouse.com/integration/payments.md · https://docs.pymthouse.com/integration/signer-routing.md · https://pymthouse.com/api/v1/openapi.json · https://pymthouse.com/api/v1/oidc/.well-known/openid-configuration · https://github.com/pymthouse/pymthouse
