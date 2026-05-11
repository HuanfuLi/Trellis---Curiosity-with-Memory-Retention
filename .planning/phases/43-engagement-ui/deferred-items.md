# Phase 43 Deferred Items

Out-of-scope discoveries during parallel plan execution.


## From 43-09 execution (2026-05-11)

- **TS6133 in PostDetailScreen.tsx:595** — `'renderDeepDiveControls' is declared but its value is never read.` Encountered during 43-09 typecheck. Out of scope (PostDetailScreen is 43-12's territory, currently executing in parallel). 43-12 will wire `renderDeepDiveControls` into its JSX and resolve this naturally. If still present after 43-12 lands, escalate to phase-close verifier.

## Logged by 43-10 executor (2026-05-11, parallel sub-wave 4A)

The following test failures were observed during the `npm run test:main` sweep at the end of 43-10 execution. They are **pre-existing** (confirmed via `git stash`-then-rerun against the same HEAD that 43-10 branched from) and **out of scope** for the corner-icon-chip-backdrop fix:

- `tests/concept-feed.test.mjs`:
  - `counterweight: Phase 39 walker wire untouched at concept-feed.service.ts:~1212`
  - `concept-feed.service.ts contains walkDerivedList(16, exploredIds, dismissedIds)` — asserts the OLD `16` walker batch size; CLAUDE.md documents the canonical value as **24** (bumped 2026-05-10 for masonry feed). The assertion appears to be stale relative to the documented post-2026-05-10 contract.
  - `concept-feed.service hasImageGenKey gate`
  - `refillQueue availability honors geminiApiKey (not just nanoBananaApiKey)`
  - `tests/services/post-queue.test.mjs` — `needsRefill returns true when size < 16, false when >= 16 (Phase 36-12)` — again stale `16` threshold; CLAUDE.md documents the refill threshold as **24** post-2026-05-10.
  - `getVineColor returns one of the 5 --node-* variables`

These look like a coordinated stale-numeric-constants set (16 vs 24) plus an unrelated `getVineColor` and `hasImageGenKey` drift. Likely candidates for a Wave 4 hygiene plan or verifier sweep. Not touched by 43-10 because the scope boundary rule forbids it (43-10 only touches `app/src/index.css`, `app/src/components/MasonryFeed.tsx`, and a new test file).
