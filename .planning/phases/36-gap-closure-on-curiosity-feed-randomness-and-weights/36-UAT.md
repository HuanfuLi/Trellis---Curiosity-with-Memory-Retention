---
status: testing
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
source: [36-11-SUMMARY.md, 36-12-SUMMARY.md, 36-13-SUMMARY.md]
round: 4
started: 2026-05-07T11:00:00Z
updated: 2026-05-07T11:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete — Test 1 surfaced 2 regressions of round-3 sub-issues (a) + (b);
Test 2 blocked by Test 1; Test 3 remains skipped]

## Tests

### 1. Dev "Force new day" button — full cold-start simulation (round-3 sub-issues a-e retest)
expected: |
  Open the app in dev mode with an existing populated post queue. Navigate to
  Settings → Data → Developer → "Force new day (dev)" → tap "Roll back date".
  App routes to /home. ALL FIVE round-3 issues should now be closed:

  (a) VINE PROGRESS CHIP CLEARED — the chip on /home should reset to 0/N
      (matching real-midnight behavior).

  (b) FEED AUTO-POPULATES — INITIAL render shows yesterday's UNSERVED queue
      posts immediately (no manual swipe needed, no empty flicker, no
      "Check your API keys" UI). After ~8 seconds: feed refreshes with
      NEW LLM-generated posts.

  (c) STYLE MIX BALANCED — cold-start posts should NOT show
      video → news → video → news pattern. Style mix should look balanced
      (mostly text-art with occasional image/video/news/short).

  (d) DOUBLE FORCE-NEW-DAY CONSISTENT — tap "Force new day" again — the
      view should NOT regress to served posts then empty out. Should show
      a clean cold-start identical to step 1.

  (e) QUEUE AUTO-TOPS-UP — first swipe-for-more after rollover should
      trigger an LLM call without showing an empty "no more posts" state
      first. The mutex should await the in-flight refill rather than
      bailing silently.
result: issue
reported: "A and B failed, blocking later tests"
severity: major

### 2. Durable snapshot — second cold-start on the same new day
expected: |
  After Test 1 completes, tap "Force new day" AGAIN. Same observable behavior:
  warm-start renders immediately on /home from the durable snapshot
  (STORAGE_KEY_YESTERDAY), fresh batch replaces ~8s later.
result: blocked
blocked_by: prior-phase
reason: "Test 1 sub-issues (a) and (b) failed — second cold-start cannot be evaluated meaningfully until first cold-start works. Will retest in round 5."

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

- truth: "After Force New Day, the vine progress chip on /home resets to 0/N (matching real-midnight behavior). Plan 36-13 wired handleForceNewDay to call dailyReadService.reset()."
  status: failed
  reason: "User reported: 'A and B failed, blocking later tests' — sub-issue (a) regressed despite Plan 36-13 shipping the dailyReadService.reset() call."
  severity: major
  test: 1
  sub_issue: a
  round: 4
  prior_attempt: "Plan 36-13 (committed 2026-05-07, see 36-13-SUMMARY.md) added dailyReadService.reset() to handleForceNewDay at SettingsDataScreen.tsx. Source-reading test 5 confirmed the call exists in source. Despite the source-level fix, runtime behavior shows the chip is NOT clearing."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Cold-start of a new day automatically populates the feed with UNSERVED posts from yesterday's queue snapshot (no manual swipe needed). Plan 36-11 shipped load() rehydration of _state.posts + derivedList + cyclePosition from yesterday's payload + spreadByConcept/spreadByStyle re-interleave."
  status: failed
  reason: "User reported: 'A and B failed, blocking later tests' — sub-issue (b) regressed despite Plan 36-11 shipping the rehydration path."
  severity: major
  test: 1
  sub_issue: b
  round: 4
  prior_attempt: "Plan 36-11 (committed 2026-05-07, see 36-11-SUMMARY.md) rewrote load()'s date-mismatch branch to snapshot → rehydrate _state.posts from parsed.posts → re-interleave via spreadByConcept then spreadByStyle. 5/5 behavioral rehydrate tests GREEN at unit level. Despite the unit-test pass, runtime behavior shows the feed is NOT auto-populating from yesterday's UNSERVED queue."
  artifacts: []
  missing: []
  debug_session: ""
