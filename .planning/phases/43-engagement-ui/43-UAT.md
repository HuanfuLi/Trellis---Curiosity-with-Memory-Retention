---
status: partial
phase: 43-engagement-ui
source: [43-01-shared-infra-and-locales-SUMMARY.md, 43-02-trim-presentation-style-tag-SUMMARY.md, 43-03-longpress-menu-and-masonry-integration-SUMMARY.md, 43-04-saved-screen-and-route-SUMMARY.md, 43-05-postdetail-deep-dive-trigger-SUMMARY.md, 43-06-homescreen-wiring-SUMMARY.md, 43-07-force-new-day-engagement-reset-SUMMARY.md]
started: 2026-05-11T09:35:43Z
updated: 2026-05-11T09:54:00Z
---

## Current Test

[testing paused — 1 blocked item (Test 4) outstanding; re-test after gap #1 fix]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Vite dev server. Clear ephemeral state if desired (rm -rf app/node_modules/.vite app/dist). Start the app fresh (cd app && npm run dev). Server boots without errors. Open http://localhost:5173/ → HomeScreen renders masonry feed, no blank screen, no console errors.
result: pass

### 2. Long-Press Menu Opens With State-Aware Labels
expected: On HomeScreen, press and hold any feed tile for ~480ms (don't drag). A bottom-sheet menu opens with 3 rows: Like, Save, Not interested. If the tile is already saved/liked, the corresponding row label flips to "Unsave" / "Unlike". Tapping outside or pressing back dismisses the menu without action.
result: issue
reported: "Only showed Like and Save, did not show \"Not interested\". Possibly blocked by bottom navigation bar"
severity: major

### 3. Save & Like Confirmation Toast + Corner-Icon Overlay
expected: Open the long-press menu on a tile, tap Save. Toast appears confirming "Saved". A small bookmark icon overlays the tile's corner (read-only — not a tap target). Long-press the same tile → row now reads "Unsave". Repeat with Like → toast "Liked" + heart corner icon. Re-tap Unsave/Unlike from the menu → toast confirms removal + corner icon disappears.
result: pass
note: "User reported a cosmetic enhancement (logged as separate gap): saved/liked corner icons blend into image/thumbnail backgrounds; needs a small round-shaped background that matches light/dark theme."

### 4. Dismiss Fades ALL Same-Anchor Tiles
expected: Find an anchor-concept that has multiple tiles in the feed (text + image + video sharing the same anchor). Long-press any one → Not interested → toast confirms "Got it — you won't see this again". ALL tiles sharing that anchor fade out with a smooth exit transition (not just the tapped tile). The masonry layout reflows without a visible gap.
result: blocked
blocked_by: prior-phase
reason: "Blocked by issue #1 (Test 2 gap — Not Interested row clipped by bottom navigation bar). Cannot see or tap the Dismiss action; re-test after gap #1 is fixed."

### 5. Bookmark Icon → /saved Screen → Saved | Liked Tabs
expected: HomeScreen header (top-right) shows a Bookmark icon. Tap it → navigates to /saved. Screen header reads "Saved", back-arrow returns to /home. Two tabs at top: Saved | Liked. Saved tab lists all posts you've saved (compact card layout). Liked tab lists all posts you've liked. Empty tab shows empty-state copy. Tapping a row opens that post's detail screen.
result: pass
note: "User reported a positioning bug (logged as separate gap): Bookmark icon is fixed to viewport instead of HomeScreen header row, overlaps + interferes with TrellisProgressBar on scroll. Should be inline with 'Good Morning' greeting."

### 6. Deep Dive Button Streams Deeper Essay
expected: Open any post detail screen (tap a feed tile). Below the essay body and above the takeaway, a full-width "Deep Dive" button is visible (subtle styling, not loud). Tap it → essay re-streams in-place with a longer, more detailed version (350–600 words vs. the standard 150–250). No visual jump, no scroll drift. After streaming finishes, the button is replaced by a segmented Standard | Deep toggle.
result: pass

### 7. Standard | Deep Segmented Toggle (No Re-Stream)
expected: On a post where Deep Dive has already streamed (previous test), the segmented Standard | Deep toggle is visible above the essay. Tapping Standard instantly shows the original 150–250w essay. Tapping Deep instantly shows the cached 350–600w deep version. No re-stream, no network call, no loading spinner — toggle is purely client-side.
result: issue
reported: "Partial: the toggle appeared below essay instead of above essay. It appeared between essay body and takeaway section. You are right to design it above essay, I guess the prior decision was confusing."
severity: minor

### 8. ANCHOR_DISMISSED Resync On Return To Home
expected: On HomeScreen, note an anchor-concept tile. Tap it to open detail. Inside PostDetail (or via /saved), trigger a dismiss on that anchor via the long-press menu (or any other dismiss surface). Navigate back to /home. The dismissed anchor's tiles are gone from the feed (no need to swipe-for-more or pull-to-refresh).
result: skipped
reason: "Test design error: dismiss is only available via HomeScreen feed-tile long-press menu — there is no dismiss surface on PostDetail or /saved. The plan-summary anticipated cross-screen dismiss (Effect B `[location.pathname]` re-read pathway), but no such surface ships in Phase 43, so Effect B has no exercisable user path to validate via UAT. HomeScreen-internal dismiss + immediate fade is covered by Test 4 (currently blocked behind gap #1 — Dismiss row clipping)."

### 9. Force-New-Day Resets Engagement State
expected: Settings → Data → tap "Force New Day" (dev affordance). Confirmation prompt appears, confirm it. Toast confirms success. Navigate to /saved → both Saved and Liked tabs are empty. Return to /home → previously dismissed anchors reappear in the feed. Corner-icon overlays on tiles (bookmark / heart) are all gone.
result: issue
reported: "Wait. Why should new day reset this? Saved/Liked should be persistent so that user can look back at their saved/liked posts I think? There may be a decision mistake"
severity: major

### 10. NEWS Chip Removed From News Tiles
expected: Scroll the masonry feed until you find a news-style tile (sourced via Tavily web-search, has a small "via {publisher}" attribution). The tile no longer shows a "NEWS" presentation-style chip/badge in its header. Other tile types (image, text-art, video, suggestion) similarly have no presentation-style chip. Source attribution + question chips remain intact.
result: pass

## Summary

total: 10
passed: 5
issues: 5
pending: 0
skipped: 1
blocked: 1

## Gaps

- truth: "Long-press menu shows 3 rows: Like, Save, Not interested (the third Dismiss row is visible and tappable, not clipped by the bottom navigation bar)"
  status: failed
  reason: "User reported: Only showed Like and Save, did not show \"Not interested\". Possibly blocked by bottom navigation bar"
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "Saved/liked corner icons on feed tiles have sufficient contrast against image/thumbnail backgrounds in both light and dark themes"
  status: failed
  reason: "User reported (alongside Test 3 pass): the liked/saved signs have no background and blends with image/thumbnail behind. Can add a small round shaped background (remember to match light/dark theme)"
  severity: cosmetic
  test: 3
  artifacts: []
  missing: []

- truth: "HomeScreen Bookmark icon is anchored to the page header (inline with the 'Good Morning' greeting row) and scrolls with the page like a normal element — does not overlap or interfere with the TrellisProgressBar on scroll"
  status: failed
  reason: "User reported (alongside Test 5 pass): the bookmark icon is wrongly fixed on screen position (canvas?) instead of page, and it does not move when user scroll just like a normal element (like post tiles). When user scroll down and trellis progress bar show up, the bookmark icon overlaps and interferes with progress bar. Should fix the bookmark icon in the same line of 'Good Morning'"
  severity: minor
  test: 5
  artifacts: []
  missing: []

- truth: "PostDetailScreen Deep Dive button AND Standard | Deep segmented toggle are positioned ABOVE the essay body (so users see the depth-control affordance BEFORE reading), not between essay body and takeaway"
  status: failed
  reason: "User reported (alongside Test 7 issue): the toggle appeared below essay instead of above essay. It appeared between essay body and takeaway section. You are right to design it above essay, I guess the prior decision was confusing. -- This is an operator-decision update: original Phase 43-05 CONTEXT placement was 'below body / above takeaway'; updated preference is 'above essay body'. Applies to BOTH the Deep Dive button (pre-stream) and the segmented Standard | Deep toggle (post-stream / cached state)."
  severity: minor
  test: 7
  artifacts: []
  missing: []

- truth: "Force-New-Day resets ONLY the dismissed-anchors list (so previously hidden tiles return tomorrow); it does NOT wipe the user's Saved or Liked archives, which are persistent across days"
  status: failed
  reason: "User flagged a design mistake: Saved/Liked should be persistent so that user can look back at their saved/liked posts. The current Phase 43-07 implementation calls engagementService.reset() inside SettingsDataScreen.handleForceNewDay, which wipes ALL three lists (saved + liked + dismissed). Phase 43 SUMMARY already lists 'resetDismissedOnly() partial-reset API' under 'Deferred Polish' — that polish is now load-bearing for correct UX. Fix: add engagementService.resetDismissedOnly() method (only wipes the dismissed array; leaves saved + liked intact) and update SettingsDataScreen.handleForceNewDay to call it instead of reset(). Update the SC-6 test (tests/screens/SettingsDataScreen.force-new-day-engagement-reset.test.mjs) to assert resetDismissedOnly() call + non-wipe of saved/liked."
  severity: major
  test: 9
  artifacts: []
  missing: []
