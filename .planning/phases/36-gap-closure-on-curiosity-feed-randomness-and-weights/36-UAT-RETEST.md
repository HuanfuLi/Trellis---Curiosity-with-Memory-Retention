___
status: pending
phase: 36-gap-closure-on-curiosity-feed-randomness-and-weights
parent: 36-UAT.md
started: 2026-05-06
___

## Retest Tests

### Test 1 (GAP-A retest — cold-start warm-start preserved)

**Setup**: Have the app open with a populated post queue from a prior session (yesterday's posts
in localStorage key `echolearn_post_queue` with `date` field set to yesterday's date — to simulate
this in dev tools, manually edit the date field to one day in the past).

**Reproduction steps**:
1. Close the app fully (kill the tab/process).
2. Edit the `echolearn_post_queue` localStorage entry to set `date` to yesterday's date.
3. Re-open the app on the home screen (`/home`).
4. Observe the feed within the first 2 seconds of load.

**Expected after GAP-A fix**:
- Yesterday's leftover posts (up to 8) appear immediately on screen — the warm-start populates from
  `postQueueService.getYesterdayQueue()` via the useState initializer at HomeScreen.tsx:38-47.
- The feed does NOT flicker to empty + back, even when `getDailyPosts()` resolves with [] from the
  cold-start path 200ms later.
- The "Couldn't generate posts / Check your API keys in Settings" error UI does NOT appear.
- After ~8 seconds, the delayed `refreshFeed()` (HomeScreen.tsx:127-129) replaces the warm-start
  posts with today's freshly-generated batch from the now-populated queue.

**Failure mode (GAP-A active, pre-fix)**:
- Feed briefly shows yesterday's posts, then flickers to empty + AlertCircle + "Check your API keys"
  message ~200ms after mount.
- Stays empty until the user manually navigates away and back, OR the 8-second delayed refresh
  fires.

**Pass criteria**: Steps 1-4 produce only the expected behavior; no flicker; no error UI.
