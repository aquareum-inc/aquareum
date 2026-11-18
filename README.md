# Aquareum

The open-source video platform you own.

Run a video business on the Livepeer Network, whether you're a creator with a few customers or a company
serving thousands and their agents. Aquareum brings the product, the billing and the console; Livepeer's open
market of GPUs brings the compute, paid per job.

- **Yours to run:** your name, branding, prices, users and rules, in one config file. MIT-licensed, so no one
  can switch it off for you.
- **A console for the business:** offer the network's capabilities, set prices, sell plans and credits,
  manage users, take payments, and see your margin job by job.
- **Your choice of front door:** a complete app for making and understanding video, an API and MCP server for
  products and agents, or both.
- **Simple economics:** customers pay you in credits; you pay the network its wholesale cost; the markup is
  yours.

Run it yourself with one command, or have it hosted.

## This repository

The user app, the operator console, the instance API and MCP server, and the bundle that starts them with a
pinned engine. Each surface can be switched on or off in the instance config, so an instance can run the
console and API without the app, or the API alone. The engine
([livepeer-builder-core](https://github.com/NE-Build-Track/livepeer-builder-core)) is a separate service
reached over its REST API.

## Quick start

You need Docker with the Compose plugin and Node 22.

```bash
./aquareum setup --preset full
```

That writes `.env` (with a generated session secret) and `instance.config.json`, builds and starts the app,
and waits for its health check. With no engine keys it starts in **mock-only mode**, where every function
returns realistic mocked data, so a first run needs nothing else. Open the URL it prints.

To connect a real engine, set `ENGINE_URL`, `ENGINE_READER_TOKEN` and `ENGINE_ADMIN_TOKEN` in `.env` and run
`./aquareum setup` again. To start the engine, payment provider and signer from the same bundle, see
[deploy/README.md](deploy/README.md).

```bash
./aquareum doctor      # checks config, keys, engine and provider, and says what to fix
./aquareum upgrade     # moves the app and its pinned engine to this checkout's release
```

Agents: see [AGENTS.md](AGENTS.md) for exact commands, expected output and failure fixes.

## Development

```bash
corepack pnpm install
corepack pnpm dev            # http://localhost:3100, reads the root .env
MOCK_ONLY=1 corepack pnpm dev
corepack pnpm test           # runs every package's tests
corepack pnpm typecheck
```

In development a small badge on each screen says whether its data is live or mocked, and a role switch flips
between the user and operator roles. Neither is ever shown to end users.

## Folder structure

```
apps/web                  Next.js host: routes, sessions, role guard, /api/v1, /api/mcp, /api/health
packages/api-client       Types and one function per operation (live + mock), data-source map
packages/config           Instance config schema, generated types, presets, capability and surface rules
packages/ui               Theme tokens, primitives, motion
packages/user-app         User-app screens
packages/operator-console Operator console screens
packages/cli              aquareum setup | doctor | upgrade
deploy/                   Compose bundle and deploy templates
docs/                     Brief, research, design brief, route map, architecture, data sources
release.config.json       The GitHub organisation, registry and pinned engine/provider/signer versions
```

## Instance config and presets

An instance is one file, `instance.config.json`, validated against
[`packages/config/schema/instance.schema.json`](packages/config/schema/instance.schema.json), plus
environment variables for secrets (see [.env.example](.env.example)). It covers the name, logo and colours,
the engine URL, which surfaces are served (user app, operator console, API, MCP), capability allow and block
rules, the auth and payment provider, pricing markup and content policy.

Two presets ship in `packages/config/presets/`:

| Preset | Serves |
|--------|--------|
| `full` | User app, operator console, API and MCP |
| `headless` | Operator console, API and MCP: no customer-facing app, as with a headless CMS |

Which capabilities an instance offers is separate from the preset. For example, a headless instance that
starts with transcoding only:

```json
{ "capabilities": { "allow": ["*transcode*"], "block": [] } }
```

## Switching a function from mock to live

Every API function has a live and a mock implementation behind one signature.
[`packages/api-client/src/data-sources.ts`](packages/api-client/src/data-sources.ts) decides which is used.

1. Implement the live call in `packages/api-client/src/live/`.
2. Branch on `resolveSource("<name>", env)` in `packages/api-client/src/index.ts`.
3. Set the function to `"live"` in `data-sources.ts`.
4. Update [docs/data-sources.md](docs/data-sources.md).

`MOCK_ONLY=1` forces every function to its mock, for tests, CI, demos and first runs.

## Licence

MIT.
