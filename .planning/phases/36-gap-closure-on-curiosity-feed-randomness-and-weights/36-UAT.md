---
status: complete
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
source: [36-06-SUMMARY.md, 36-07-SUMMARY.md, 36-08-SUMMARY.md, 36-UAT-RETEST.md]
round: 2
started: 2026-05-06T18:00:00Z
updated: 2026-05-07T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold-start warm-start preserved (GAP-A retest)
expected: |
  Re-opening the app on a new day with a populated yesterday queue: warm-start
  posts appear immediately, no empty-flicker, no "Check your API keys" error
  UI. After ~8s the delayed refresh replaces them with today's freshly-generated
  batch.
result: issue
reported: "It's in the new day but the app is not showing cold start? Also, should add a dev feature in Settings page to force a new day so that we can debug this without actually waiting for a new day."
severity: major

### 2. Video completion signal — full-length (GAP-C retest, Detector D)
expected: |
  Tap a video post in the home feed → PostDetailScreen opens with YouTube
  iframe. Press play, watch ≥80% of the video OR let it run to ENDED. After
  completion: DevTools → Application → Local Storage → `echolearn_daily_read`
  → `exploredAnchors` contains the video's anchor ID. Returning to home feed:
  VineProgress chip increments by 1. Subsequent refill cycles do NOT generate
  new posts for this anchor (lazy-skip). No console errors about cross-origin
  postMessage.
result: pass
note: "User observed counting fires on play start (in both short and full-length video posts). User stated preference: 'just count if user enter it' — simpler count-on-enter semantics suffice; the 80% threshold is over-engineered for the desired UX. Detector D's ENDED/heartbeat path may be simplified in a follow-up if drift surfaces (e.g., people opening but not playing). Not changing now: existing Detector D + Detector B (30s dwell) collectively achieve the desired 'counts when user engages' outcome that the user is happy with."

### 3. Short tap-to-play emit (GAP-C retest, InfoFlow)
expected: |
  Find a short post in the home feed (presentationStyle === 'short'). Tap the
  thumbnail to play. The thumbnail swaps for the YouTube iframe AND fires
  CONCEPT_EXPLORED immediately. DevTools → Application → Local Storage →
  `echolearn_daily_read` → `exploredAnchors` contains the short's anchor ID
  after the tap. VineProgress chip increments by 1 on next home-feed render.
  Subsequent refill cycles do NOT generate new posts for this anchor.
result: pass
note: "Confirmed pass via Test 2 response — user observed 'progress bar already counts upon video start playing in both short and normal video post'. Tap-to-play emit on shorts works as designed."

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
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "On a new day, the cold-start path serves yesterday's leftover posts immediately via getYesterdayQueue(), with no empty-flicker and no 'Check your API keys' error UI."
  status: failed
  reason: "User reported: 'It's in the new day but the app is not showing cold start? Also, should add a dev feature in Settings page to force a new day so that we can debug this without actually waiting for a new day.'"
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing:
    - "Dev affordance: Settings > Developer/Data screen needs a 'Force new day' button that simulates date rollover by (a) snapshotting the current echolearn_post_queue state into a yesterday slot, (b) calling postQueueService.resetForNewDay() (or equivalent), (c) re-rendering HomeScreen so the cold-start useEffect path runs against a non-empty getYesterdayQueue. Without this, GAP-A is non-deterministic to verify in dev."
    - "Investigate: with the dev affordance in place, is HomeScreen's useState initializer at lines 38-47 actually receiving non-empty posts from getYesterdayQueue() on the simulated cold start? Or does some part of the date-rollover detection still bypass warm-start?"
  debug_session: ""
