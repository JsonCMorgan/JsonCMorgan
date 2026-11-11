<!--
PR title must be a conventional commit, e.g.
  feat(neontrace): add proxy overload layer
  fix(neontrace): trace meter no longer resets on dc
  content(neontrace): add "Cold Storage" crypto contract
It becomes the squash commit and drives the version bump and changelog.
-->

## What and why

<!-- One or two sentences. Link the issue: Closes #123 -->

## How to test

<!-- Commands to run or steps in game, e.g. `npm run dev`, then `nmap -sV 10.0.0.1`. -->

## Screenshots / clips

<!-- For UI, effects or new contracts. Delete if not relevant. -->

## Checklist

- [ ] `npm run check` passes in `neontrace/` (lint, format, typecheck, tests with coverage)
- [ ] New engine logic has unit tests in `neontrace/tests/`
- [ ] New techniques have an Index entry (Real World, In Game, Detection & Defense)
- [ ] Nothing touches a real network; all "hacking" stays simulated
- [ ] README / CONTRIBUTING updated if commands, setup or the release flow changed
