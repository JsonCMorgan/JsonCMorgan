# Contributing to PenTrace

Thanks for helping build the rig. This page covers setup, the checks CI runs, how commits and releases work, and where things live.

## Setup

Needs Node.js 22 (see `.nvmrc`). For the desktop app you also need Rust stable and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
cd pentrace
npm ci
npm run dev          # browser build at http://127.0.0.1:1420
npm run tauri:dev    # desktop app with hot reload
```

## Before you push

```bash
npm run check        # lint + format check + typecheck + tests with coverage
npm run build        # production web build
```

| Script                            | What it does                                                |
| --------------------------------- | ----------------------------------------------------------- |
| `npm run lint` / `lint:fix`       | ESLint (typescript-eslint), zero warnings allowed           |
| `npm run format` / `format:check` | Prettier                                                    |
| `npm run typecheck`               | TypeScript 7 (`@typescript/native`) with `--noEmit`         |
| `npm test` / `test:watch`         | Vitest unit tests                                           |
| `npm run test:coverage`           | Tests plus V8 coverage in `coverage/`, with a minimum floor |

Why two TypeScripts: the game compiles with TypeScript 7, installed under the alias `@typescript/native`. typescript-eslint still needs the JavaScript compiler API, which TS 7 does not ship, so `typescript` itself is held at 6.0.x for lint tooling only. Drop the alias once typescript-eslint supports TS 7.

Prettier currently skips `src/`, `tests/`, `index.html` and `README.md` (see `.prettierignore`) because that code predates the formatter. They get formatted in one dedicated commit later, so please do not mix formatting churn into feature PRs.

## What CI checks

| Workflow            | When                                | What                                                                                                                                                                                |
| ------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PenTrace CI         | Every PR and push to `main`         | Lint, Prettier, typecheck, tests with coverage, web build, Rust fmt + clippy. Jobs only run when `pentrace/` changes; the `CI result` job always reports and is the one to require. |
| PenTrace installers | PRs and `main` touching `pentrace/` | Windows, macOS and Linux installers as downloadable artifacts                                                                                                                       |
| PR title            | Every PR                            | Title must be a conventional commit                                                                                                                                                 |
| CodeQL              | PRs, `main`, weekly                 | Security analysis of TypeScript, Rust and the workflows                                                                                                                             |
| Dependency review   | Every PR                            | Blocks new dependencies with known vulnerabilities or GPL/AGPL licenses                                                                                                             |
| PR labeler          | Every PR                            | Adds `area:*` labels from the changed paths                                                                                                                                         |

## Commits and PR titles

Use [Conventional Commits](https://www.conventionalcommits.org/). PRs are squash-merged, so the PR title becomes the commit on `main` and drives the next version and the changelog.

| Type                                                                | Use for                                | Version bump (pre-1.0) |
| ------------------------------------------------------------------- | -------------------------------------- | ---------------------- |
| `feat`                                                              | New mechanic, tool, command, UI        | minor                  |
| `content`                                                           | New contract, host, Index entry, story | patch                  |
| `fix`                                                               | Bug fix                                | patch                  |
| `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `style` | Everything else                        | none                   |

Add `!` (e.g. `feat!:`) or a `BREAKING CHANGE:` footer when old saves stop loading. Scope is optional; `pentrace` is a good default.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please):

1. Merging to `main` keeps a release PR open titled `chore(main): release pentrace X.Y.Z`. It bumps the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` and updates `CHANGELOG.md`.
2. Merging that PR tags `pentrace-vX.Y.Z`, creates the GitHub Release with the generated notes, and builds the Windows, macOS and Linux installers onto it.

Manual fallback: push a `pentrace-v*` tag and the same workflow creates the release (notes from GitHub) and attaches installers. To rebuild installers for an existing tag, run **PenTrace release** from the Actions tab with that tag.

## Where things live

| Path                  | What                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `src/engine/`         | Game logic with no DOM. Keep it that way so it stays unit-testable. |
| `src/engine/content/` | Contracts, Index entries, shop items as plain data                  |
| `src/ui/`             | Terminal, panels, effects, audio                                    |
| `src-tauri/`          | Desktop shell                                                       |
| `tests/`              | Vitest suites                                                       |

## Ground rules

- Everything is simulated. No command may touch a real network or the player's real filesystem.
- New techniques get an Index entry with Real World, In Game, and Detection & Defense sections.
- Engine changes come with tests.
- Report security issues privately. See [SECURITY.md](../SECURITY.md).
