---
status: testing
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
source: [36-06-SUMMARY.md, 36-07-SUMMARY.md, 36-08-SUMMARY.md, 36-UAT-RETEST.md]
round: 2
started: 2026-05-06T18:00:00Z
updated: 2026-05-06T18:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Cold-start warm-start preserved (GAP-A retest)
expected: |
  Setup: have the app open with a populated post queue from a prior session,
  then close fully. Edit `localStorage.echolearn_post_queue` so its `date`
  field is yesterday. Re-open the app on `/home`. Within the first 2 seconds:
  yesterday's leftover posts (up to 8) appear immediately on screen — the
  warm-start populates from `postQueueService.getYesterdayQueue()`. The feed
  does NOT flicker to empty + back. The "Couldn't generate posts / Check your
  API keys in Settings" error UI does NOT appear. After ~8 seconds, the
  delayed `refreshFeed()` quietly replaces the warm-start posts with today's
  freshly-generated batch.

  Pre-fix failure mode: feed briefly shows yesterday's posts, then flickers
  to empty + AlertCircle + "Check your API keys" ~200ms after mount. Stays
  empty until manual nav-away-and-back OR the 8-second refresh fires.
awaiting: user response

## Tests

### 1. Cold-start warm-start preserved (GAP-A retest)
expected: |
  Re-opening the app on a new day with a populated yesterday queue: warm-start
  posts appear immediately, no empty-flicker, no "Check your API keys" error
  UI. After ~8s the delayed refresh replaces them with today's freshly-generated
  batch.
result: [pending]

### 2. Video completion signal — full-length (GAP-C retest, Detector D)
expected: |
  Tap a video post in the home feed → PostDetailScreen opens with YouTube
  iframe. Press play, watch ≥80% of the video OR let it run to ENDED. After
  completion: DevTools → Application → Local Storage → `echolearn_daily_read`
  → `exploredAnchors` contains the video's anchor ID. Returning to home feed:
  VineProgress chip increments by 1. Subsequent refill cycles do NOT generate
  new posts for this anchor (lazy-skip). No console errors about cross-origin
  postMessage.
result: [pending]

### 3. Short tap-to-play emit (GAP-C retest, InfoFlow)
expected: |
  Find a short post in the home feed (presentationStyle === 'short'). Tap the
  thumbnail to play. The thumbnail swaps for the YouTube iframe AND fires
  CONCEPT_EXPLORED immediately. DevTools → Application → Local Storage →
  `echolearn_daily_read` → `exploredAnchors` contains the short's anchor ID
  after the tap. VineProgress chip increments by 1 on next home-feed render.
  Subsequent refill cycles do NOT generate new posts for this anchor.
result: [pending]

### 4. Style-mix balance — text-art ≥ 8 of 16 (GAP-B retest, OPTIONAL)
expected: |
  Single non-important anchor in localStorage (one Q&A → one anchor →
  derivedList.length=4). Open home feed, swipe-for-more until 16+ posts
  served across 1-2 refill cycles. Count text-art posts (text-only cards
  with colored background and Georgia / Courier / Palatino / serif font).
  text-art count ≥ 8 of any 16 served (floor(16 × 0.55)). News + video +
  short combined are ≤ ~6 (≈ 3 × 0.10 × 16 + slack).

  Primary verification is automated (Test 7 in refill-queue-integration.test.mjs);
  this manual recount is for operator confidence — pass via "skip" if you
  trust the automated test.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

[none yet]
