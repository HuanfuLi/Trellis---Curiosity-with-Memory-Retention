---
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
verified: 2026-05-07T10:00:00Z
status: passed
score: 13/13 round-1 + 17/17 round-3 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 13/13
  rounds_3_plans:
    - 36-11-rehydrate-and-reject-stale-cache
    - 36-12-promise-mutex-refill
    - 36-13-force-new-day-cleanup
  round3_subissues_closed:
    - "(a) vine progress not cleared after Force New Day"
    - "(b) cold-start empty / yesterday's queue orphaned"
    - "(c) style imbalance on rehydrate (video → news → video → news)"
    - "(d) double-rollover served-posts regression"
    - "(e) queue not auto-topping (silent-no-op mutex race)"
  gaps_remaining: []
  regressions: []
---

# Phase 36: Gap Closure on Curiosity Feed Randomness and Weights — Verification Report

**Phase Goal:** Close known divergences between the live curiosity-feed code and the load-bearing "Concept Feed Generation Pipeline" design in CLAUDE.md: persistent derived list (GAP-1), cyclic walker (GAP-2), stratified style allocation (GAP-3), concept-axis spread (GAP-4), doc drift (GAP-6); round-1 added cold-start (GAP-A), walker-termination (GAP-B), video signals (GAP-C), durable yesterday snapshot + dev force-new-day (GAP-D); round-3 closed five sub-issues exposed by Force-New-Day UAT.
**Verified:** 2026-05-07T10:00:00Z (round-3 augmentation)
**Status:** PASSED
**Re-verification:** Yes — round-3 closure on top of the round-1 PASSED baseline (13/13)

---

## Round 1 Closure (PASSED — 2026-05-06)

The original round-1 verification at 13/13 must-haves is preserved verbatim below. The four CLAUDE.md divergences (GAP-1, GAP-2, GAP-3, GAP-4) plus GAP-6 doc-sync were all CLOSED. Round-1 evidence has been spot-re-verified for regression: `derived-list.test.mjs` (10), `style-assignment-stratified.test.mjs` (10), `spread-by-concept.test.mjs` (7), `refill-queue-integration.test.mjs` (6) — 33/33 GREEN post-round-3.

[See the round-1 evidence section at the bottom of this report for the full table.]

---

## Round 3 Closure — 5 New Sub-Issues Closed

### Goal Achievement (Round 3)

#### Observable Truths (Round 3)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| R3-1 | `loadCache()` returns null on stale cache (`parsed.date !== today()`) — yesterday's served posts do not render across midnight | VERIFIED | `concept-feed.service.ts:185` `if (parsed.date !== today()) return null;` confirmed by direct read; `concept-feed-cache-date.test.mjs` 3/3 GREEN |
| R3-2 | `load()` rehydrates `_state.posts` + `derivedList` + `cyclePosition` from `parsed.posts` on date mismatch (after snapshotting yesterday) | VERIFIED | `post-queue.service.ts:104-117` rehydration block confirmed; `post-queue-rehydrate.test.mjs` 5/5 GREEN |
| R3-3 | After rehydration, `spreadByConcept` then `spreadByStyle` rebalance the style mix | VERIFIED | `post-queue.service.ts:106-107` calls in that order; rehydrate Test 5 asserts no adjacent same-style after rehydration |
| R3-4 | `feed-spread.ts` n-bound comment fixed (12 → 32 to match MAX_QUEUE_SIZE) | VERIFIED | `feed-spread.ts:14-15` `n ≤ 32 in production (MAX_QUEUE_SIZE = 32; rehydration on new day from Plan 36-11 may reach this cap)` |
| R3-5 | `_refillInFlight: Promise<void> \| null` Promise-mutex (via leaf module `refill-mutex.ts`) replaces `_queueRefillRunning` boolean | VERIFIED | `refill-mutex.ts:47-65` `createPromiseMutex` exports a Promise-based mutex with try/finally clear; `concept-feed.service.ts:1183` `const _refillMutex = createPromiseMutex();` and `:1199` `return _refillMutex.run(async () => {...});` |
| R3-6 | In-flight callers `await` the same Promise instead of bailing silently | VERIFIED | `refill-mutex.ts:51` `if (inFlight) return inFlight;`; concurrency test `single body executes when 3 callers race` GREEN |
| R3-7 | `REFILL_THRESHOLD = 16` (bumped from 12) | VERIFIED | `post-queue.service.ts:32` `const REFILL_THRESHOLD = 16;` confirmed; `post-queue.test.mjs` threshold test rewritten for 16 (GREEN) |
| R3-8 | NO `_queueRefillRunning` boolean reference remains in concept-feed.service.ts | VERIFIED | `grep -n "_queueRefillRunning" app/src/services/concept-feed.service.ts` returns no matches |
| R3-9 | `handleForceNewDay` calls `dailyReadService.reset()` to clear vine progress | VERIFIED | `SettingsDataScreen.tsx:103` `dailyReadService.reset();` inside handler body |
| R3-10 | The dual-cache hack from commit `6a90224a` is REVERTED — handler does not mutate `echolearn_daily_posts` | VERIFIED | Test 6 (negative regression) GREEN: anchor-pair extraction confirms substring `echolearn_daily_posts` is absent from handler body |
| R3-11 | `dailyReadService.loadState()` self-resets on date mismatch (existing infra, NOT modified by this plan) | VERIFIED | `daily-read.service.ts:34` `if (parsed.date !== today()) return freshState();` confirmed unchanged |
| R3-12 | New tests exist and ALL GREEN: `refill-mutex.test.mjs` (9), `post-queue-rehydrate.test.mjs` (5), `concept-feed-cache-date.test.mjs` (3), `SettingsDataScreen.force-new-day.test.mjs` (6) | VERIFIED | 23/23 GREEN combined; full breakdown in Behavioral Spot-Checks below |
| R3-13 | Existing `post-queue.test.mjs` updated for new contracts (date-mismatch test rewritten + threshold 12→16) | VERIFIED | `post-queue.test.mjs` 13/13 GREEN |
| R3-14 | CLAUDE.md "Numeric defaults" updated for REFILL_THRESHOLD = 16 + Promise mutex documentation | VERIFIED | `CLAUDE.md:69-70` updated; `CLAUDE.md:76` documents Phase 36-11 rehydration |
| R3-15 | TypeScript clean | VERIFIED | `npx tsc -b --noEmit` exits 0 |
| R3-16 | Round-1 invariants preserved (derived-list, stratified-style, spread-by-concept, integration smoke) | VERIFIED | All 33 round-1 tests GREEN post-round-3 |
| R3-17 | No new test failures introduced — pre-existing 26 trellis i18n failures unchanged | VERIFIED | `npm test` reports 495 tests, 469 pass, 26 fail (26 are pre-existing trellis-* `ERR_IMPORT_ATTRIBUTE_MISSING` on `en.json`) |

**Score (Round 3):** 17/17 truths verified

---

### Required Artifacts (Round 3)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/services/concept-feed.service.ts` | Stale-cache rejection in loadCache + Promise-mutex via createPromiseMutex | VERIFIED | Both edits confirmed at lines 185 (date check) and 1183/1199 (mutex use) |
| `app/src/services/post-queue.service.ts` | Rehydration in load() date-mismatch branch + REFILL_THRESHOLD=16 | VERIFIED | Lines 104-117 (rehydrate + spread) and line 32 (threshold) |
| `app/src/services/feed-spread.ts` | n-bound comment fixed 12 → 32 | VERIFIED | Lines 14-15 |
| `app/src/services/refill-mutex.ts` | NEW leaf module — Promise-mutex helper with createPromiseMutex export | VERIFIED | 65-line leaf module; zero deps on i18n chain; default export per plan-12 verbal contract; `createPromiseMutex` returns `{run, getInFlight}` |
| `app/src/screens/settings/SettingsDataScreen.tsx` | handleForceNewDay calls dailyReadService.reset(); no echolearn_daily_posts mutation | VERIFIED | Lines 77-110; explicit reset at line 103; substring `echolearn_daily_posts` absent from handler body (asserted by Test 6) |
| `app/tests/services/post-queue-rehydrate.test.mjs` | NEW — 5 cases for rehydration semantics | VERIFIED | 5/5 GREEN |
| `app/tests/services/concept-feed-cache-date.test.mjs` | NEW — 3 cases for stale-cache rejection | VERIFIED | 3/3 GREEN (source-reading style — concept-feed has i18n chain) |
| `app/tests/services/refill-mutex.test.mjs` | NEW — concurrency tests + wiring tests | VERIFIED | 9/9 GREEN (3 mutex behavior + 6 wiring source-reading) |
| `app/tests/services/post-queue.test.mjs` | Date-mismatch test rewritten + threshold 12→16 | VERIFIED | 13/13 GREEN |
| `app/tests/screens/SettingsDataScreen.force-new-day.test.mjs` | Test 5 rewritten (was: daily-posts mutation; now: dailyReadService.reset call) + Test 6 added (negative regression) | VERIFIED | 6/6 GREEN — old "daily-posts cache date" test removed; new Test 5 (vine reset) + Test 6 (negative) present |
| `CLAUDE.md` | Numeric defaults: REFILL_THRESHOLD=16; Promise mutex bullet; Phase 36-11 rehydration paragraph | VERIFIED | Lines 69-70 (threshold + mutex), line 76 (rehydration) |

---

### Key Link Verification (Round 3)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `post-queue.service.ts:load` | `feed-spread.ts:spreadByConcept` + `spreadByStyle` | Direct call after rehydration | WIRED | `import { spreadByConcept, spreadByStyle } from './feed-spread.ts'` at line 9; calls at lines 106-107 |
| `concept-feed.service.ts` | `refill-mutex.ts:createPromiseMutex` | Direct import | WIRED | `import { createPromiseMutex } from './refill-mutex'` at line 29; `_refillMutex = createPromiseMutex()` at line 1183; `_refillMutex.run(...)` at line 1199 |
| `concept-feed.service.ts:loadCache` | `lib/date.ts:today` | Existing import (line 3) reused | WIRED | `today()` consumed by new line 185 date-rejection branch |
| `SettingsDataScreen.tsx:handleForceNewDay` | `daily-read.service.ts:reset` | Direct call | WIRED | `dailyReadService` already imported at line 15; `.reset()` at line 103 |
| `post-queue.service.ts:load` | STORAGE_KEY_YESTERDAY snapshot (Plan 36-09 contract preserved) | localStorage.setItem before rehydration | WIRED | Lines 84-89; runs before rehydration block; Test 3 of post-queue-rehydrate verifies coexistence |
| `concept-feed.service.ts:refillQueue` | `_refillMutex.run(...)` | Mutex IIFE wrapping body | WIRED | Body wrapped at line 1199; `needsRefill()` cheap pre-check preserved at line 1193 |

---

### Data-Flow Trace (Level 4 — Round 3)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `post-queue.service.ts:load` (rehydration branch) | `rehydrated: DailyPost[]` | `parsed.posts` from yesterday's localStorage payload | Yes — rehydrated payload populates `_state.posts` + `derivedList` + `cyclePosition` | FLOWING |
| `concept-feed.service.ts:loadCache` | return value | localStorage `echolearn_daily_posts`; rejected when stale | Yes — fresh-day cache hits return real posts; stale returns null (closes b#2 + d) | FLOWING |
| `refill-mutex.ts:createPromiseMutex` | `inFlight` closure | `fn()` invocation captured into Promise | Yes — concurrent callers receive same Promise; await resolves when body completes | FLOWING |
| `SettingsDataScreen.tsx:handleForceNewDay` | localStorage mutation + service calls | `localStorage.setItem('echolearn_post_queue', ...)` + `postQueueService.loadQueue()` + `dailyReadService.reset()` | Yes — three coordinated side effects mimic natural midnight rollover | FLOWING |

---

### Behavioral Spot-Checks (Round 3)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All round-3 new test files GREEN | `node --test tests/services/refill-mutex.test.mjs tests/services/post-queue.test.mjs tests/services/post-queue-rehydrate.test.mjs tests/services/concept-feed-cache-date.test.mjs tests/screens/SettingsDataScreen.force-new-day.test.mjs` | tests=36, pass=36, fail=0 | PASS |
| `refill-mutex.test.mjs` standalone | `node --test tests/services/refill-mutex.test.mjs` | tests=9, pass=9, fail=0 | PASS |
| `post-queue.test.mjs` standalone | `node --test tests/services/post-queue.test.mjs` | tests=13, pass=13, fail=0 | PASS |
| `post-queue-rehydrate.test.mjs` standalone | `node --test tests/services/post-queue-rehydrate.test.mjs` | tests=5, pass=5, fail=0 | PASS |
| `concept-feed-cache-date.test.mjs` standalone | `node --test tests/services/concept-feed-cache-date.test.mjs` | tests=3, pass=3, fail=0 | PASS |
| `SettingsDataScreen.force-new-day.test.mjs` standalone | `node --test tests/screens/SettingsDataScreen.force-new-day.test.mjs` | tests=6, pass=6, fail=0 | PASS |
| Round-1 regression (no rollback) | `node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/refill-queue-integration.test.mjs` | tests=33, pass=33, fail=0 | PASS |
| Full suite | `npm test` | tests=495, pass=469, fail=26 (26 pre-existing trellis i18n failures, unchanged from round-1 baseline) | PASS |
| TypeScript clean | `npx tsc -b --noEmit` | exit 0, no output | PASS |

---

### Requirements Coverage (Round 3)

| Requirement ID (frontmatter) | Description | Status | Evidence |
|------------------------------|-------------|--------|----------|
| GAP-D-round3-a | Vine progress chip not cleared on Force New Day | CLOSED | Plan 36-13: `dailyReadService.reset()` added to handler |
| GAP-D-round3-b | Cold-start empty + yesterday's queue orphaned (cause #1: missing rehydration; cause #2: stale cache survives midnight) | CLOSED | Plan 36-11 Tasks 1+2: `loadCache` date-rejection (cause #2) + `load()` rehydration (cause #1) |
| GAP-D-round3-c | Style imbalance on rehydrate (video → news → video → news pattern) | CLOSED | Plan 36-11 Task 2: `spreadByConcept` + `spreadByStyle` re-interleave after rehydration |
| GAP-D-round3-d | Double-rollover served-posts regression | CLOSED | Plan 36-11 Task 1: `loadCache` returns null when `cached.date !== today()` — symmetric to load()'s rehydration |
| GAP-D-round3-e | Queue not auto-topping (silent-no-op race in boolean mutex) | CLOSED | Plan 36-12 Task 1: `_queueRefillRunning: boolean` → `createPromiseMutex()` Promise-based; in-flight callers await the same Promise |
| GAP-D-round3-cleanup | Revert dual-cache hack from commit `6a90224a` | CLOSED | Plan 36-13 Task 1: `echolearn_daily_posts` mutation removed from handler; Test 6 negative regression guards re-introduction |

All 6 round-3 requirement IDs CLOSED.

---

### Anti-Patterns Found (Round 3)

No anti-patterns detected in round-3 code. Checked:

- `refill-mutex.ts`: real Promise-mutex implementation; try/finally clear in BOTH success AND error paths; no console.log-only stubs; no `return null` placeholders
- `post-queue.service.ts:load` rehydration branch: real algorithm — snapshot to STORAGE_KEY_YESTERDAY → rehydrate to `_state` → re-interleave via spreadByConcept + spreadByStyle. No empty-fallback paths
- `concept-feed.service.ts:loadCache` date-rejection: real logic at line 185 — single-line `if/return null` after structural validation
- `SettingsDataScreen.tsx:handleForceNewDay`: real algorithm — mutate post_queue.date → loadQueue → reset daily-read → navigate. No silent no-ops; explicit toast on success/error paths
- No new event types introduced
- All callers wired (no orphan exports)

---

### Human Verification Required

| Test | What To Do | Expected | Why Human |
|------|-----------|----------|-----------|
| Force-New-Day end-to-end on real device | Open Settings → Data → Force New Day; observe HomeScreen | (1) Vine progress chip resets to 0/N. (2) Yesterday's UNSERVED posts auto-populate today's feed (no swipe needed, no LLM wait). (3) Style mix on cold-start screen is balanced (no video → news → video → news). (4) Second consecutive Force-New-Day does NOT show previous-state served posts. | Multi-step UX flow with localStorage state interactions; can only meaningfully assert on device |
| Rapid swipe under empty queue | Trigger Force-New-Day with very few unserved posts (e.g., 1-2). Swipe rapidly | First swipe sees the in-flight refill complete and returns posts (does NOT bail with empty result). Subsequent swipes also return posts as queue replenishes | Race condition between user swipe and background refill; behavioral assertion only feasible on device |

These items are desirable QA but do NOT block phase goal — all automated invariants are verified GREEN.

---

### Gaps Summary (Round 3)

No gaps. All 17 round-3 must-haves verified GREEN; all 5 round-3 sub-issues (a, b, c, d, e) closed; all 6 round-3 requirement IDs CLOSED.

The round-3 closure ships a clean architectural pattern:
- **Symmetric staleness handling** across the two caches: `load()` rehydrates from the post-queue snapshot; `loadCache()` rejects stale daily-posts cache on date mismatch. Neither needs explicit invalidation by the dev-tools handler — staleness is a structural property of the cache, not a dual-cache mutation hack.
- **Promise-mutex via leaf module**: `refill-mutex.ts` is a 65-line leaf with zero i18n-chain deps, so node --test can exercise its semantics directly. concept-feed.service.ts re-uses the helper to share semantics with the runtime mutex path — single source of truth, both behavioral concurrency tests and runtime use the same code.
- **Round-1 invariants preserved**: derived-list, stratified-style, spread-by-concept, integration-smoke all 33/33 GREEN post-round-3. No regressions.

Pre-existing trellis-* test failures (26 cases of `ERR_IMPORT_ATTRIBUTE_MISSING` on en.json) are confirmed unchanged from the round-1 baseline (and from the broader Phase 33-35 baseline). Documented in CLAUDE.md i18n section. NOT a phase-36 concern.

---

## Round 1 Evidence (Preserved Verbatim — PASSED 2026-05-06)

### Observable Truths (Round 1)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `assignStyles` produces style counts within ±1 of `round(N × w_style)` for N ∈ {2,3,8,12} every run | VERIFIED | `style-assignment-stratified.test.mjs` 10/10 GREEN; 50-run invariant test asserts every single run is in-bounds |
| 2 | `spreadByConcept` produces no same-concept-adjacent pairs when 2+ concepts present | VERIFIED | `spread-by-concept.test.mjs` 7/7 GREEN; Test 5 (dominant 6-of-A) achieves max-run=2 AABAABAA layout |
| 3 | `derivedList` grows monotonically-non-decreasing across same-day refillQueue calls | VERIFIED | `derived-list.test.mjs` Test 1 (append-only), Test 2 (dedup); `refill-queue-integration.test.mjs` Test GAP-1 |
| 4 | After `walkDerivedList(count)` advances cyclePosition past length, next call wraps to 0 | VERIFIED | `derived-list.test.mjs` Test 7 (wrap confirmed); `refill-queue-integration.test.mjs` Test GAP-2 |
| 5 | Explored concept IDs are skipped at walk time (lazy-skip); walker terminates in ≤2 full passes | VERIFIED | `derived-list.test.mjs` Test 8 (lazy skip) + Test 9 (all-explored → []); `refill-queue-integration.test.mjs` Test 6 |
| 6 | Important anchors (easeFactor<1.5 or dying/falling/dead) get 2× entries in derivedList | VERIFIED | `buildConceptBatch` count multiplier preserved; `derived-list.test.mjs` Test 10 |
| 7 | Phase 33 fixes preserved: dueAnchors filter + allExplored cap-gate | VERIFIED | concept-feed.service.ts `dueAnchors.filter(a => !exploredIds.has(a.id))` + `allExplored && getTotalGenerated() >= maxPosts` both preserved (line numbers shifted by Plan 36-12 mutex extraction) |
| 8 | CLAUDE.md doc-sync landed: MAX_QUEUE_SIZE=32, appendToDerivedList, walkDerivedList, GAP-1/3/4 closed, GAP-5 preserved | VERIFIED | All 7 sentinel greps return expected counts |
| 9 | All Wave 0 test files GREEN: derived-list (10), style-assignment-stratified (10), spread-by-concept (7) + integration (6) | VERIFIED | 33/33 GREEN in one run |
| 10 | npm test pass count ≥ 422, fail count ≤ 26 | VERIFIED post-round-3 | `npm test` reports tests=495, pass=469, fail=26. (Round-3 added 36 new tests, all GREEN; old fails unchanged) |
| 11 | TypeScript clean: `npx tsc -b --noEmit` exits 0 | VERIFIED | exit code 0, no output |
| 12 | Integration smoke `refill-queue-integration.test.mjs` 6/6 pass | VERIFIED | 6/6 GREEN |
| 13 | No new events introduced | VERIFIED | event-bus.ts and types/index.ts unchanged |

**Round 1 Score:** 13/13 truths verified

---

_Verified (Round 1): 2026-05-06T08:30:00Z_
_Verified (Round 3 augmentation): 2026-05-07T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
