---
status: complete
phase: 43-engagement-ui
source: [43-01..43-08 SUMMARYs (initial UAT) + 43-09..43-13 gap-closure SUMMARYs + post-gap follow-ups]
started: 2026-05-11T09:35:43Z
updated: 2026-05-12T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Vite dev server. Clear ephemeral state if desired (rm -rf app/node_modules/.vite app/dist). Start the app fresh (cd app && npm run dev). Server boots without errors. Open http://localhost:5173/ → HomeScreen renders masonry feed, no blank screen, no console errors.
result: pass

### 2. Long-Press Menu Shows All 3 Rows (Not Interested Visible)
expected: On HomeScreen, press and hold any feed tile for ~480ms. The bottom sheet opens via React Portal to document.body (escapes the SwipeTabContainer slot stacking context). All THREE rows are visible and tappable: Like, Save, and Not interested. The "Not interested" row is NOT clipped or covered by the BottomNavigation bar. Tapping outside or pressing back dismisses without action. (Gap 43-09: BottomSheet now portals + sheet anchors at bottom: 0 with paddingBottom: calc(24px + 80px + var(--safe-area-bottom)) for nav clearance.)
result: pass

### 3. Save & Like Corner Icons Have Chip Backdrop (Light + Dark)
expected: Long-press a tile → Save. Confirm toast "Saved" + a small ROUNDED CHIP corner overlay (26x26px circle, semi-opaque backdrop, box-shadow) holding the bookmark icon. Icon has clear contrast against busy image/video thumbnails. Long-press → Like → same chip pattern with heart icon. Toggle to dark theme (Settings → Appearance, or system dark mode) → both chips remain readable (chip backdrop inverts, heart fill uses --corner-chip-fg-liked, not the old --node-salmon which inverted). (Gap 43-10: chip backdrop + dark-theme heart color.)
result: pass

### 4. Dismiss Fades ALL Same-Anchor Tiles
expected: Find an anchor-concept that has multiple tiles in the feed (text + image + video sharing the same anchor). Long-press any one → Not interested → toast confirms "Got it — you won't see this again". ALL tiles sharing that anchor fade out with a smooth exit transition (not just the tapped tile). The masonry layout reflows without a visible gap. (Now testable since Gap 43-09 unblocked the Not Interested row.)
result: issue
reported: "Fail: Dismissing one post of a concept did not clear other post tiles of same concept. Refreshing page did not change behavior"
severity: major

### 5. Bookmark Icon Inline With "Good Morning" Greeting
expected: HomeScreen header — the Bookmark icon is INLINE with the "Good Morning" greeting row (flex justify-between, 44x44px tap target). Scroll the masonry feed down — the bookmark scrolls AWAY with the greeting like any normal in-flow element. The compact VineProgress bar reveals at the top during scroll WITHOUT the bookmark icon overlapping or interfering with it. Tapping the bookmark navigates to /saved. (Gap 43-11: bookmark removed from fixed-position viewport overlay; placed inline in greeting row.)
result: pass

### 6. Deep Dive Button Streams Deeper Essay
expected: Open any post detail screen (tap a feed tile). Below the essay body and above the takeaway, a full-width "Deep Dive" button is visible (subtle styling, not loud). Tap it → essay re-streams in-place with a longer, more detailed version (350–600 words vs. the standard 150–250). No visual jump, no scroll drift. After streaming finishes, the button is replaced by a segmented Standard | Deep toggle.
result: pass

### 7. Deep Dive Controls Positioned ABOVE Essay Body
expected: Open a post detail screen. The Deep Dive button (pre-stream) AND the Standard | Deep segmented toggle (post-stream / cached) are positioned ABOVE the essay body — users see the depth-control affordance BEFORE reading. The scroll-70% sentinel (Detector A) stays in place between essay body and takeaway. After streaming, tapping Standard / Deep is instant client-side toggle (no re-stream, no spinner). (Gap 43-12: renderDeepDiveControls() invocation moved above essay container.)
result: pass

### 8. ANCHOR_DISMISSED Resync On Return To Home
expected: On HomeScreen, note an anchor-concept tile. Tap it to open detail. Inside PostDetail (or via /saved), trigger a dismiss on that anchor via the long-press menu (or any other dismiss surface). Navigate back to /home. The dismissed anchor's tiles are gone from the feed (no need to swipe-for-more or pull-to-refresh).
result: skipped
reason: "Test design error: dismiss is only available via HomeScreen feed-tile long-press menu — there is no dismiss surface on PostDetail or /saved. The plan-summary anticipated cross-screen dismiss (Effect B `[location.pathname]` re-read pathway), but no such surface ships in Phase 43, so Effect B has no exercisable user path to validate via UAT. HomeScreen-internal dismiss + immediate fade is covered by Test 4."

### 9. Force-New-Day Resets ONLY Dismissed (Saved + Liked Persist)
expected: Save and Like at least one post on the current day, then dismiss at least one anchor. Settings → Data → tap "Force New Day", confirm. Toast confirms success. Navigate to /saved → Saved tab STILL contains the previously saved post; Liked tab STILL contains the previously liked post (NOT wiped). Return to /home → previously dismissed anchors REAPPEAR in the feed. Corner-icon overlays on saved/liked tiles are still present. (Gap 43-13: engagementService.resetDismissedOnly() replaces full reset() in handleForceNewDay.)
result: pass

### 10. NEWS Chip Removed From News Tiles
expected: Scroll the masonry feed until you find a news-style tile (sourced via Tavily web-search, has a small "via {publisher}" attribution). The tile no longer shows a "NEWS" presentation-style chip/badge in its header. Other tile types (image, text-art, video, suggestion) similarly have no presentation-style chip. Source attribution + question chips remain intact.
result: pass

### 11. BottomSheet Collapsed State Doesn't Cover BottomNavigation
expected: Open the long-press menu (Test 2), then dismiss it by tapping the backdrop OR swipe-down. As the sheet animates out via transform: translateY(100%), the BottomNavigation tabs remain fully visible and tappable at the viewport bottom. There is NO ~80px sheet-tail covering the nav at any point during the close animation or at rest. (Post-gap follow-up: sheet re-anchored at bottom: 0; clearance moved to paddingBottom so translateY(100%) actually clears the viewport.)
result: pass

### 12. No Internal IDs Leak Into Feed Tile Chips or Search Queries
expected: Generate fresh posts (swipe-for-more on HomeScreen, or wait for refill). Inspect every visible tile chip — no tile shows a chip with text like "anchor-1776786217111-4-v9ty0" or "post-..." / "concept-..." / "question-..." prefixes. News tiles' Tavily-sourced headlines are about the actual concept name, not soft-matched on internal-ID acronyms. (Post-gap follow-up: video + news loops in concept-feed.service.ts skip when concept missing; InfoFlow chip render filters via isLikelyInternalId regex.)
result: issue
reported: "Critical bug surfaced after Force-New-Day: React DEV warnings spam — `Encountered two children with the same key, post-2026-05-12-video-anchor-{id}-{uuid}`. Multiple distinct anchor IDs implicated (1778057902568, 1778058314904, 1777471536383, 1777471733834, 1777469881037, 1777471605284). loadNextBatch log shows `popped 8 posts, styles: {video: 6, news: 2}`. style-assignment shows n=24 allocation. Duplicate post IDs (UUID-suffixed) means the SAME post object instance is appearing twice in the rendered list — likely from HomeScreen warm-start re-fallback path (`postQueueService.getYesterdayQueue()` fallback in Effect A) combining with the queue rehydration in `load()`'s date-mismatch branch, producing overlap between `dailyPosts` and freshly-popped queue items."
severity: blocker

### 13. Post Persistence — Yesterday's Posts Open From History / Saved
expected: At least one day must have elapsed since posts were generated (or use Force New Day to simulate). Navigate to /saved → History tab. Tap any historical post row → PostDetailScreen opens with the FULL essay body rendered (not "Post not found"). Same flow from Saved or Liked tabs for previously-saved/liked posts that have aged past today's daily feed. (Post-gap follow-up: getPostById falls back to postHistoryService.getPosts(); patchPostEssayInCache writes to all 4 caches including trellis_post_history.)
result: pass

### 14. Archive Consolidation — Single Entry, 3 Tabs, No Clock In VineProgress
expected: Compact VineProgress bar (revealed by scrolling /home down) has NO Clock icon on its right edge — only the chevron-down. The greeting-row bookmark icon is the sole archive entry. Tap it → /saved with THREE tabs: Saved | Liked | History. Switch to History → day-grouped layout (Today / Yesterday / Mmm d sticky headings). Tap a History row → PostDetailScreen opens. The old standalone /history route returns 404 / not registered. (Post-gap follow-up: PostHistoryScreen.tsx deleted; logic absorbed by SavedScreen as third tab.)
result: pass

## Summary

total: 14
passed: 11
issues: 2
pending: 0
skipped: 1
blocked: 0

## Gaps

[re-test in progress — prior 5 gaps already gap-closed via 43-09..43-13; this cycle re-verifies + tests 4 post-gap follow-ups]

### New gaps from this re-test cycle

- truth: "Dismissing any one tile of a multi-tile anchor concept fades out ALL tiles sharing that anchor (text + image + video) — not just the tapped tile. Behavior persists across page refresh."
  status: failed
  reason: "User reported: Fail: Dismissing one post of a concept did not clear other post tiles of same concept. Refreshing page did not change behavior"
  severity: major
  test: 4
  artifacts: []  # to be filled by diagnosis
  missing: []   # to be filled by diagnosis

- truth: "After Force-New-Day, the home feed does not render duplicate post entries — React renders each post id exactly once across initial dailyPosts + any freshly-popped queue batches. No 'Encountered two children with the same key' DEV warnings."
  status: failed
  reason: "User reported: many React duplicate-key warnings after Force New Day. Same post IDs (UUID-suffixed, e.g. post-2026-05-12-video-anchor-1778057902568-jrvoc-972cd67c-6730-4de6-9049-58de1e5ef6b5) appear twice in the rendered children array. Suspected cause: HomeScreen warm-start Effect A's `dailyPosts` fallback to `postQueueService.getYesterdayQueue()` overlaps with `postQueueService.load()` date-mismatch rehydration of `_state.posts` from the same parsed.posts payload, and `loadNextBatch` then pops items already present in `dailyPosts`."
  severity: blocker
  test: 12
  artifacts: []  # to be filled by diagnosis
  missing: []   # to be filled by diagnosis

### Historical (resolved) gaps from initial UAT cycle

- truth: "Long-press menu shows 3 rows: Like, Save, Not interested (not clipped by bottom nav)"
  status: resolved-by: 43-09
  test: 2

- truth: "Saved/liked corner icons have sufficient contrast in light + dark themes"
  status: resolved-by: 43-10
  test: 3

- truth: "Bookmark icon is inline with greeting row, scrolls with page"
  status: resolved-by: 43-11
  test: 5

- truth: "Deep Dive button + segmented toggle positioned above essay body"
  status: resolved-by: 43-12
  test: 7

- truth: "Force-New-Day resets ONLY dismissed (saved + liked persist)"
  status: resolved-by: 43-13
  test: 9
