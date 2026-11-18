# AGENTS.md

How to install, configure and verify an instance unattended. Every command is non-interactive.

## Requirements

- Docker with the Compose plugin (`docker compose version` exits 0)
- Node 22 or later (`node --version`)
- A checkout of this repository; run commands from its root

## Install

```bash
./aquareum setup --preset full --json
```

Expected: exit code 0 and one JSON line on stdout:

```json
{"ok":true,"dir":"…","preset":"full","config":"written","env":["SESSION_SECRET","…"],"mode":"mock-only","url":"http://localhost:3000","started":true,"health":{"status":"ok","instance":"Livepeer","mode":"mock-only","surfaces":{"app":true,"console":true,"api":true,"mcp":true},"engine":"skipped"}}
```

The first run builds the image and takes a few minutes. Running it again is safe: existing values in `.env`
and an existing `instance.config.json` are kept (`"config":"kept"`, `"env":[]`).

| Flag | Effect |
|------|--------|
| `--preset full\|headless` | Preset to start from. `headless` serves the operator console, API and MCP, with no customer-facing app (as with a headless CMS). |
| `--config <file>` | Use this instance config instead of a preset. |
| `--mock-only` | Run without engine keys. This is also the default when `ENGINE_URL` is empty. |
| `--network` | Also start the engine, payment provider and signer (needs keys, see `deploy/README.md`). |
| `--no-start` | Write files only; don't start containers. |
| `--port <n>` | Host port for the app (default 3000). |
| `--dir <path>` | Instance directory holding `.env` and `instance.config.json` (default: repository root). |
| `--json` | One JSON line on stdout; errors as `{"ok":false,"error":"…","exitCode":n}`. |

## Verify

```bash
curl -fsS http://localhost:3000/api/health
./aquareum doctor --json
```

`/api/health` answers 200 with `{"status":"ok",…}`, or 503 with `"status":"degraded"` when the engine is
configured but unreachable. `doctor` exits 0 when every check passes and 1 otherwise; each failed check
carries a `fix`.

## Configure

- Config file: `instance.config.json`. Schema: `packages/config/schema/instance.schema.json`.
  Presets: `packages/config/presets/full.json`, `headless.json`.
- Secrets and the engine URL: `.env` (never committed). Every variable is described in `.env.example`.
- Connect a real engine: set `ENGINE_URL`, `ENGINE_READER_TOKEN` (an auditor key) and `ENGINE_ADMIN_TOKEN`
  (an admin key) in `.env`, then run `./aquareum setup` again. `MOCK_ONLY` is cleared automatically.
- Restart after editing either file: `./aquareum setup`.

## Upgrade

```bash
git pull && ./aquareum upgrade --json
```

The engine version is pinned per release in `release.config.json`, so the app and engine move together.

## Exit codes

| Code | Meaning | Fix |
|------|---------|-----|
| 0 | Success | — |
| 1 | `doctor` found problems | Apply each check's `fix`, run `doctor` again |
| 2 | Bad usage | Check flags with `./aquareum --help` |
| 3 | Invalid instance config | The error lists each field; compare with the schema |
| 4 | Docker unavailable | Install or start Docker, or pass `--no-start` |
| 5 | `docker compose up` failed | Read the last line of the error; commonly the port is in use: pass `--port` |
| 6 | Health check did not pass in 120s | `docker logs aquareum-app-1`, then `./aquareum doctor` |

## Common failures

- **Port already in use** (exit 5): `./aquareum setup --port 3210`.
- **`admin token … refused (HTTP 403)`** in `doctor`: `ENGINE_ADMIN_TOKEN` is an actor (builder) key, not an
  admin key. Issue an admin key on the engine.
- **`engine … not ready`**: the engine isn't reachable at `ENGINE_URL` from where the app runs. Inside the
  bundle the engine is `http://engine:8080`; from the host it is `http://127.0.0.1:8090`.
- **Health is 500 right after changing config**: the config is invalid. Run `./aquareum doctor`.

## Working on the code

```bash
corepack pnpm install
corepack pnpm typecheck && corepack pnpm test
MOCK_ONLY=1 corepack pnpm build
```

Standing rules for changes are in `CLAUDE.md`; plans and research are in `docs/`.

## Using and administering an instance as an agent

Everything the interface can do is in the API, and the same operations are MCP tools.

- Index of operations, no key needed: `GET /api/v1`
- REST: `/api/v1/*` with `Authorization: Bearer <API key>` (create a key under Developers ▸ Keys)
- MCP (streamable HTTP): `POST /api/mcp` with the same bearer token
- Operator operations (`/api/v1/operator/*`, and the `operator_*` tools): set `OPERATOR_API_TOKEN` in `.env`
  and send it as the bearer token. With it an agent can list users and jobs, suspend or top up a user, assign
  plans, create grants and change capability settings without the console.

```bash
curl -fsS http://localhost:3000/api/v1/offerings -H "Authorization: Bearer $API_KEY"
curl -fsS http://localhost:3000/api/v1/operator/overview -H "Authorization: Bearer $OPERATOR_API_TOKEN"
```
