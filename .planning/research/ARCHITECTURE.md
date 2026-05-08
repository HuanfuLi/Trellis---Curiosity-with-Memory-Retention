# Architecture Research

**Domain:** Curiosity Feed v2 + Tech-Debt Hardening — Integration into Trellis v1.5
**Researched:** 2026-05-08
**Confidence:** HIGH (all claims derived from direct source-code inspection of the live codebase)

---

## Existing Architecture (Load-Bearing — Do Not Re-Architect)

The following is the production shape as of milestone v1.4 close. All v1.5 features must integrate WITH this structure, not replace it.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  SwipeTabContainer (always-mounted 500vw horizontal strip)                    │
│  HomeScreen  | PlannerScreen | AskScreen | GraphScreen | SettingsScreen       │
│  (useState initializer fires ONCE at boot; navigation = no remount)           │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │ [location.pathname] useEffect resync
                                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  HomeScreen.tsx                                                                │
│  ┌──────────────┐  ┌──────────────────────────────────────────────────────┐   │
│  │  VineProgress│  │  InlineInfoFlow (InfoFlow.tsx)                       │   │
│  │  (quota/     │  │  Single-column flex list, card-slide-in animations   │   │
│  │   explored)  │  │  MemoizedConceptCard per DailyPost                   │   │
│  └──────────────┘  │  ConnectionCard / MilestoneCard                      │   │
│                    │  Pull-up gesture → handleLoad → infiniteScrollService │   │
│                    └──────────────────────────────────────────────────────┘   │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │ calls
                                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  3-LIST PIPELINE  (CLAUDE.md load-bearing — 5+ re-explanations, DO NOT DRIFT) │
│                                                                                │
│  List 1: Daily Concept List                                                    │
│    buildConceptBatch(questions) -> anchor nodes filtered by SM-2 due dates    │
│    weighted: BASE_ENTRIES_PER_CONCEPT=4, x2 if important (ease<1.5 / dying)   │
│    source consumed by flashcard + podcast pipelines too                        │
│                    |                                                           │
│                    v appendToDerivedList(ids) -- dedup on append               │
│  List 2: Derived List (QueueState.derivedList in localStorage)                 │
│    append-only, cyclePosition persisted                                        │
│    walkDerivedList(count, exploredIds) -- lazy-skip explored anchors           │
│    maxSteps = Math.max(count*2, len)  <- DO NOT regress to len*2              │
│                    |                                                           │
│                    v assignStyles (stratified largest-remainder + FY shuffle)  │
│  List 3: Queue (QueueState.posts, max 32, threshold 16)                        │
│    spreadByConcept -> spreadByStyle -> enqueueInterleaved                      │
│    4 posts per swipe (strict per design)                                       │
│    refillQueue guarded by _refillMutex (Promise-mutex, not boolean flag)       │
│    STORAGE_KEY_LIVE + STORAGE_KEY_YESTERDAY (durable cold-start snapshot)      │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │ on post open
                                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  PostDetailScreen.tsx (sub-screen, Header via createPortal to document.body)  │
│  generatePostEssay() -> post-essay.service.ts                                 │
│    chatStream per sourceType: standard/video/news/text-art                    │
│    bodyMarkdown:'' at creation; streamed on open                               │
│  Detector A (scroll 70%) / B (30s dwell) / C (Q&A) / D (YouTube postMessage) │
│  -> dailyReadService.markExplored -> CONCEPT_EXPLORED event                   │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## v1.5 Feature Integration Map

### Feature 1: Pinterest Masonry Layout

**Integration point:** `app/src/components/InfoFlow.tsx` — specifically `InlineInfoFlow`

**Current shape:**
```
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
  {items.map((item, index) => (
    <div key={index} style={{ minHeight: ... }}>
      <MemoizedConceptCard ... />
    </div>
  ))}
</div>
```

**Decision: New component, not a rewrite.**

Extract a `MasonryFeed` component at `app/src/components/MasonryFeed.tsx`. `InlineInfoFlow` continues to own state (videoPlaying, seenPostIds, IntersectionObserver for video stop), event subscriptions (swipeCtx, visibilitychange), and the item-type dispatch (concept/connection/milestone). `MasonryFeed` receives the rendered slot list and handles column layout only.

Rationale: `InlineInfoFlow` carries six load-bearing concerns (video stop on swipe-away, video stop on route change, video stop on scroll-out, swipe gesture integration via SwipeTabContext, animation seeding for new posts, load-more trigger). Rewriting it risks regressions in all six. Column balancing is pure CSS/layout math — it can be isolated.

**Column-balancing logic location:** Inside `MasonryFeed` only. `InlineInfoFlow` passes `items` as a flat ordered array; `MasonryFeed` distributes into two column arrays by measuring or estimating item height.

**Height estimation approach (confidence: MEDIUM):** Real masonry requires measuring rendered heights, which requires a two-pass render or a ResizeObserver per card. For v1.5, use style-based height estimation instead: `video`/`short` = 320px estimate, `image` = 280px estimate, `text-art` = 180px estimate, `news`/`suggestion` = 200px estimate. Place each incoming item in the shorter column. This avoids ResizeObserver complexity and is accurate enough for style-proportional distribution.

**Queue shape change:** None. The 3-list pipeline still produces a flat ordered array from `walkDerivedList`. `spreadByConcept` + `spreadByStyle` still run over the flat batch. `MasonryFeed` re-distributes display order across columns — this is purely a rendering concern, not a data-pipeline concern.

**`spreadByConcept` + `spreadByStyle` implication:** These functions guarantee per-batch style and concept distribution. Masonry's column assignment does NOT need to preserve their exact output order — the display order across both columns combined equals the pipeline's delivery order. Users read both columns roughly top-to-bottom, so the distribution property (no consecutive same-concept, no consecutive same-style) still holds at the perceived reading order as long as items are assigned to columns by height rather than by concept/style bucket.

**`useInfiniteScroll` / pull-up trigger:** `InlineInfoFlow`'s `onLoadMore` prop is already a callback to `HomeScreen.handleLoad`. The pull-up gesture detection lives in `HomeScreen.tsx` (touch handlers on the scroll container), not in `InlineInfoFlow`. This is unaffected by masonry. The `containerRef` in `useInfiniteScroll` attaches to the outer scroll container in `HomeScreen`, not to the feed component — also unaffected.

**Android WebView / `position:fixed` rule:** Masonry columns use `display: grid` or two `flexDirection: column` children of a flex row. Neither creates a new containing block. The existing header portal pattern is unaffected.

**Data flow for masonry:**
```
HomeScreen: dailyPosts[] (flat, unchanged)
  -> useMemo: items: InfoFlowItem[] (flat, unchanged)
    -> InlineInfoFlow(items) (unchanged -- owns video/event state)
      -> MasonryFeed(items)  <- NEW
        [leftCol, rightCol] = distributeByHeight(items)
        renders two flex columns side by side
```

---

### Feature 2: Engagement-Aware Walker

**Integration points:** `app/src/services/daily-read.service.ts`, `app/src/services/post-queue.service.ts` (walkDerivedList), `app/src/types/index.ts` (AppEvent union), `app/src/services/concept-feed.service.ts` (refillQueue)

**New service: `app/src/services/engagement.service.ts`**

Do NOT extend `dailyReadService`. Reasons:
1. `dailyReadService` is date-scoped (resets daily). Engagement state has mixed persistence: `saved` is cross-day-permanent, `dismissed` is cross-day-persistent (durable skip), `liked` is per-post (survives across days as a marker on the post).
2. `dailyReadService` already has a focused contract (`exploredAnchors`, `creditAwarded`). Adding engagement signals widens its scope past its testable boundary.
3. The walker in `post-queue.service.ts` calls `dailyReadService.getExploredAnchors()` at walk time. Adding a new skip-list for dismissed anchors requires a clean parallel call surface.

**`engagement.service.ts` public contract:**

```typescript
// localStorage key: 'trellis_engagement_v1'
// permanent cross-day, no auto-reset
engagementService.savePost(postId: string): void
engagementService.unsavePost(postId: string): void
engagementService.dismissAnchor(anchorId: string): void
engagementService.undismissAnchor(anchorId: string): void
engagementService.likePost(postId: string): void
engagementService.unlikePost(postId: string): void
engagementService.isSaved(postId: string): boolean
engagementService.isDismissed(anchorId: string): boolean
engagementService.isLiked(postId: string): boolean
engagementService.getSavedPostIds(): string[]
engagementService.getDismissedAnchorIds(): string[]  // consumed by walker
```

**Walker integration — dismissed vs. explored:**

`walkDerivedList` currently receives `exploredIds: string[]`. Extend its signature to accept an optional second skip list:

```typescript
walkDerivedList(count: number, exploredIds: string[], dismissedIds?: string[]): string[]
```

The lazy-skip predicate becomes: `if (exploredSet.has(id) || dismissedSet.has(id)) continue`. This is additive — the existing lazy-skip logic is unchanged, dismissed anchors are a second exclusion list. Default `dismissedIds = []` preserves all existing call sites.

Call site update in `refillQueue` (concept-feed.service.ts):
```typescript
const exploredIds = dailyReadService.getExploredAnchors();
const dismissedIds = engagementService.getDismissedAnchorIds();
const batch = postQueueService.walkDerivedList(count, exploredIds, dismissedIds);
```

**Saved concepts — do NOT add extra weight in derived list.**

`buildConceptBatch` operates on anchor IDs; a post is saved, not an anchor. Saved = user already engaged positively, not a signal of forgetting. The `isImportant` weight path (ease < 1.5 OR dying/falling/dead) already handles "user needs more of this concept." Instead, surface saved posts as a browsable collection (separate screen or Settings tab). The walker never needs to know about saves.

**Event-bus signals — extend vs. new:**

CLAUDE.md rule: "one signal per semantic event." `CONCEPT_EXPLORED` = user read/watched content. Dismiss = user explicitly does not want to see this concept. These are distinct user intents — do not extend `CONCEPT_EXPLORED`.

Add ONE new event to the AppEvent union in `src/types/index.ts`:

```typescript
| { type: 'ANCHOR_DISMISSED'; payload: { anchorId: string; permanent: boolean } }
```

Subscribers: `HomeScreen` (filter dismissed post from `dailyPosts` local state). No subscription needed in `postQueueService` — `dismissedAnchorIds` is read synchronously from `engagementService` at walk time.

For `liked` and `saved`: no event-bus needed in v1.5. These are local state mutations that update UI via `engagementService` getter calls after mutation. No cross-screen broadcast needed.

**UI integration — where engagement controls render:**

Add an action row to `ConceptCard` in `InfoFlow.tsx` (bottom of each card): like, save, dismiss icons. On dismiss: call `engagementService.dismissAnchor(anchorId)` + emit `ANCHOR_DISMISSED`. `HomeScreen` subscribes to `ANCHOR_DISMISSED` and filters the dismissed post out of `dailyPosts`.

---

### Feature 3: Source Diversity Hook Point

**Integration points:** `app/src/services/concept-feed.service.ts` (news branch of `generatePostBatch`, video/short branches), new leaf module.

**Decision: Pre-filter at Tavily/YouTube call site, not at derived-list build time, not at display time.**

Rationale:
- Display-time filtering wastes LLM tokens on posts that get discarded.
- Derived-list build time is too early — we don't know which sources will be fetched until style assignment says "this concept gets a news post."
- The Tavily call in `generatePostBatch`'s news branch already has the per-concept query. A diversity filter at this point can check previously-fetched domains for this concept and bias toward underrepresented domains.

**New leaf module: `app/src/services/source-diversity.ts`**

```typescript
// Session-scoped in-memory state. Cleared on explicit reset() or day boundary.
// No persistence — source diversity is a per-session concern, not cross-day.

filterForDiversity(
  results: WebSearchResult[],
  conceptId: string,
  maxPerDomain?: number,   // default 2
): WebSearchResult[]

recordServedDomain(conceptId: string, domain: string): void

scoreSource(result: WebSearchResult): number   // domain quality signal, 0-1

reset(): void   // called on day boundary, matching concept-feed-dedup pattern
```

Call site: in `generatePostBatch`'s news branch, after Tavily returns results, before constructing the `DailyPost` shell. Pattern mirrors `hasSeenVideoId` / `addSeenVideoId` from `concept-feed-dedup.ts`.

**YouTube source diversity:** Apply to `YouTubeSearchResult` in the video/short branches — track served `channelId` per concept, prefer underrepresented channels. Extend `source-diversity.ts` with parallel functions or keep in `concept-feed-dedup.ts` (existing file for videoId dedup).

**Leaf-module constraint:** `source-diversity.ts` must have zero imports from `settings.service.ts` / `locales/index.ts` chains so `node --test` can import it directly. Session state lives in module-level Maps.

---

### Feature 4: Richer Essay Variants

**Integration point:** `app/src/services/post-essay.service.ts` — `generatePostEssay` dispatcher and `generateStandardEssay`.

**Decision: Same service, different system prompts + token budgets. No new service.**

Rationale: A new service would require `PostDetailScreen` to branch on which service to call. The existing dispatcher (`generatePostEssay` branches on `sourceType` / `presentationStyle`) is the right extension point — new depth variants fit naturally alongside existing sourceType variants.

**Extension pattern:**

```typescript
// Extend EssayOptions:
export interface EssayOptions {
  signal?: AbortSignal;
  depth?: 'standard' | 'deep';   // default: 'standard'
}
```

Inside `generateStandardEssay`, branch on `options?.depth === 'deep'` to use an alternate system prompt with:
- Word target: 400-600 words vs. current 200-350
- Explicit citation format instruction (inline `[1]` markers tied to `post.newsMeta.sources` for news posts)
- Required structure: concept explanation -> real-world example -> why it matters

**Token budget handling for longer essays:** Add explicit `maxTokens: 1200` to the stream options for deep essays (the `serviceName` options bag already accepts this). This prevents mid-stream truncation on providers that default to 512 or 1024 tokens.

**Abort signal:** `EssayOptions.signal` already threads through to every `chatStream` call. No changes needed.

**When to activate deep mode:** `PostDetailScreen.tsx` decides. Add a "Deep dive" button that re-triggers `generatePostEssay` with `{ depth: 'deep', signal: controller.signal }` after resetting the markdown state. The existing `bodyMarkdown` streaming state already supports re-streaming.

**Citation render polish:** `patchPostEssayInCache` already patches `bodyMarkdown` into cache after streaming. `Markdown.tsx` (rehype-raw + rehype-sanitize) already renders `<sup>` tags. Citation styling is a CSS-only change in `PostDetailScreen.tsx`.

---

### Feature 5: i18n Leaf-Module Refactor

**Problem:** 5 services currently import from `src/locales/index.ts` directly for toast calls. `src/locales/index.ts` imports `en.json` with a JSON import assertion that fails under `node --test` (`ERR_IMPORT_ATTRIBUTE_MISSING`). This blocks test coverage for all 5 services and closes 10 v1.4 carried test failures.

**Affected files:**
- `src/services/flashcard.service.ts`
- `src/services/session.service.ts`
- `src/services/question.service.ts`
- `src/services/scheduler.service.ts`
- `src/services/podcast.service.ts`
- `src/services/youtube-locale-url.ts` (imports `i18next` directly — same failure chain)

**Decision: Extract `app/src/lib/i18n-leaf.ts` as an injectable shim, NOT a new i18n runtime.**

```typescript
// app/src/lib/i18n-leaf.ts
// Leaf shim: zero imports from locales chain.
// Services call t() from here; actual i18next instance injected at app boot.
// Under node --test: inject a passthrough stub.

let _t: (key: string, opts?: Record<string, unknown>) => string = (key) => key;

export function t(key: string, opts?: Record<string, unknown>): string {
  return _t(key, opts);
}

export function injectI18nRuntime(
  fn: (key: string, opts?: Record<string, unknown>) => string
): void {
  _t = fn;
}
```

**At app boot** (`app/src/main.tsx`, after i18n init completes):
```typescript
import { injectI18nRuntime } from './lib/i18n-leaf';
import i18n from './locales';
injectI18nRuntime((key, opts) => i18n.t(key, opts));
```

**In each affected service:** Replace `import i18n from '../locales/index.ts'` + `i18n.t(...)` with `import { t } from '../lib/i18n-leaf'` + `t(...)`.

**In tests:** Import `injectI18nRuntime` and inject a key-passthrough stub:
```javascript
import { injectI18nRuntime } from '../../src/lib/i18n-leaf.ts';
injectI18nRuntime((key) => key);  // returns the key as the value
```

This is the same pattern used by `feed-spread.ts` and `refill-mutex.ts` (zero transitive deps, directly importable under `node --test`).

**This refactor is a prerequisite (Wave 0) for any new services that need toast calls, since those new services must also be leaf-importable.**

---

### Feature 6: Engagement Local Store

**Decision: New `engagement.service.ts`. Do not extend `dailyReadService`.**

**localStorage key:** `'trellis_engagement_v1'` (namespaced per Trellis convention, versioned for future schema migration).

**Cross-day persistence model:**
- `savedPostIds`: permanent, never auto-cleared. User bookmarks survive app restarts.
- `dismissedAnchorIds`: permanent. User said "don't show me this" — reset only via explicit "undo dismiss" or Clear All Data. The walker uses this as a durable skip list.
- `likedPostIds`: permanent per-post marker.

No date-based reset logic (unlike `dailyReadService`). The service reads/writes localStorage directly on each call — no in-memory cache layer needed since operations are infrequent.

**Testability:** `engagement.service.ts` must be a leaf module — zero imports from settings.service / locales chains. State is read/written via `localStorage.getItem/setItem`. Tests stub localStorage via `globalThis.localStorage = { getItem: ..., setItem: ... }`, matching the existing `post-queue.service.ts` test pattern.

---

## Data Flow Changes (v1.5 additions in context of existing flows)

### Engagement dismiss flow
```
User taps dismiss on ConceptCard (InfoFlow.tsx)
  -> engagementService.dismissAnchor(anchorId)
  -> eventBus.emit({ type: 'ANCHOR_DISMISSED', payload: { anchorId, permanent: true } })
  -> HomeScreen subscribes: setDailyPosts(prev => prev.filter(...anchorId does not match...))
  -> Next refillQueue cycle: walkDerivedList(count, exploredIds, dismissedIds)
       skips dismissed anchor via lazy-skip (same mechanism as explored)
```

### Masonry layout flow
```
HomeScreen: dailyPosts[] (unchanged production data)
  -> buildItems(dailyPosts, questions, connectionCards) -> InfoFlowItem[] (unchanged)
  -> InlineInfoFlow(items) (unchanged -- owns video/event state)
    -> MasonryFeed(items) (NEW -- renders two columns)
      distributeByHeight(items) -> [leftCol, rightCol]
      leftCol rendered as flex column
      rightCol rendered as flex column
      both columns side by side in a flex row
```

### Richer essay flow
```
User taps "Deep dive" on PostDetailScreen
  -> controller.abort() on any in-progress stream
  -> reset bodyMarkdown state
  -> generatePostEssay(post, questions, { depth: 'deep', signal: newController.signal })
     yields chunks -> setBodyMarkdown accumulates (same as standard)
  -> generateEssayMeta(post, bodyMarkdown, options)
  -> patchPostEssayInCache(post.id, essay) (same as today)
```

### Source diversity flow
```
refillQueue -> generatePostBatch -> news branch
  -> webSearch(query, { topic: 'news' }) -> results[]
  -> filterForDiversity(results, conceptId, 2) -> filtered[]   <- NEW
  -> recordServedDomain(conceptId, domain)                       <- NEW
  -> construct DailyPost shell with bodyMarkdown: ''
```

---

## New File Inventory

| File | Type | Purpose | Dependency constraint |
|------|------|---------|----------------------|
| `src/components/MasonryFeed.tsx` | NEW component | Two-column masonry layout renderer | No new deps beyond `InfoFlowItem` type |
| `src/services/engagement.service.ts` | NEW service | save/dismiss/like state, cross-day localStorage | Leaf module — no settings/locales imports |
| `src/services/source-diversity.ts` | NEW leaf module | Domain dedup + quality scoring for news/video | Leaf module — no settings/locales imports |
| `src/lib/i18n-leaf.ts` | NEW leaf shim | Injectable t() for services testable under `node --test` | Zero transitive deps on locales chain |

| File | Type | Change summary |
|------|------|---------------|
| `src/components/InfoFlow.tsx` | MODIFIED | `InlineInfoFlow` delegates rendering to `MasonryFeed`; add engagement action row to `ConceptCard` |
| `src/services/post-queue.service.ts` | MODIFIED | `walkDerivedList` gains optional `dismissedIds` param (default []) |
| `src/services/post-essay.service.ts` | MODIFIED | `EssayOptions` gains `depth` field; `generateStandardEssay` branches on depth |
| `src/services/concept-feed.service.ts` | MODIFIED | `refillQueue` passes `dismissedIds` to walker; news branch calls `filterForDiversity` |
| `src/types/index.ts` | MODIFIED | Add `ANCHOR_DISMISSED` to `AppEvent` union |
| `src/screens/HomeScreen.tsx` | MODIFIED | Subscribe to `ANCHOR_DISMISSED`; re-sync `engagementService` state on navigation |
| `src/screens/PostDetailScreen.tsx` | MODIFIED | "Deep dive" button triggers `depth: 'deep'` stream |
| `src/services/flashcard.service.ts` | MODIFIED | i18n-leaf refactor: replace `i18n.t` with `t` from i18n-leaf |
| `src/services/session.service.ts` | MODIFIED | i18n-leaf refactor |
| `src/services/question.service.ts` | MODIFIED | i18n-leaf refactor |
| `src/services/scheduler.service.ts` | MODIFIED | i18n-leaf refactor |
| `src/services/podcast.service.ts` | MODIFIED | i18n-leaf refactor |
| `src/services/youtube-locale-url.ts` | MODIFIED | i18n-leaf refactor |
| `src/main.tsx` | MODIFIED | `injectI18nRuntime` call after i18n init |

---

## Build Order (Dependency-Respecting)

### Wave 0: Unblocking tech-debt (must complete before new service tests)

These close the 10 carried test failures and establish the leaf-module foundation that all new service tests depend on. Nothing in Wave 1+ can be fully tested without Wave 0 complete.

1. **i18n leaf-module refactor** — create `src/lib/i18n-leaf.ts`, update 6 service files + `main.tsx`. Closes `ERR_IMPORT_ATTRIBUTE_MISSING` for `flashcard.service`, `session.service`, `question.service`, `scheduler.service`, `podcast.service`, `youtube-locale-url`. Tests for these services become writable under `node --test`.
2. **v1.4 carry-over cleanup** — VALIDATION drift (34/35 flip, 35 status normalize), ROADMAP plan-list bullets (36-14 + 36-15), CLAUDE.md `echolearn_*` doc-drift, 33-HUMAN-UAT-1/2 device retest. No code changes — documentation + device verification. Parallel with item 1.

### Wave 1: Foundation services (no UI dependencies)

These can be built and fully tested before any screen changes. Each is a leaf module — fully independently testable.

3. **`engagement.service.ts`** — new leaf module. Write RED tests first (per CLAUDE.md lesson #2). Cover: save/unsave idempotency, dismiss/undismiss, cross-day persistence (no auto-reset), `getDismissedAnchorIds()` completeness. Then implement to GREEN.
4. **`source-diversity.ts`** — new leaf module. Tests: `filterForDiversity` deduplication by domain, `maxPerDomain` enforcement, `scoreSource` returns 0-1 range, `recordServedDomain` updates state consumed by filter.
5. **`walkDerivedList` extension** (`post-queue.service.ts`) — add optional `dismissedIds: string[]` param with default `[]`. Additive — all existing tests continue passing. Add regression tests for dismissed-skip behavior (mirrors existing explored-skip tests).
6. **AppEvent union extension** (`src/types/index.ts`) — add `ANCHOR_DISMISSED`. TypeScript change only; verified by `tsc --noEmit`.

### Wave 2: Service integration (requires Wave 1)

7. **`concept-feed.service.ts` wiring** — `refillQueue` passes `engagementService.getDismissedAnchorIds()` to `walkDerivedList`; news branch calls `filterForDiversity`. Integration smoke test: verify dismissed anchor is absent from walker output.
8. **`post-essay.service.ts` depth extension** — `EssayOptions.depth`, deep prompt variant, `maxTokens: 1200` for deep. Unit tests for prompt construction (assert deep system prompt contains word-target and citation instructions).

### Wave 3: UI layer (requires Wave 1-2)

9. **`MasonryFeed.tsx`** — new component. Test with mock `InfoFlowItem` array: assert items are distributed across two columns, no item appears in both columns, left+right combined equals input. `InlineInfoFlow` delegates its item rendering to `MasonryFeed`.
10. **Engagement UI in `ConceptCard` / `InfoFlow.tsx`** — action row (like/save/dismiss icons). Dismiss emits `ANCHOR_DISMISSED`. `HomeScreen` subscribes and filters `dailyPosts`.
11. **`PostDetailScreen.tsx` deep-dive button** — re-triggers `generatePostEssay` with `{ depth: 'deep', signal: newController.signal }`.

### Wave 4: Broader hygiene (parallel within wave)

12. tsc strictness audit, dependency-version sweep, dead-code sweep, perf profiling, project-wide TODO/FIXME triage, operator-note bugs. These are independent of each other and can be done in parallel.

---

## Architectural Constraints (Invariants That Must Not Break)

**3-list pipeline shape.** `buildConceptBatch` -> `appendToDerivedList` -> `walkDerivedList` -> `assignStyles` -> `generatePostBatch` -> `enqueueInterleaved`. No new list, no bypass, no rebuild-from-scratch. Engagement features extend the walker's skip predicate only.

**Leaf-module pattern.** Any new service that needs `node --test` coverage must have zero transitive imports reaching `src/locales/index.ts`. If a new service needs `t()`, import from `src/lib/i18n-leaf.ts`, not from `src/locales`. This applies to `engagement.service.ts`, `source-diversity.ts`, and any future service added in v1.5.

**One signal per semantic event.** `CONCEPT_EXPLORED` = user read/watched content. `ANCHOR_DISMISSED` = user explicitly dismissed. Do not conflate. Do not add `ENGAGEMENT_UPDATED` as a catch-all.

**Always-mounted screen resync pattern.** Any new engagement state consumed by `HomeScreen` (or any other always-mounted screen) that can change while another screen is in the foreground MUST be re-read in a `[location.pathname]` `useEffect`. Established in `HomeScreen.tsx:181-201`.

**Header portal pattern.** `MasonryFeed.tsx` renders inside `InlineInfoFlow` inside `HomeScreen` inside `SwipeTabContainer`. No `position: fixed` elements. No `transform`/`will-change`/`filter` CSS on any ancestor of `Header`.

**`bodyMarkdown: ''` at creation.** Any new post type that defers body generation to on-open MUST set `bodyMarkdown: ''`. Storing preview text in `bodyMarkdown` makes `PostDetailScreen` skip the streamer.

**Test-first for new services.** Per CLAUDE.md lesson #2: write RED tests for `engagement.service.ts`, `source-diversity.ts`, and `walkDerivedList` extension BEFORE implementing. The Phase 36 lesson (integration-smoke false confidence at small N) applies — write tests that catch the exact failure mode, not just "the call exists."

---

## Anti-Patterns (v1.5 Specific)

**Anti-Pattern 1: Splicing the derived list on dismiss.**
What people do: when a user dismisses a concept, remove it from `derivedList` in `QueueState` and `save()`.
Why wrong: physical splicing corrupts `cyclePosition` — the saved index no longer points to the same conceptId. This is Pitfall 1 from CLAUDE.md "Concept Feed Generation Pipeline."
Do this instead: add dismissed IDs to `engagementService`. Walker lazy-skips them via the `dismissedIds` parameter at walk time. Never splice the derived list.

**Anti-Pattern 2: Adding `ENGAGEMENT_UPDATED` as a broadcast event.**
What people do: emit a generic `ENGAGEMENT_UPDATED` event on every like/save/dismiss so components can re-render.
Why wrong: violates "one signal per semantic event." Components that subscribe to this mega-event re-render on signals they don't care about.
Do this instead: `ANCHOR_DISMISSED` only (cross-screen concern). Liked/saved update via `engagementService` getters after mutation — no event needed for local UI state.

**Anti-Pattern 3: Moving column distribution logic into `spreadByConcept`.**
What people do: modify `spreadByConcept` to output two arrays (left column, right column) instead of a flat array.
Why wrong: `spreadByConcept` is a leaf module with 7 regression tests. Its output contract is a reordered single array. Column distribution is a display concern; the pipeline contract is a data ordering concern. Coupling them makes both harder to test.
Do this instead: `spreadByConcept` outputs flat array -> `MasonryFeed` distributes it into two column arrays.

**Anti-Pattern 4: Importing `i18next` directly in new services.**
What people do: `import i18next from 'i18next'` in a new service to get `i18next.t()`.
Why wrong: same `ERR_IMPORT_ATTRIBUTE_MISSING` failure chain that blocks `node --test` coverage.
Do this instead: `import { t } from '../lib/i18n-leaf'`.

**Anti-Pattern 5: Eager body generation for new post types.**
What people do: generate `bodyMarkdown` content during `refillQueue` for a new post type to avoid on-open latency.
Why wrong: wastes tokens on posts the user may never open. Breaks the `PostDetailScreen` streamer guard (`bodyMarkdown === ''` check). Causes the news regression from commit `3263af4e` all over again.
Do this instead: set `bodyMarkdown: ''` at creation. Stream on open in `post-essay.service.ts`.

**Anti-Pattern 6: Adding saved-post weight into `buildConceptBatch`.**
What people do: when a post is saved, look up its anchorId and increase that anchor's entry count in `buildConceptBatch`.
Why wrong: couples engagement state to the feed pipeline. Saved = user already engaged positively, not a signal of urgency. The `isImportant` weight already handles "needs reinforcement" via SM-2 signals (ease < 1.5, dying/falling/dead leaf state).
Do this instead: surface saved posts as a browsable collection. Keep `buildConceptBatch` pure (only SM-2 signals determine importance weight).

---

*Architecture research for: Trellis v1.5 Curiosity Feed v2 + Tech-Debt Hardening*
*Researched: 2026-05-08*
