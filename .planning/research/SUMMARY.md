# Project Research Summary

**Project:** Trellis v1.5 — Curiosity Feed v2 + Tech-Debt Hardening
**Domain:** Mobile-first AI-powered learning feed — masonry layout, engagement signals, source diversity, richer essays, tech-debt hardening
**Researched:** 2026-05-08
**Confidence:** HIGH

## Executive Summary

Trellis v1.5 layers four orthogonal capability improvements onto an already-working 3-list pipeline (daily concept list → derived list → 32-max cyclic queue) without replacing any load-bearing pipeline code. The correct mental model is **additive integration**, not redesign: new leaf modules wire at specific call sites (walker extension, Tavily pre-filter, essay options), new UI components delegate to existing state owners, and new events extend the AppEvent union rather than replacing existing signals. The research shows this is achievable with zero new production dependencies (after the masonry reconciliation below), zero new SQLite schema changes for engagement, and zero new dev dependencies.

The single most consequential decision in v1.5 is masonry layout strategy. Three researchers disagreed. The recommendation after full reconciliation is **CSS `column-count: 2` with `break-inside: avoid`** — not `@virtuoso.dev/masonry`, not `masonic`. The reasoning: Trellis's SwipeTabContainer uses a per-slot `overflow: auto` scroll container, not `window` scroll. `@virtuoso.dev/masonry`'s `useWindowScroll={true}` mode targets `document` scroll, not per-element scroll roots, and would require invasive rewiring of the `useInfiniteScroll` / `containerRef` setup. The queue maximum of 32 posts means at most 32 DOM nodes are ever live — well below any virtualization threshold where JS overhead pays off. CSS `column-count: 2` is universally supported, does not rebalance on image load (no ResizeObserver cascade, no cyclePosition corruption), preserves the always-mounted HomeScreen slot's scroll position automatically on back-navigation, and is compatible with framer-motion card entrance animations on individual leaf `<motion.div>` nodes without creating containing blocks on scroll ancestors.

The second most consequential decision is build order. Wave 0 (i18n leaf-module refactor) is an unconditional prerequisite: it closes 10 carried test failures and establishes the leaf-module foundation that all new service tests depend on. No new services added in v1.5 can have full `node --test` coverage without Wave 0 complete. Waves 1–4 proceed in strict dependency order: foundation leaf services → service integration → UI layer → hygiene sweep.

---

## Masonry Layout Reconciliation

This section documents the explicit reconciliation required across the three conflicting researcher recommendations.

### The Conflict

| Researcher | Recommendation | Primary Argument |
|-----------|----------------|-----------------|
| STACK.md | `@virtuoso.dev/masonry` v1.4.3 | Virtualization, auto-sizing, `useWindowScroll`, active maintenance |
| FEATURES.md | `masonic` | Red-black interval tree, ResizeObserver-aware, ~40-50 DOM nodes |
| PITFALLS.md | CSS `column-count: 2` | No rebalance on image load, universal support, no cyclePosition corruption |

### Resolution: CSS `column-count: 2`

**`@virtuoso.dev/masonry` is rejected on architectural grounds.** The claim that `useWindowScroll={true}` works with Trellis's per-screen `overflow: auto` container is incorrect. Virtuoso's window-scroll mode attaches its sentinel IntersectionObserver relative to `document`, not relative to the slot's scroll root. Trellis's scroll containers live inside SwipeTabContainer slots — they are NOT the document scroll root. Rewiring this would require changing `useInfiniteScroll.ts` and HomeScreen's `containerRef` model away from the always-mounted slot pattern, introducing fragility near Phase 36-14's resync logic. Additionally: 32 DOM nodes do not justify the overhead of a virtualizing renderer.

**`masonic` is rejected on maintenance and integration grounds.** STACK.md's audit is correct: masonic's last publish is ~12 months stale. More critically, masonic uses absolute positioning for column placement — on `translateX` transition within SwipeTabContainer, absolute-positioned children recalculate bounding boxes, which can trigger the resize-handler cascade described in PITFALLS.md Pitfall 6 and CLAUDE.md's SwipeTabContainer `resync()` early-return guard.

**CSS `column-count: 2` is adopted with the following implementation constraints:**
- Each card container gets `break-inside: avoid` so cards are never split across columns.
- Column fill order is top-to-bottom within each column, left-column-first reading order — acceptable because no card has positional semantics relative to another.
- Image `onLoad` does NOT trigger any column recalculation (CSS multi-column is static after render).
- framer-motion card entrance animations use `<motion.div>` per card (leaf node), NOT on the scroll container or InfoFlow root. `will-change: transform` on leaf cards is safe — it does not affect ancestor containing blocks.
- `MasonryFeed.tsx` is still extracted as a named component (ARCHITECTURE.md's recommendation) so InlineInfoFlow delegates rendering while retaining ownership of video/event state. MasonryFeed receives a flat ordered array and renders it via `column-count: 2` CSS — it contains zero JS column-distribution logic.
- Scroll-position restoration is automatic: the always-mounted HomeScreen slot's DOM is never destroyed, so `scrollTop` survives back-navigation without any ref-save logic.
- No new production dependencies required. Zero.

---

## Key Findings

### Recommended Stack

The locked baseline (React 19.2.0, TypeScript 5.9.3, Vite 7.3.1, Tailwind CSS 4.2.1, Capacitor 8.1.0, framer-motion 12.38.0) requires no new production dependencies for the core v1.5 features after the masonry reconciliation above.

**Core technologies for new v1.5 surfaces:**
- `localStorage ('trellis_engagement_v1')`: engagement state — same pattern as `trellis_post_queue`, synchronous read/write, no IndexedDB or SQLite extension needed
- `CSS column-count: 2` + `break-inside: avoid`: masonry layout — no library, no dependency
- `ReactMarkdown components` prop overrides (`sup`, `a`, `section`): citation rendering — no new remark/rehype plugin; `remark-gfm` v4 already owns GFM footnotes
- Bundled `Map<string, number>` (~200 entries): source domain-tier scoring — compiled TS const, zero runtime cost, no network calls
- `post-essay.service.ts` `EssayOptions.depth` flag: richer essays — same service, different prompt and token budget

**Version bumps (safe within current major):**
- Capacitor 8.1.0 → 8.3.1: `npm update @capacitor/*` (no 8.x breaking changes)
- i18next 26.0.5 → 26.0.10: breaking changes in v26 do not affect Trellis usage patterns
- react-router-dom 7.13.1 → 7.15.0: minor/security only
- typescript-eslint, eslint, eslint-plugin-react-hooks: safe minor update

**Held back (explicit hold decisions):**
- Vite: stay on `^7.3.x` — Vite 8 is a Rolldown/Oxc rewrite with breaking config changes that require a dedicated migration sprint
- TypeScript: stay on `~5.9.3` (tilde-pinned) — TS 6.0's `--strictInference` needs an audit pass before enabling; this is a tech-debt-sweep task
- lucide-react: stay on `^0.575.0` — 1.x removes brand icons; requires an explicit icon audit sprint
- framer-motion: stay on `^12.38.0` — the `motion` package rename is mechanical but broad; defer to v1.6

### Expected Features

**Must have (table stakes — launch blockers):**
- 2-column masonry layout with `break-inside: avoid` card containers
- Scroll-position restoration (automatic via always-mounted slot; no code required)
- Save / bookmark posts (`engagementService.savePost` + bookmark icon on tile and detail)
- Dismiss / "not interested" (`engagementService.dismissAnchor` + `walkDerivedList` skip extension)
- Loading skeleton tiles during refill (220px fixed-height placeholders to prevent layout-shift jank)
- "End of content" state (already partially wired via `allExplored` guard — needs UI polish)
- Teaser → full essay progressive disclosure (`EssayOptions.depth: 'deep'` path in `post-essay.service.ts`)

**Should have (competitive differentiators — v1.5.x):**
- Like / heart per post (`engagementService.likePost`, localStorage, no pipeline touch)
- Graph-derived social proof ("N connections" micro-label on tile, computed from `candidatePack` at queue-fill time)
- Per-concept domain rotation (`exclude_domains` on repeated Tavily calls; `usedDomains` tracked per anchor)
- Tighter Tavily source grounding (2-3 snippets passed to essay prompt, not just `sources[0].snippet`)
- "Less of this" style signal (`feedPreferences.service.ts` adjusting STYLE_WEIGHTS read by `style-assignment.ts`)

**Defer (v1.6+):**
- "Trending in your graph" shelf (requires SQLite review history aggregation)
- Tap-to-expand overlay (architectural change to PostDetailScreen navigation model; replaces 4 detectors)
- Media-type mixing per concept (requires DerivedListEntry style-annotation system)
- Citation render polish as a standalone phase (pure UI; not launch-blocking)
- Pull-to-refresh gesture (low priority; calls `refillQueue` behind mutex)

**Anti-features (deliberately not building):**
- Horizontal swipe to dismiss: gesture conflict with SwipeTabContainer — use long-press contextual menu
- Engagement counts influencing SM-2 scheduling: like/save is not equivalent to recall success; conflating them corrupts the spaced-repetition model
- Runtime LLM translation: prohibited by CLAUDE.md
- Near-real-time "others explored" signals: requires backend, violates local-first constraint

### Architecture Approach

All v1.5 features integrate with the existing 3-list pipeline as additive extensions at specific seams. `MasonryFeed.tsx` is a new rendering component that InlineInfoFlow delegates to, leaving InlineInfoFlow's six load-bearing concerns (video stop on swipe-away, video stop on route change, video stop on scroll-out, swipe gesture integration, animation seeding, load-more trigger) completely untouched. `engagement.service.ts` is a leaf module with a defined public contract; it does NOT extend `dailyReadService` (different persistence semantics) and does NOT extend `postQueueService`. `source-diversity.ts` is a session-scoped leaf module inserted at the Tavily call site inside `generatePostBatch`, never inside derived-list build or at display time.

**Major new components:**
1. `src/lib/i18n-leaf.ts` — injectable t() shim that breaks the `src/locales/index.ts` import chain for 6 service files, closing 10 carried test failures (Wave 0 prerequisite)
2. `src/services/engagement.service.ts` — leaf module: save/dismiss/like state, cross-day localStorage, `getDismissedAnchorIds()` consumed by walker; no date-based reset (saves/likes are permanent; dismissed anchors reset via explicit undo or Clear All Data)
3. `src/services/source-diversity.ts` — session-scoped leaf: `filterForDiversity`, `recordServedDomain`, `scoreSource`; synchronous in-memory Maps; `reset()` called on day boundary
4. `src/components/MasonryFeed.tsx` — CSS `column-count: 2` renderer; receives flat `InfoFlowItem[]` from InlineInfoFlow; zero JS column-distribution logic; no new dependencies

**Key modified files:**
- `src/services/post-queue.service.ts`: `walkDerivedList` gains optional `dismissedIds?: string[]` param (default `[]`); additive, all existing call sites preserved
- `src/services/post-essay.service.ts`: `EssayOptions` gains `depth?: 'standard' | 'deep'`; `generateStandardEssay` branches on depth; `bodyMarkdown.slice(0, 2000)` cap raised to 4000 before essay lengthening
- `src/services/concept-feed.service.ts`: `refillQueue` passes `engagementService.getDismissedAnchorIds()` to walker; news branch calls `filterForDiversity`
- `src/types/index.ts`: add `ANCHOR_DISMISSED` to AppEvent union (one event, not a catch-all `ENGAGEMENT_UPDATED`)
- `src/screens/HomeScreen.tsx`: subscribe to `ANCHOR_DISMISSED`; sibling `[location.pathname]` effect re-syncs engagement state (Phase 36-14 canonical pattern)
- `src/screens/settings/SettingsDataScreen.tsx`: `handleForceNewDay` calls `engagementService.reset()` alongside existing resets
- 6 service files + `main.tsx`: i18n-leaf refactor (Wave 0)

### Critical Pitfalls

1. **Dismiss wired to `markExplored` pollutes vine credits** — dismiss and explored are semantically distinct: dismissal = rejection, explored = completion. Wire dismiss to `engagementService.dismissAnchor()` + `ANCHOR_DISMISSED` event only. Never call `markExplored` or emit `CONCEPT_EXPLORED` from a dismiss handler. Write a source-reading test asserting this anti-wire does not exist.

2. **Engagement state not reset on Force-New-Day** — `handleForceNewDay` in `SettingsDataScreen` must call `engagementService.reset()`. Missing this causes dismissed anchors to carry over and stale annotations to persist. The triple-defense applies: (a) handler mutates storage, (b) service rejects stale state on load, (c) always-mounted HomeScreen re-syncs on `[location.pathname]` effect.

3. **Source diversity domain lookup inside `_refillMutex.run()`** — any async or slow-sync lookup inside the refill mutex extends the lock time beyond LLM-latency-sized thresholds. Domain reputation lookup must be synchronous O(N_results) scan over a bundled allowlist. No network calls inside the mutex. Add a fallback: if all Tavily results are filtered by the blocklist, allow the lowest-blocked domain to prevent silent zero-posts-for-concept failures.

4. **Richer essays break the AbortController contract** — every new async call added to `PostDetailScreen`'s essay `useEffect` must receive `{ signal: abortController.signal }` and be preceded by an `if (abortController.signal.aborted) return` guard (D-08 pattern). Raise the `generateEssayMeta` body slice cap from 2000 to 4000 chars before lengthening the essay prompt, or meta calls always operate on a truncated body.

5. **i18n leaf-module refactor invalidates source-reading test regexes** — four source-reading tests grep raw TypeScript source for structural invariants. Import-line changes during the refactor can cause false-positive matches. Run `npm test` after each file in the refactor sequence, not after the batch. Audit `grep -rl "readFileSync\|fs\.read" app/tests/` before starting; update any test whose anchor string changes simultaneously.

---

## Implications for Roadmap

Based on combined research, the dependency graph enforces a 4-wave build order. Phases within a wave can be parallelized; waves must be sequential.

### Wave 0: Tech-Debt Unblocking (prerequisite for all new service tests)

**Phase: i18n Leaf-Module Refactor**
**Rationale:** 10 carried test failures from v1.4 block all new service test coverage. `src/lib/i18n-leaf.ts` breaks the `ERR_IMPORT_ATTRIBUTE_MISSING` chain across 6 service files. Must land before any new service (engagement, source-diversity) is tested, because those services must also be leaf-importable and will import from the same shim.
**Delivers:** Green test baseline; 6 services become writable under `node --test`
**Avoids:** Pitfall 7 (source-reading test regex collision), Pitfall 11 (`_actions-mock-loader.mjs` stub gap)
**Research flag:** None — pattern matches existing `feed-spread.ts` / `refill-mutex.ts`; implementation is mechanical

**Phase: v1.4 Carry-Over Cleanup**
**Rationale:** Documentation drift (VALIDATION 34/35 flip, ROADMAP plan-list bullets 36-14+36-15, CLAUDE.md `echolearn_*` doc-drift) and device verification (33-HUMAN-UAT-1/2, YouTube landscape-listed-as-short bug) are parallel-safe with the i18n refactor.
**Delivers:** Clean documentation baseline; 33-HUMAN-UAT device retest closed; YouTube short classification bug fixed
**Research flag:** None — documentation surgery and device verification

### Wave 1: Foundation Services (no UI dependencies)

**Phase: Engagement Service + Walker Extension**
**Rationale:** `engagement.service.ts` and the `walkDerivedList` optional `dismissedIds` parameter are independently testable leaf modules. Building them before any UI work lets the walker integration be validated in isolation before HomeScreen is touched. RED tests first per CLAUDE.md Phase 32.1 lesson #2.
**Delivers:** `engagementService` (save/dismiss/like, cross-day localStorage); `walkDerivedList` extended with optional dismissed-skip; `ANCHOR_DISMISSED` event in AppEvent union
**Addresses:** Dismiss (P1 table-stakes); Like (P2); Save (P1 table-stakes)
**Avoids:** Pitfall 2 (dismiss wired to markExplored), Pitfall 3 (Force-New-Day gap), Pitfall 8 (echolearn_ key drift), Pitfall 13 (SQLite migration trap — stay in localStorage)
**Research flag:** None — architecture fully specified; engagement-to-walker boundary explicitly defined

**Phase: Source Diversity Leaf Module**
**Rationale:** `source-diversity.ts` is a session-scoped leaf module with no UI dependencies. Domain-tier allowlist is a bundled TS const. Independently testable before `concept-feed.service.ts` wiring.
**Delivers:** `filterForDiversity`, `recordServedDomain`, `scoreSource`; bundled domain-tier map (~200 entries); synchronous O(N) scan
**Addresses:** Source diversity (P2 differentiator)
**Avoids:** Pitfall 4 (domain lookup inside mutex blocks refill)
**Research flag:** None — domain-tier list is hardcoded; no external API

### Wave 2: Service Integration (requires Wave 1)

**Phase: Pipeline Wiring + Essay Depth**
**Rationale:** Wire Wave 1 leaf services into the existing pipeline at their defined seam points. `concept-feed.service.ts` passes `dismissedAnchorIds` to walker and `filterForDiversity` to the news Tavily branch. `post-essay.service.ts` gains `EssayOptions.depth`. Raise the `generateEssayMeta` slice cap to 4000 before any essay lengthening.
**Delivers:** Dismissed anchors skip in next refill; source diversity filtering active on news branch; `depth: 'deep'` essay path available to PostDetailScreen
**Addresses:** Dismiss (pipeline-complete); source diversity (pipeline-complete); richer essays (P1 table-stakes)
**Avoids:** Pitfall 5 (abort chain breakage — audit before lengthening prompts), Pitfall 4 (mutex hold time)
**Research flag:** May need citation-rendering research if ReactMarkdown `sup`/`a`/`section` override pattern deviates from STACK.md specification

### Wave 3: UI Layer (requires Waves 1-2)

**Phase: Masonry Layout**
**Rationale:** `MasonryFeed.tsx` with CSS `column-count: 2` is the visual foundation for everything else in v1.5. Build after service layers are stable so the UI has real data to render.
**Delivers:** 2-column masonry feed; framer-motion card entrance animations on individual cards; scroll-position restoration (automatic); loading skeleton tiles
**Addresses:** Masonry layout (P1 table-stakes); tile height buckets (blocking masonry — use per-style CSS min-height, not JS computation)
**Avoids:** Pitfall 1 (no JS rebalance on image load), Pitfall 6 (scroll restoration automatic), Pitfall 9 (no framer-motion on scroll container), Pitfall 10 (posts-per-swipe unchanged at 4)
**Research flag:** None — CSS column-count approach is well-documented; no new library integration

**Phase: Engagement UI**
**Rationale:** Wire the Wave 1 engagement service into the UI layer: action row (like/save/dismiss icons) on ConceptCard in InfoFlow.tsx; HomeScreen subscribes to `ANCHOR_DISMISSED` and adds engagement resync to `[location.pathname]` effect; PostDetailScreen gains "Deep dive" button; Force-New-Day handler updated.
**Delivers:** Like/save/dismiss controls on tiles and detail; HomeScreen engagement state sync; deep-dive essay trigger; `handleForceNewDay` updated with `engagementService.reset()`
**Addresses:** Save (P1 — UI-complete); Dismiss (P1 — UI-complete); Like (P2); Teaser→deep essay (P1 — UI-complete)
**Avoids:** Pitfall 2 (dismiss path audited), Pitfall 3 (Force-New-Day handler updated)
**Research flag:** None — engagement UI follows existing card action patterns

### Wave 4: Tech-Debt Hygiene (parallel within wave)

**Phase: Dependency Version Sweep**
**Delivers:** Capacitor 8.3.1, i18next 26.0.10, react-router-dom 7.15.0, typescript-eslint bump; `tsc --strict` audit under 5.9.x; lucide-react icon audit sprint
**Avoids:** Pitfall 12 (React minor bump reserved for this phase, not mid-feature)
**Research flag:** None — version compatibility verified in STACK.md

**Phase: Code Quality Sweep**
**Delivers:** tsc strictness gaps documented; dead-code sweep; perf profiling; project-wide TODO/FIXME triage; operator-note bug sweep
**Research flag:** None — mechanical audit work

### Phase Ordering Rationale

- Wave 0 before Wave 1: all new services must be leaf-importable under `node --test`; the shim must exist before any new service imports from it
- Engagement service before engagement UI: leaf service must exist before UI can call it; walker extension must exist before `concept-feed.service.ts` can pass dismissed IDs
- Source diversity before pipeline wiring: leaf module must exist before `refillQueue` can call `filterForDiversity`
- Pipeline wiring before essay UI: `depth: 'deep'` must exist in `post-essay.service.ts` before PostDetailScreen can offer the button
- Masonry before engagement UI: the masonry card layout must exist before the engagement action row is placed on cards
- Dependency sweep in Wave 4, not Wave 0: React minor bumps must not occur mid-feature to avoid StrictMode timing surprises (Pitfall 12)

### Research Flags

**Phases needing `/gsd:research-phase` during planning:**
- None — all integration patterns are fully specified in ARCHITECTURE.md. If the ReactMarkdown citation component override pattern proves more complex than STACK.md's `sup`/`a`/`section` approach, request research on remark-gfm footnote customization before the Essay Depth phase.

**Phases with well-documented patterns (skip research-phase):**
- All phases: The research files provide complete implementation blueprints. Architecture is derived from direct source-code inspection of the live codebase (ARCHITECTURE.md confidence: HIGH). Pitfalls are drawn from documented v1.4 incident history (PITFALLS.md confidence: HIGH).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions verified against official docs and confirmed incompatibilities (CSS masonry Android WebView, Vite 8 breaking changes, TS 6.0 strictInference). Masonry reconciliation changes the conclusion from STACK.md but is supported by PITFALLS.md analysis and Trellis-specific scroll-container architecture. |
| Features | HIGH | Feature prioritization draws on 2026 UX research and the existing pipeline architecture. Anti-feature decisions have strong rationale from Phase 33 UAT-4 incident history and spaced-repetition principles. |
| Architecture | HIGH | All integration points derived from direct source-code inspection of live codebase. Build order reflects real dependency graph. Seam definitions are exact (call sites named, function signatures specified). |
| Pitfalls | HIGH | Critical pitfalls draw directly from v1.4 incident history (Phase 36 GAP-A/B/C/D, Phase 33 UAT-4, Phase 35 UAT-1). Only Pitfall 9 (framer-motion containing-block analysis) required architectural reasoning rather than incident evidence. |

**Overall confidence:** HIGH

### Gaps to Address

- **Posts-per-swipe audit if masonry demands more than 4 per swipe:** PITFALL 10 flags that changing posts-per-swipe from 4 to 8 would require re-auditing MAX_QUEUE_SIZE, REFILL_THRESHOLD, walkDerivedList call sites, and assignStylesStratified(N) expected output. Current v1.5 scope does NOT change posts-per-swipe. If UX testing reveals users expect 2-column to pop 2 rows at once (8 posts), this audit must happen before the constant changes.

- **`feedPreferences.service.ts` "less of this" style signal:** Deferred to v1.5.x. If added, `style-assignment.ts` must accept external weights as a dependency-injection parameter (not a direct import) to preserve test determinism. The STYLE_WEIGHTS constant becomes a floor, not an override.

- **SQLite like/save migration:** Research recommends localStorage for all engagement annotations to avoid schema migration. If a future phase requires persisting like/save to SQLite, a migration script in `db.service.ts` with a version bump is required before any write path is added. Current v1.5 design avoids this entirely.

- **Citation rendering scope:** FEATURES.md places "citation render polish" at P3 (future consideration). If the essay depth work surfaces citation formatting issues in UAT, this P3 item may need to be pulled into v1.5 release scope. No research needed — the pattern is fully specified in STACK.md.

---

## Sources

### Primary (HIGH confidence — direct source inspection or official docs)

- `app/src/services/post-queue.service.ts` — derived list, walker, cyclePosition, maxSteps formula
- `app/src/services/concept-feed.service.ts` — refillQueue, _refillMutex, news branch, allExplored gate
- `app/src/screens/HomeScreen.tsx` — always-mounted resync pattern, [location.pathname] effects
- `CLAUDE.md` — all load-bearing sections (Concept Feed Pipeline, Header portal, ChatInput flex, root overflow, SwipeTabContainer resize, event bus, news pipeline, anchor normalization, classification dedup, Ask-chat system prompt, i18n workflow)
- `.planning/PROJECT.md` — milestone history, v1.4 gap closure incidents, v1.5 goals
- [CSS Masonry — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Masonry_layout) — Android Chrome support status confirmed not available (May 2026)
- [Chrome for Developers — masonry update](https://developer.chrome.com/blog/masonry-update) — Chrome 140 experimental-flag-only
- [Vite 8 migration guide](https://vite.dev/guide/migration) — Rolldown/Oxc breaking changes
- [TypeScript 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) — strictInference audit requirement
- [Tavily Search API docs](https://docs.tavily.com/documentation/api-reference/endpoint/search) — `score` field semantics, `exclude_domains` support
- [@virtuoso.dev/masonry npm](https://www.npmjs.com/package/@virtuoso.dev/masonry) — `useWindowScroll` API reviewed; window-scroll vs per-element-scroll incompatibility identified
- [masonic GitHub](https://github.com/jaredLunde/masonic) — maintenance status confirmed stale (~1 year no updates)

### Secondary (MEDIUM confidence — community consensus, UX research)

- [Masonry in React: A Performance Hell](https://medium.com/@colecodes/masonry-in-react-a-performance-hell-fb779f5fcebd) — JS rebalance pitfalls
- [Social Media Algorithms 2026: How Platforms Rank Content (Hootsuite)](https://blog.hootsuite.com/social-media-algorithm/) — engagement signal hierarchy
- [Content Length Best Practices 2026](https://www.georgescifo.com/2025/10/the-definitive-guide-to-content-length-best-practices-for-2026/) — 150-250w feed, 500-850w expansion norms
- [RxDB localStorage vs IndexedDB](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html) — performance characteristics at small data scale
- [remarkjs footnote customization discussion](https://github.com/orgs/remarkjs/discussions/1270) — sup/a override pattern
- [AbortController + React useEffect cleanup](https://www.j-labs.pl/en/tech-blog/how-to-use-the-useeffect-hook-with-the-abortcontroller/) — D-08 pattern validation

### Tertiary (LOW confidence — inferences from architectural reasoning)

- Pitfall 9 (framer-motion containing-block analysis on masonry cards): derived from CLAUDE.md Header portal rules + framer-motion will-change documentation; not reproduced from an incident
- Wave-to-wave build ordering: derived from dependency graph analysis, not from a prior comparable project

---

*Research completed: 2026-05-08*
*Ready for roadmap: yes*
