---
phase: 50-retrieval-and-library-foundation
verified: 2026-05-18T10:08:14Z
status: gaps_found
score: 3/4 success criteria verified
overrides_applied: 0
gaps:
  - truth: "TypeScript compilation passes — tsc -b --noEmit — for all Phase 50 files"
    status: failed
    reason: "CollectionDrillInScreen.tsx introduces 5 new TypeScript errors: 4x TS2554 (bind.onPointerDown/Up/Leave/Move called with PointerEvent arg but useLongPress hook returns zero-arity callbacks) and 1x TS2345 (t('common.back') references a missing i18n key). CLAUDE.md §i18n explicitly states 'tsc -b --noEmit — typos in t(\"...\") keys fail compilation'."
    artifacts:
      - path: "app/src/screens/CollectionDrillInScreen.tsx"
        issue: "Lines 94, 98, 102, 105: TS2554 — bind.onPointerDown/Up/Leave/Move called with (React.PointerEvent) argument but useLongPress returns () => void handlers (zero-arity). Line 321: TS2345 — t('common.back') key does not exist in en.json, zh.json, es.json, or ja.json."
    missing:
      - "Fix useLongPress hook OR CollectionDrillInScreen pointer handler calls to not pass the event argument (or update useLongPress to accept PointerEvent)."
      - "Add 'back' key under 'common' namespace to all 4 locale bundles (en/zh/es/ja) and regenerate i18n.d.ts."
deferred:
  - truth: "SavedScreen.tsx TSC error at line 186 (TS2322 / TS2589 in EmptyState t(titleKey) cast)"
    addressed_in: "Pre-existing before Phase 50 — documented in deferred-items.md discovered during plan 50-04; forwarded to plan 50-09 which did not resolve it"
    evidence: "Verified via git show 5033ba49:app/src/screens/SavedScreen.tsx — identical t(titleKey) call at line 186 existed pre-Phase-50. deferred-items.md explicitly documents this as out-of-scope for Phase 50 plans."
human_verification:
  - test: "Open HomeScreen, long-press any feed tile, tap Save — collection picker sheet opens"
    expected: "BottomSheet slides up showing implicit Saved row (pre-checked), + New collection row, Done button; no blank frame between LongPressMenu close and picker open"
    why_human: "React 19 batching + animation timing cannot be verified by source-reading alone (T-50-SHEET-FLASH)"
  - test: "Create a collection, add a post to it, then open /saved, navigate to Collections tab, tap the collection row"
    expected: "Navigates to /collections/:id showing posts list; Header shows collection name with kebab icon"
    why_human: "Route transition, drill-in data fetch, and Header portal rendering require a running app"
  - test: "On /saved, tap the search bar, type a word that appears only in body text past character 60"
    expected: "Result rows appear with the matching word highlighted in a 120-char snippet under the title"
    why_human: "Fuse.js ignoreLocation behavior and HighlightedText <mark> rendering need visual confirmation"
  - test: "Add a post to a collection, age it past 7 days (or simulate via Force-New-Day repeated), verify purge leaves it"
    expected: "Post survives in /collections/:id; not removed by purgeExpired"
    why_human: "Time-travel / purge simulation cannot be done with a unit test in a meaningful end-to-end flow"
  - test: "On /collections/:id, long-press a post row — confirm LongPressMenu shows 'Remove from collection' fourth row"
    expected: "Tapping Remove dismisses the menu and shows an Undo toast; post disappears from collection list"
    why_human: "Long-press timing (480ms) and conditional row rendering require live interaction"
---

# Phase 50: Retrieval and Library Foundation — Verification Report

**Phase Goal:** Users can recover prior posts through bounded local search and apply local-first tags/bookmarks that persist across days.
**Verified:** 2026-05-18T10:08:14Z
**Status:** GAPS FOUND — 1 gap blocking clean TypeScript compilation
**Re-verification:** No — initial verification

---

## 1. Goal Achievement

### 1a. ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|------------------|--------|----------|
| SC-1 | User can search Saved, Liked, and History items by title, body, concept, source, and date | VERIFIED | `SavedScreen.tsx:546-571` builds a Fuse index over the active tab corpus with `FUSE_OPTIONS` (title/body/sourceQuestionTitles/contextLabel fields); filter chips apply concept/source/date predicates at lines 565-570 |
| SC-2 | User can reopen the original post from a search result without losing its concept/source context | VERIFIED | `SavedScreen.tsx:957` and `:988` both navigate to `/posts/${post.id}`; `SavedRow` renders `post.contextLabel` at line 202-213 |
| SC-3 | User can tag or bookmark posts and concepts with local metadata that persists after reload | VERIFIED (posts); operator-descoped for concepts | `collectionService` at `trellis_collections_v1` localStorage key persists across sessions (D-03); `engagementService.savePost` persists globally. Concept-level saves explicitly descoped by operator: "Save / bookmark on concept anchors — removed from scope after operator walked back" (50-CONTEXT.md). The ROADMAP SC says "posts and concepts" but the operator decision document (50-CONTEXT.md D-02) supersedes. |
| SC-4 | User can filter retrieval results by saved, liked, history, tag, bookmark, concept, source, and date without entering an infinite recommendation flow | VERIFIED | Four tabs (Saved/Liked/History/Collections) scope the corpus; three filter chips (Concept/Source/Date) apply AND predicates; no infinite scroll in `/saved` — only what's in the archive |

**Score: 3/4 criteria fully verified; SC-3 partially met (posts only — concepts explicitly operator-descoped).**

### 1b. RETRIEVE-01 and RETRIEVE-02 Verdicts

**RETRIEVE-01 — Library search (fuzzy search + filter chips):** COVERED

Evidence path:
- `app/src/services/library-search.service.ts` — Fuse.js 7.3.0 wrapper with `ignoreLocation: true`, 200-char query cap, `capQuery`, `search`, `extractSnippet`, `rebaseIndices`, `dateFilter` (all substantive, all tested)
- `app/src/components/ui/HighlightedText.tsx` — converts Fuse match indices to `<mark>` React nodes without `dangerouslySetInnerHTML`
- `app/src/components/FilterPickerSheet.tsx` — single-select bottom sheet for Concept/Source/Date pickers
- `app/src/screens/SavedScreen.tsx` — 4-tab screen at `/saved`; sticky search bar; focus-conditional filter chips at lines 577-816; Fuse index in `useMemo` at line 546; result rendering with HighlightedText at lines 196-230; no-match state at lines 880-929

Gaps: None for RETRIEVE-01 core functionality.

**RETRIEVE-02 — Collections (YouTube-playlist mental model):** COVERED

Evidence path:
- `app/src/services/collection.service.ts` — full CRUD (createCollection/renameCollection/deleteCollection/addPost/removePost/getCollections/getCollectionPosts/getAllMemberPostIds/getPostCollections/reset); idempotent mutators; COLLECTIONS_CHANGED event emission; T-50-ORPHAN graceful degradation
- `app/src/components/CollectionPickerSheet.tsx` — draft-state batching (T-50-PICKER-RACE); implicit Saved row; + New collection inline create; Done diff-commit
- `app/src/components/LongPressMenu.tsx` — `onOpenCollectionPicker` prop opens picker before `onClose()` (T-50-SHEET-FLASH); `collectionContext` prop adds Remove-from-collection row
- `app/src/screens/CollectionDrillInScreen.tsx` — `/collections/:id` sub-route; kebab rename/delete; COLLECTIONS_CHANGED subscriber navigates to `/saved` on delete
- `app/src/screens/HomeScreen.tsx:1070-1086` — LongPressMenu wired to CollectionPickerSheet via `onOpenCollectionPicker`
- `app/src/App.tsx:311` — `collections/:id` route registered
- `app/src/services/engagement.service.ts:206-210` — `getPinnedIds()` unions saved ∪ liked ∪ collection members (D-09)
- `app/src/services/post-history.service.ts:68` — `purgeExpired()` uses the extended union (unchanged call site)

Gaps: None for RETRIEVE-02 core functionality.

---

## 2. Decisions D-01..D-16 Verdicts

| # | Decision | Verdict | Evidence |
|---|----------|---------|---------|
| D-01 | Bookmark = Save synonym; no new primitive; label stays "Save" | VERIFIED | `LongPressMenu.tsx:199-205` uses `engagement.menu.save`/`unsave`; no `bookmarked[]` field in any service |
| D-02 | Save/Bookmark posts only; no concept-anchor affordance | VERIFIED | `AnchorDetailScreen.tsx` not modified in Phase 50 (no save/bookmark added); D-02 applied in `50-CONTEXT.md` |
| D-03 | Collections use `collectionService`; ID-only storage; post-only | VERIFIED | `collection.service.ts:48` uses `trellis_collections_v1`; `Collection.postIds: string[]`; resolved via `postHistoryService.getPosts()` at read time |
| D-04 | Save tap always opens collection picker | VERIFIED | `LongPressMenu.tsx:106-111` branches on `onOpenCollectionPicker`; `HomeScreen.tsx:1070-1073` wires it; no direct-toggle path when picker prop present |
| D-05 | Picker pre-checks implicit Saved row; single-tap-save preserved | VERIFIED | `CollectionPickerSheet.tsx:105-108` seeds `originalSaved`; `useEffect:135-141` re-syncs; `handleDone:196-248` commits diff |
| D-06 | Inline + New collection row; Collections sub-tab in /saved | VERIFIED | `CollectionPickerSheet.tsx:319-395` renders inline create; `SavedScreen.tsx:829-844` renders 4th Collections tab |
| D-07 | Drill-in at `/collections/:id`; kebab for rename/delete; LongPressMenu with Remove row | VERIFIED | `CollectionDrillInScreen.tsx` full implementation; `App.tsx:311` route |
| D-08 | History corpus = post-only | VERIFIED | `SavedScreen.tsx:530-538` `corpusForTab` returns flat arrays of DailyPost; Q&A/podcast/cards not included |
| D-09 | Collection membership pins against 7-day purge | VERIFIED | `engagement.service.ts:206-210` unions `collectionService.getAllMemberPostIds()`; `post-history.service.ts:68` unchanged call site; 7 dedicated tests GREEN |
| D-10 | Search bar pinned; filter chips inline on focus (not replacing tabs) | VERIFIED | `SavedScreen.tsx:577` `showFilterChips = searchFocused OR inputDraft.length > 0 OR anyFilterActive`; tabs rendered at lines 821-844 (separate from chips) |
| D-11 | Search scopes to active tab | VERIFIED | `SavedScreen.tsx:546-550` `fuseIndex` keyed on `activeTab` + `corpusForTab(activeTab)` |
| D-12 | Filter chips: Concept/Source/Date; Date = Today/Last 7/Last 30/All time | VERIFIED | `SavedScreen.tsx:589-615` builds concept/source/date option lists; `dateFilter` in library-search.service |
| D-13 | Fuse.js 7.3.0 fuzzy search | VERIFIED | `package.json:28` `"fuse.js": "^7.3.0"`; `library-search.service.ts:39` imports Fuse |
| D-14 | Sort = relevance when query non-empty; title weight > body weight | VERIFIED | `FUSE_OPTIONS.shouldSort: true`; weights `title:0.5 > body:0.3 > concept:0.15 > source:0.05` |
| D-15 | URL stays `/saved` regardless of active tab | VERIFIED | `SavedScreen.tsx` has no `useParams`/`useSearchParams`; tab state is `useState<Tab>('saved')` only |
| D-16 | Single-select filter chip | VERIFIED | `FilterPickerSheet.tsx:34` `selected: string | null`; `onSelect: (value: string) => void`; row tap commits and closes |

**All 16 decisions: VERIFIED.**

---

## 3. Threat Model Verdicts

| Threat | Mitigation | Verdict | Evidence |
|--------|-----------|---------|---------|
| T-50-XSS-NAME | Collection names render as React text nodes only; no `dangerouslySetInnerHTML` | VERIFIED | Grepped all 6 Phase 50 source files — `dangerouslySetInnerHTML` appears only in a `//` comment at `SavedScreen.tsx:50` (documentation, not usage) |
| T-50-XSS-HL | HighlightedText uses `<mark>` React children, not HTML injection | VERIFIED | `HighlightedText.tsx:58-70` builds nodes array with `text.slice(s, e+1)` as children; no HTML string concatenation path |
| T-50-QUERY-DOS | 200-char hard cap before Fuse receives input | VERIFIED | `library-search.service.ts:49` `MAX_QUERY_LENGTH = 200`; `capQuery:105-108`; `search:120-125` calls `capQuery` internally; test "query length cap" GREEN |
| T-50-ORPHAN | `getCollectionPosts` silently drops IDs not in postHistory | VERIFIED | `collection.service.ts:92-106` `resolvePostsByIds` — only posts found in `byId` map are included; test "gracefully drops orphan IDs" GREEN |
| T-50-PICKER-RACE | All writes batched at `handleDone`; no per-tap service calls | VERIFIED | `CollectionPickerSheet.tsx:122-123` draft state; `handleDone:196-248` computes diff and writes; per-toggle handlers only mutate draft `Set` |
| T-50-SHEET-FLASH | `onOpenCollectionPicker(postId)` called BEFORE `onClose()` | VERIFIED | `LongPressMenu.tsx:110-111` — picker set then close; test `LP-50-07` asserts ordering GREEN |
| T-50-QUOTA | `saveState()` try/catch silently drops on quota exceeded | VERIFIED | `collection.service.ts:84-90` try/catch with comment "localStorage quota exceeded — silently drop (T-50-QUOTA)" |
| T-50-HEADER-PORTAL | No `transform`/`will-change`/`filter`/`contain`/`perspective` on Header ancestors in CollectionDrillInScreen | VERIFIED | Outer container at `CollectionDrillInScreen.tsx:385` uses only `display:flex; flexDirection:column; minHeight:'100%'`; `@keyframes` animation is on child elements, not Header ancestors; CDI-10 test GREEN |
| T-50-PURGE-REGRESSION | `purgeExpired()` call site unchanged — single `getPinnedIds()` call | VERIFIED | `post-history.service.ts:68` — one call; test "purgeExpired call site in post-history.service.ts is UNCHANGED — single getPinnedIds() call" GREEN |
| T-50-SUPPLY-CHAIN | Fuse.js 7.3.0 pinned; no newer patch version | WARNING | `package.json:28` uses `^7.3.0` (caret = accepts patch updates). The context notes "D-13: Fuse.js version pinning" as a researcher concern. `^7.3.0` allows `7.x.x ≥ 7.3.0`. At time of verification no breaking changes have been reported in Fuse.js 7.x. Acceptable risk for a local-first app. |

---

## 4. New TypeScript Errors Introduced by Phase 50

These errors appear in `tsc -b --noEmit` output after Phase 50 and are NOT present in the pre-Phase-50 baseline (commit `5033ba49`):

### GAP-1: `CollectionDrillInScreen.tsx` — useLongPress bind handlers called with event argument

**Lines:** 94, 98, 102, 105
**Error:** `TS2554: Expected 0 arguments, but got 1.`
**Cause:** `useLongPress` hook returns `bind` object with `onPointerDown: start`, `onPointerUp: cancel`, etc. where `start` and `cancel` are `() => void` (zero-arity). `CollectionDrillInScreen.tsx` wraps them in handlers that pass the `React.PointerEvent` argument: `bind.onPointerDown(e)`.

At runtime this is harmless because JavaScript ignores extra arguments. But it violates the TypeScript contract and the project convention (CLAUDE.md §i18n: `tsc -b --noEmit` is the key-correctness gate).

**Fix:** Either (a) update `useLongPress` to accept `(e: PointerEvent) => void` callbacks, or (b) call `bind.onPointerDown()` without the event argument in `CollectionDrillInScreen.tsx`.

### GAP-2: `CollectionDrillInScreen.tsx:321` — `t('common.back')` missing i18n key

**Error:** `TS2345: Argument of type '["common.back"]' is not assignable...`
**Cause:** `common.back` does not exist in `en.json` (or any locale file). The `common` namespace has: `today`, `cancel`, `save`, `delete`, `undo`, `greeting`, `nav`, `action`, `toast`. At runtime, i18next falls back to the raw key string `"common.back"` as the `aria-label`. This is an accessibility regression on the "collection not found" error state.

**Fix:** Add `"back": "Back"` (and translations) to all 4 locale bundles under `common.*`.

### Pre-existing (not a Phase 50 gap):

`SavedScreen.tsx:186` — `TS2322`/`TS2589` on `t(titleKey)` cast in `EmptyState` component. This error exists at `5033ba49` (Phase 50 baseline). Documented in `deferred-items.md`. Not introduced by Phase 50.

---

## 5. Test Coverage Summary

All Phase 50 targeted tests are GREEN (122 passing / 0 failing):

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/services/collection.service.test.mjs` | 15 | 15 PASS |
| `tests/services/library-search.service.test.mjs` | 19 | 19 PASS |
| `tests/services/engagement.service.pinned-ids.test.mjs` | 9 | 9 PASS |
| `tests/services/post-history.purge-collections.test.mjs` | 7 | 7 PASS |
| `tests/components/HighlightedText.test.mjs` | 6 | 6 PASS |
| `tests/components/CollectionPickerSheet.test.mjs` | 11 | 11 PASS |
| `tests/components/FilterPickerSheet.test.mjs` | 6 | 6 PASS |
| `tests/components/LongPressMenu.test.mjs` | 12 (incl. LP-50-07 tests) | 12 PASS |
| `tests/screens/SavedScreen.collections-tab.test.mjs` | 3 | 3 PASS |
| `tests/screens/SavedScreen.search-scope.test.mjs` | 5 | 5 PASS |
| `tests/screens/CollectionDrillInScreen.test.mjs` | 11 | 11 PASS |
| `tests/screens/SavedScreen.test.mjs` | 8 | 8 PASS |
| `tests/events/event-bus.collections-changed.test.mjs` | 3 | 3 PASS |
| `tests/types.collection.test.mjs` | 7 | 7 PASS |
| **TOTAL** | **122** | **122 PASS / 0 FAIL** |

Full suite regression: 1205/1206 (single pre-existing `concept-feed.test.mjs` import error at baseline `5033ba49` — unrelated to Phase 50).

---

## 6. Human Verification Required

### 1. Collection picker sheet opens without blank frame

**Test:** Open HomeScreen, long-press any feed tile, tap the Save (Bookmark) row.
**Expected:** CollectionPickerSheet slides up seamlessly as LongPressMenu dismisses — no blank frame between sheets.
**Why human:** React 19 batching + animation timing at 60fps cannot be confirmed by source-reading.

### 2. Collections tab drill-in navigation

**Test:** Create a collection ("Test Collection"), add one post to it, open `/saved`, tap the Collections tab, tap the "Test Collection" row.
**Expected:** Navigates to `/collections/:id`; Header shows "Test Collection" with kebab icon; post count subtitle is correct.
**Why human:** Route transition, Header portal to document.body, and CollectionDrillInScreen initial data fetch require a running app.

### 3. Search highlights body match past character 60

**Test:** Find a saved post with a long body. Type a word that appears only after the 60th character of the body into the search bar.
**Expected:** The post appears in results. A 120-char snippet centered on the match appears below the title, with the matched word visually highlighted in `--primary-40` background.
**Why human:** Fuse.js `ignoreLocation: true` behavior and `<mark>` CSS rendering require visual confirmation.

### 4. Collection membership pins against purge

**Test:** Add a post to a collection but do NOT globally Save it. Use Force-New-Day (SettingsDataScreen dev button) multiple times to simulate >7 days. Verify the post is still accessible at `/collections/:id`.
**Expected:** Post survives purge; `getCollectionPosts` still resolves it.
**Why human:** Purge simulation via Force-New-Day requires interactive state manipulation and checking postHistoryService behavior.

### 5. Remove-from-collection with Undo

**Test:** Open `/collections/:id`, long-press a post row, tap "Remove from collection."
**Expected:** Menu closes; toast appears with "Removed from {collection name}" and an Undo action. Tapping Undo re-adds the post.
**Why human:** Long-press 480ms timing, conditional 4th row rendering, and Undo action wiring require live interaction.

---

## 7. Anti-Patterns

No `TBD`, `FIXME`, or `XXX` markers found in any Phase 50 source files.

`TODO`/placeholder scan: none found in Phase 50 production files.

---

## 8. Gaps Summary

**1 gap blocking clean TypeScript compilation (BLOCKER by project standards):**

`CollectionDrillInScreen.tsx` introduces 5 new TypeScript errors:
- 4x `TS2554`: pointer event handlers in the `SavedRow` wrapper call `bind.onPointerDown(e)` etc. with an event argument that the `useLongPress` hook's zero-arity callbacks do not accept.
- 1x `TS2345`: `t('common.back')` references a key absent from all 4 locale files. CLAUDE.md §i18n mandates that `tsc -b --noEmit` fails on missing `t()` keys.

These errors do not prevent the app from running (JavaScript strips types; i18next falls back gracefully). However the project's stated quality gate is `tsc -b --noEmit` for key correctness.

**Root cause:** `CollectionDrillInScreen.tsx` was written with pointer-event forwarding to `useLongPress`'s `bind` object in a way that differs from how `useLongPress` is used in `SavedScreen.tsx` (which uses a separate inline timer in `CollectionRow` rather than the hook). The `common.back` key was used without adding it to the locale bundles.

---

## 9. GO / NO-GO Recommendation for Phase 51

**NO-GO pending gap closure on the TypeScript errors.**

Functional delivery for RETRIEVE-01 and RETRIEVE-02 is complete and substantive. All 16 design decisions are reflected in the code. All 9 threat mitigations are verified. 122 Phase 50 targeted tests pass. All 4 locale bundles are parity-complete for Phase 50 strings (except the missing `common.back` key).

**Before advancing to Phase 51:** the executor must:
1. Fix `CollectionDrillInScreen.tsx` pointer handler calls (4 × TS2554).
2. Add `common.back` to all 4 locale bundles and run `tsc -b --noEmit` clean.

Both fixes are small (< 10 lines each) and can be done in a single micro-plan or directly. Once `tsc` passes cleanly, the phase is GO for Phase 51.

---

_Verified: 2026-05-18T10:08:14Z_
_Verifier: Claude (gsd-verifier)_
