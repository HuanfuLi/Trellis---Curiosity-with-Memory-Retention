---
status: resolved
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
source: [36-09-SUMMARY.md, 36-10-SUMMARY.md, "follow-up commit 6a90224a"]
round: 3
started: 2026-05-07T01:00:00Z
updated: 2026-05-07T10:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete — 5 grouped issues from Test 1; Tests 2 + 3 not attempted due to upstream blockers]

## Tests

### 1. Dev "Force new day" button — full cold-start simulation
expected: |
  Open the app in dev mode with an existing populated post queue. Navigate to
  Settings → Data → Developer → "Force new day (dev)" → tap "Roll back date".
  App routes to /home. INITIAL render: today's posts visible immediately as the
  warm-start (no empty-flicker, no "Check your API keys" error UI). After
  ~8 seconds: feed refreshes with NEW posts.
result: issue
reported: |
  5 distinct sub-issues observed across this test surface:
  (a) Vine progress chip not cleared after Force New Day
  (b) Empty-feed cold-start state; user must manually swipe to see content
      — design intent: empty state should ONLY appear on first-ever launch;
        on a new day the app should auto-populate from yesterday's unserved
        queue (the leftover buffer of generated-but-not-yet-served posts)
  (c) Style mix imbalance: video → news → video → news pattern; only normalises
      after a swipe-for-more triggers a fresh refill
  (d) Double Force-New-Day shows previous-state served posts then empties to
      unserved queued posts
  (e) Queue not actively topping up to maintain REFILL_THRESHOLD;
      first-swipe-after-rollover does NOT trigger an LLM call;
      only the second swipe (after queue empties) fires generation
severity: major

### 2. Durable snapshot — second cold-start on the same new day
expected: |
  After Test 1 completes, tap "Force new day" AGAIN. Same observable behavior:
  warm-start renders immediately on /home, fresh batch replaces ~8s later.
result: blocked
blocked_by: upstream-test
reason: "Test 1 surfaced 5 distinct issues (a–e); deferred until 36-11/12/13 land. Will retest in round 4."

### 3. Production tree-shake — Force-new-day button absent in prod build
expected: |
  Run `npm run build` from app/. grep dist/ for "Force new day" — no matches
  (Vite's import.meta.env.DEV pass should eliminate the gated SettingRow).
result: skipped
reason: "Structurally covered by app/tests/screens/SettingsDataScreen.force-new-day.test.mjs gates assertion. Defer prod-build verification to next round."

## Summary

total: 3
passed: 0
issues: 1
pending: 0
skipped: 1
blocked: 1

## Gaps

- truth: "After Force New Day, vine progress chip on /home resets to 0/N (matching real-midnight behavior where dailyReadService.loadState detects date mismatch and returns freshState)."
  status: resolved
  reason: "User reported: vine progress bar seems not cleared after Force New Day."
  severity: major
  test: 1
  sub_issue: a
  root_cause: "dailyReadService.loadState() at daily-read.service.ts:36 self-resets when parsed.date !== today(). On a real midnight today() naturally advances → reset fires. The Force New Day dev button rolls back ONLY localStorage.echolearn_post_queue.date — it does not advance today(), so dailyReadService still sees parsed.date === today() (real today) and never resets. Latent in dailyReadService is fine; the dev button needs to manually call dailyReadService.reset() to mimic the natural midnight reset."
  artifacts:
    - path: app/src/services/daily-read.service.ts
      lines: 28-43
      issue: "Self-reset is correct for real-midnight (depends on today() advancing); dev button bypasses this path"
    - path: app/src/screens/settings/SettingsDataScreen.tsx
      lines: 77-105
      issue: "handleForceNewDay does not invoke dailyReadService.reset()"
  missing:
    - "Plan 36-13 — handleForceNewDay must call dailyReadService.reset() after rolling back the queue date"

- truth: "Cold-start of a new day automatically populates the feed with UNSERVED posts from yesterday's queue snapshot (no manual swipe needed). Empty state appears only on first-ever launch."
  status: resolved
  reason: "User reported: cold-start state showing empty feed; user must swipe-for-more manually. Design intent: yesterday's UNSERVED queue posts (already generated, not yet shown) should auto-populate; SERVED posts in echolearn_daily_posts should NOT carry across midnight."
  severity: major
  test: 1
  sub_issue: b
  root_cause: "Two layered bugs. (1) Plan 36-09's getYesterdayQueue snapshot is ORPHANED — it preserves yesterday's unserved _state.posts to STORAGE_KEY_YESTERDAY but no path consumes it back into the live _state.posts on cold-start. HomeScreen's useState initializer reads it as a static fallback render but does NOT push back into queue, so swipe-for-more dequeues from an empty in-memory queue. (2) The served-posts cache (echolearn_daily_posts) is date-INDEPENDENT in getCachedDailyPosts (concept-feed.service.ts:1507-1513 — filter is sourceType-based, not date-based), so yesterday's served posts persist visually across midnight, contradicting the design intent."
  artifacts:
    - path: app/src/services/post-queue.service.ts
      lines: "load() in 50-90 returns freshState on date mismatch — does not rehydrate _state.posts from parsed.posts"
      issue: "Yesterday's unserved are snapshotted but not consumed back into the live queue"
    - path: app/src/services/concept-feed.service.ts
      lines: 165-192
      issue: "loadCache() does not check cached.date === today(); date-stale caches still render"
  missing:
    - "Plan 36-11 Task 1 — loadCache rejects when cached.date !== today() (forces cold-start fall-through)"
    - "Plan 36-11 Task 2 — load() rehydrates _state.posts (and derivedList + cyclePosition) from parsed.posts on date mismatch, AFTER snapshotting"

- truth: "Cold-start feed style mix is balanced (text-art plurality, image/video/short/news minorities) immediately on first render."
  status: resolved
  reason: "User reported: video → news → video → news pattern visible on cold-start; only normalises after next swipe-for-more triggers a fresh refill."
  severity: major
  test: 1
  sub_issue: c
  root_cause: "Yesterday's leftover unserved queue is style-BIASED. text-art is plurality (55% of generation per STYLE_WEIGHTS) so the user pops text-art-heavy windows across the day. The unpopped tail at end-of-day skews disproportionately toward minority styles (video 8% + news 10% + short 8%). Phase 36-04's spreadByConcept + spreadByStyle mixers run at enqueue time but were never re-applied to the leftover that gets snapshotted. After Plan 36-11's rehydration, that style-biased leftover renders directly."
  artifacts:
    - path: app/src/services/post-queue.service.ts
      lines: "load() rehydration path (to be added in Plan 36-11 Task 2)"
      issue: "Rehydrated _state.posts is not re-interleaved before serving"
  missing:
    - "Plan 36-11 Task 3 — after rehydration, run spreadByConcept then spreadByStyle on _state.posts to re-balance the cold-start window"

- truth: "Repeated Force-New-Day taps on the same new day each show consistent unserved-queue cold-start (no regression to served-posts state)."
  status: resolved
  reason: "User reported: After first Force New Day, second Force New Day returned to previous state showing served posts, then emptied feed and showed unserved queued posts."
  severity: major
  test: 1
  sub_issue: d
  root_cause: "Same underlying bug as sub-issue (b) cause #2 — getCachedDailyPosts is date-independent. Second rollover finds today's served posts in echolearn_daily_posts, useState renders them, then useEffect's getDailyPosts cache-misses (date now yesterday) → drains the empty in-memory queue → momentarily empty → eventually shows new content. Closed by Plan 36-11 Task 1."
  artifacts:
    - path: app/src/services/concept-feed.service.ts
      lines: 165-192
      issue: "loadCache returns cached posts regardless of date"
  missing:
    - "Plan 36-11 Task 1 (same fix as sub-issue b cause #2)"

- truth: "After dequeue, the queue auto-tops-up by triggering an LLM call when size drops below REFILL_THRESHOLD; user does not encounter an empty-state followed by a wait."
  status: resolved
  reason: "User reported: After Force New Day + first swipe, no LLM call to top up the queue. Second swipe shows 'no more posts' AND THEN starts an LLM call. Wait → queue fills → can swipe again."
  severity: major
  test: 1
  sub_issue: e
  root_cause: "concept-feed.service.ts:1169-1172 refillQueue uses a boolean mutex (_queueRefillRunning) that BAILS when a refill is already in flight. generateMorePosts at line 1581-1593 has an `await refillQueue(questions); posts = postQueueService.dequeue(count);` retry pattern — but if refillQueue is in flight (typical race after Force New Day: useEffect's getDailyPosts kicks one off; user swipes immediately), the await returns instantly without waiting, dequeue still returns 0, generateMorePosts returns []. User sees empty state. By the second swipe, the original bg refill has either completed (queue has posts) or the flag has cleared (this time await actually runs). Latent since the await pattern was added (Phase 31 BLOCKER 3 fix per the source comment) — Force New Day just made it reliably reproducible by forcing back-to-back colliding refills."
  artifacts:
    - path: app/src/services/concept-feed.service.ts
      lines: 1169-1172
      issue: "Boolean mutex bails instead of awaiting in-flight refill"
    - path: app/src/services/concept-feed.service.ts
      lines: 1581-1593
      issue: "generateMorePosts await pattern silently no-ops when mutex is held"
    - path: app/src/services/post-queue.service.ts
      lines: 21
      issue: "REFILL_THRESHOLD=12 is too low for tight swipe cadence; bump to 16 (forward-looking for double-column feed which needs more posts and larger buffer)"
  missing:
    - "Plan 36-12 Task 1 — Convert _queueRefillRunning from boolean to Promise<void> | null; in-flight callers await the same promise instead of bailing (no duplicate LLM calls; no silent no-op for await callers)"
    - "Plan 36-12 Task 2 — Bump REFILL_THRESHOLD from 12 to 16 in post-queue.service.ts; update CLAUDE.md Numeric defaults block"
