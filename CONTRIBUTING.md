# Contributing

## Pull request titles

Pull requests are squash-merged: the title becomes the commit on `main`, and release notes are built from those
commits. So every title follows [Conventional Commits](https://www.conventionalcommits.org):

```
type(scope): what changed
```

- Lower-case after the colon, in the imperative, with no full stop: `feat(studio): hide modes the instance
  doesn't offer`.
- The scope is optional; use one when the change sits in one area.
- A `!` after the type or scope marks a breaking change, one an operator has to act on when upgrading:
  `refactor!: rename the project to Livepeer`. Say what to do in the description.
- Commits inside a branch have no rule; only the title reaches `main`.

A check on every pull request (`.github/workflows/pr-title.yml`) fails a title that doesn't follow this.

### Types

| Type | For |
|---|---|
| `feat` | Something new a person, operator or agent can do |
| `fix` | Something that was broken now works |
| `perf` | Faster, with no change in behaviour |
| `refactor` | Code changes with no change in behaviour |
| `test` | Tests only |
| `docs` | Documentation only |
| `ci` | Workflows and checks |
| `build` | Dependencies, packaging, images |
| `chore` | Anything else that doesn't change the product |
| `revert` | Undoes an earlier change |

### Scopes

| Scope | Area |
|---|---|
| `web` | The user app on the web (`apps/web`, `packages/user-app`) |
| `console` | The operator console (`packages/operator-console`, `/operator`) |
| `api` | The API client, the public `/api/v1` and MCP |
| `config` | The instance config, its schema and presets |
| `ios` | The iOS app |
| `android` | The Android app |
| `mobile` | Both apps, or what they share (code generation, the mobile plan) |
| `cli` | The `./livepeer` command |
| `deploy` | Docker Compose, images and self-hosting |
| `engine` | The pinned engine, provider and signer, and requests upstream |
| `design` | Tokens and shared components |
