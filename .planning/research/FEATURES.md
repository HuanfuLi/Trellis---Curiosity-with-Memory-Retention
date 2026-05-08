# Feature Research: Curiosity Feed v2 (Trellis v1.5)

**Domain:** AI-powered personalized learning feed — masonry layout, engagement signals, source diversity
**Researched:** 2026-05-08
**Confidence:** HIGH (verified against current library docs, 2026 UX research, Tavily API docs)

---

## Context

This replaces the v1.1 FEATURES.md. The existing feed (v1.4) is a single-column infinite-scroll pipeline driven by a 3-list architecture (daily concept list → derived list → 32-max cyclic queue). v1.5 adds four orthogonal capability layers on top of that foundation without replacing the pipeline.

**What already exists — do not re-research, do not re-architect:**
- 3-list pipeline: append-only derived list, cyclic walker, stratified style allocation, spreadByConcept + spreadByStyle mixers
- 6 post styles: image / text-art / video / short / news / suggestion
- Post-essay streaming: `post-essay.service.ts`, 150-250w LLM essays grounded on Tavily snippets
- Exploration tracking: 3 in-feed detectors + Detector D (YouTube postMessage) + short tap-emit
- Vine progress UI showing concepts explored today

**The four v1.5 capability layers being researched:**
1. Pinterest-style masonry feed layout
2. Richer post body essays
3. Source diversity in content generation
4. Engagement signals (like / save / dismiss, local-only)

---

## Table Stakes (Users Expect These)

Features users assume a 2026 content feed has. Missing these makes the product feel unfinished.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **2-column masonry layout** | Pinterest, Instagram Explore, Google Discover all use variable-height 2-col grids. Single-column feels like a 2020 prototype in 2026. | MEDIUM | Replaces `InfoFlow.tsx` single-col render; must preserve all 6 post styles and scroll-position contract |
| **Scroll-position restoration after detail view** | Standard expectation since Pinterest normalized it ca. 2018. Users tap a tile, read the detail, back-navigate, and expect to land at the same grid position — not the top. | MEDIUM | `PostDetailScreen.tsx` back-nav; always-mounted `HomeScreen.tsx` means the scroll container is never unmounted — restore scrollTop on Outlet close |
| **Save / bookmark posts** | Rednote's "collect" gesture, Pinterest's "save to board" — users in 2026 expect to stash content for later without navigating away. Must work offline (local-first). | LOW-MEDIUM | New `savedPosts.service.ts` backed by localStorage (or SQLite); no server required |
| **Dismiss / "not interested" per post** | TikTok, Instagram Reels, Google Discover all expose explicit dismissal. Without it, users have no recourse when a post is irrelevant; they churn silently. | LOW | Feeds into lazy-skip walker via new `dismissedPosts` set in `dailyReadService`; same mechanism as explored anchors |
| **Loading skeleton for new tiles** | Skeleton tiles during refill prevent layout-shift jank in a variable-height masonry grid. Without them, columns reflow visibly as new items arrive. | LOW | Skeleton tiles must declare a fixed placeholder height to prevent reflow — use average tile height (220px) as placeholder |
| **"End of content" state** | When all anchors explored, feed must surface a clear end-state rather than an empty column. Users need resolution, not confusion. Already partially handled by vine-finished path. | LOW | Connects to existing `allExplored` guard in `concept-feed.service.ts` |

---

## Differentiators (Competitive Advantage)

Features that distinguish Trellis from generic content feeds. Aligned with the core value: structured knowledge through adaptive, privacy-preserving AI.

### A. Masonry UX Patterns

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Variable tile height reflecting content type** | Image posts taller (3:4 ratio), text-art posts shorter (1:1), suggestion cards fixed-height. Creates the "mosaic rhythm" that makes Pinterest grids feel alive vs uniform grids that feel like a spreadsheet. | MEDIUM | Height must be declared before render (masonry libraries need known heights to avoid reflow). Precompute height bucket per post type at queue-fill time. |
| **Tap-to-expand in-place (overlay, not navigation)** | Opening a tile as a full-screen overlay with the feed frozen underneath preserves scroll position trivially — no restoration logic needed. Pinterest's actual pattern since 2022. | MEDIUM-HIGH | Conflicts with existing `PostDetailScreen.tsx` navigation model. Decision required: keep nav-based for sub-screen features (Detector A/B/C/D), or add overlay for feed-grid posts. Overlay is simpler for scroll preservation but means all detectors must work inside the overlay layer. |
| **Smooth scroll-position restoration (nav-based fallback)** | If overlay is not chosen, save `scrollTop` in a ref on `HomeScreen` before navigating, restore it in the `[location.pathname]` useEffect that already fires on `/home` navigation (Phase 36-14 pattern). No library needed. | LOW | Simpler than overlay but user perceives a flash before restoration. Acceptable for v1.5 if overlay is deferred. |
| **Pull-to-refresh gesture** | Standard on mobile feeds; triggers force-refill of the queue rather than a full rebuild. Gives user agency without disrupting the derived-list cycle position. | LOW-MEDIUM | Call `refillQueue()` behind `_refillMutex` (already guarded); reset visual state. Do NOT reset `derivedList` or `cyclePosition`. |

### B. Richer Post Body Essays

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Progressive disclosure: 150w teaser → full essay on expand** | Research shows 150-250w is optimal for feed scan (30-45s read time). 500-1000w works for users who choose to go deeper. "Read more" expansion in-place (not navigation) matches how Substack, Medium, and Apple News work in 2026. | LOW | `post-essay.service.ts` already streams 150-250w. Add a `generateFullEssay(postId)` path that streams a follow-on 350-600w continuation, appended to `bodyMarkdown`. The detector-B 30s dwell timer already fires; repurpose as "expand offered" trigger. |
| **Tighter Tavily source grounding** | Current news essay grounds on `sources[0].snippet`. Grounding on 2-3 snippets from different domains reduces hallucination and improves factual density. | LOW-MEDIUM | Pass `sources[0..2].snippet` joined with `---` separator into the essay prompt. No change to `refillQueue` news branch — Tavily already returns multiple results. |
| **Citation render polish** | Numbered inline citations `[1]` linking to source URLs render inconsistently across the 4 locales and on narrow tiles. Needs a consistent superscript → tooltip or bottom-sheet pattern. | LOW | Pure UI work in `PostDetailScreen.tsx`; no pipeline touch. |
| **Concept-connection sentence at essay end** | Each essay ends with 1 sentence linking the concept to an adjacent anchor in the user's own graph. Makes every post feel personally relevant. | MEDIUM | Requires passing `candidatePack` (graph neighbors) into the essay prompt — same context that `useQuestions.ts` uses for Ask. Adds ~100 tokens per essay call. |

### C. Source Diversity

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Per-concept domain rotation** | When multiple Tavily calls are made for the same concept on different days/posts, exclude previously-seen domains using `exclude_domains` param. Prevents the same Wikipedia / Medium article from grounding every post. | LOW | Track `usedDomains: string[]` per anchor in localStorage (or SQLite). Passed as `exclude_domains` on the next Tavily call for that anchor. Tavily docs confirm `exclude_domains` is supported. |
| **Media-type mixing within concept** | One concept gets: 1 image post (visual grounding), 1 news post (current application), 1 video (explains the mechanism), 1 text-art (pithy summary). Currently style assignment is random-stratified; intentionally balancing media types per concept reduces redundancy. | MEDIUM | Modify `appendToDerivedList` to track which styles have been used per conceptId. When same concept re-enters (via new question), prefer styles not yet seen. This is an annotation on the derived list entry, not a pipeline rebuild. |
| **Source quality scoring (simple)** | Weight Tavily results by: (a) `score` field Tavily already returns, (b) domain not in a blocklist of low-quality aggregators. Use `search_depth='advanced'` (already returns reranked chunks). | LOW | Already free: Tavily `advanced` search depth reranks by relevance. Add `exclude_domains` blocklist for known aggregator-spam domains (listicle farms, content mills). |
| **Near-duplicate detection across posts** | Two posts on the same concept from the same source URL produce nearly identical body text. Detect via title similarity before committing to queue. | MEDIUM | Compare `newsMeta.sources[0].url` before inserting to derived list. If same URL seen within same day for same concept, skip and re-query Tavily with `exclude_domains` extended. |

### D. Engagement Signals (Local-Only)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Like / heart per post** | Table stakes for any content feed in 2026. Signals "this was good" without triggering re-review. Stored locally in `savedPosts.service.ts`. Does NOT affect the SM-2 scheduling or the derived list. | LOW | localStorage key `trellis_liked_posts: Record<postId, timestamp>`. Heart icon on tile and detail view. Count is private (no social total displayed). |
| **Save / collect post** | Higher-intent than like. Saved posts accessible in a dedicated "Saved" tab or shelf. Pinterest and Rednote showed that saves are the strongest implicit quality signal. | LOW-MEDIUM | `savedPosts.service.ts` persists full `DailyPost` objects (or IDs with re-fetch path). Accessible from a new screen or bottom-sheet. |
| **Dismiss ("not interested")** | Explicit negative signal. Suppresses the concept from the feed for the rest of the day (same mechanism as `getExploredAnchors` lazy-skip in the walker). Long-press menu or swipe-left gesture reveals dismiss action. | LOW | Write conceptId to `dailyReadService.dismissedAnchors` (new field, parallel to `exploredAnchors`). Walker already lazy-skips by id — extend `walkDerivedList` to accept a second skip-set. |
| **"Less of this" style signal** | User can signal "I get too many image posts" or "too many news posts." Adjusts `STYLE_WEIGHTS` in localStorage for future sessions. Graph-based: if user dismisses 3+ news posts in a row, reduce news weight by 10%, redistribute to other styles. | MEDIUM | New `feedPreferences.service.ts` persists per-style weight adjustments. `style-assignment.ts` reads from this service before running largest-remainder allocation. Keep base weights as floor (no style drops below 5%). |
| **Graph-derived social proof** | Show "4 of your anchors connect to this concept" as a sub-label on tiles. This is deterministic from the local knowledge graph — no server needed. Gives "others like you" feeling authentically without any privacy risk. | LOW-MEDIUM | Compute connection count at queue-fill time using `candidatePack` neighbor resolution. Store as `connectionCount: number` on `DailyPost`. Render as micro-label "4 connections" below tile title. |
| **"Trending in your graph" shelf** | A horizontal shelf above the feed showing 3-5 anchors with the most review activity this week. Entirely local: computed from `reviewHistory` in SQLite. Feels like social proof; is actually personal analytics. | MEDIUM | New `localTrending.service.ts` reads review history, groups by anchor, ranks by recency × frequency. Rendered as a horizontal chip row above the masonry grid. |

---

## Anti-Features (Deliberately NOT Building)

| Feature | Why Requested | Why Not | What to Do Instead |
|---------|--------------|---------|-------------------|
| **Engagement counts / social totals** | "Show how many people liked this" creates social-proof loops | Requires a backend and breaks local-first privacy. Also shifts focus from learning to performance anxiety. | Show only personal saves/likes. The "trending" shelf derives from the user's own graph, not a crowd. |
| **Horizontal swipe to dismiss** | Familiar from Tinder / news apps | Trellis feed is inside a horizontal SwipeTabContainer strip. Horizontal swipe on a feed tile is **indistinguishable** from the inter-tab swipe gesture. This is the exact gesture conflict class that Phase 33 UAT-4 documented. Any horizontal swipe within the feed MUST be left to the tab strip. | Use long-press contextual menu for dismiss (Material Design pattern: swipe-to-reveal for dismiss in lists ONLY when the container is vertically-only, which the SwipeTabContainer is not). |
| **Pull-to-top on new posts** | "Show newest first" is intuitive | Destroys the 3-list pipeline's derived-list append-only semantics and cyclePosition. Rebuilding derived list from scratch loses multiplicity weights and cycle state. | Pull-to-refresh should trigger `refillQueue` (adds to queue end) not rebuild. New posts surface naturally as the walker advances. |
| **A/B testing style weights** | "What style mix performs best?" | Requires server-side experiment assignment and aggregated telemetry. Incompatible with local-first privacy. | Ship the `feedPreferences.service.ts` "less of this" adjustment. Let users self-select their mix over time. |
| **Infinite "lazy load everything" tile heights** | CSS-only masonry with `grid-template-rows: masonry` | CSS Grid Lanes shipped in Safari 26 only as of May 2026; Chrome/Firefox behind flags. Not viable for Capacitor's embedded Chromium WebView (WebView version lags Chrome stable by weeks-months). | Use `masonic` (virtualized, interval-tree backed, ResizeObserver aware) or `react-masonry-css` (CSS columns fallback, no virtualization). |
| **Runtime LLM translation of essay bodies** | "Translate this post to Japanese on tap" | Prohibited by CLAUDE.md (i18n rule: runtime LLM translation is prohibited). LLM essays are already generated in the user's locale via `applyLocaleDirective`. | Essays are already locale-directed at generation time. No translation layer needed. |
| **Near-real-time "others explored" signals** | Social proof via server-aggregated signals | No backend, no server. Any "others explored" data would require exfiltrating user behavior, which violates the core privacy promise. | Use graph-derived local social proof ("4 of your anchors connect to this") and local trending from review history. |
| **Engagement counts influencing SM-2 scheduling** | "If I liked a post, reduce its review interval" | Like/save on a post is not equivalent to recall success on a flashcard. Conflating the two would corrupt the SM-2 model that drives the daily concept list. | Likes and saves are purely personal annotations. Review performance exclusively controls SM-2. |

---

## Feature Dependencies

```
[2-column masonry layout]
    └──requires──> [Tile height declarations per post type] (at queue-fill time)
    └──requires──> [Scroll-position restoration] (trivial if overlay chosen, ref-save if nav)

[Dismiss ("not interested")]
    └──requires──> [walkDerivedList skip-set extension] (already lazy-skip capable)
    └──requires──> [dailyReadService.dismissedAnchors] (new field, parallel to exploredAnchors)

["Less of this" style signal]
    └──requires──> [feedPreferences.service.ts] (new leaf module)
    └──requires──> [style-assignment.ts reads external weights] (currently uses STYLE_WEIGHTS constant)
    └──enhances──> [Dismiss] (style dismissal = per-style weight adjustment)

[Save / bookmark]
    └──requires──> [savedPosts.service.ts] (new service)
    └──enhances──> [Like / heart] (saves are a superset of likes in intent)

[Graph-derived social proof]
    └──requires──> [candidatePack neighbor count at queue-fill time]
    └──enhances──> [2-column masonry layout] (micro-label on tile)

["Trending in your graph" shelf]
    └──requires──> [localTrending.service.ts] (new service reading SQLite review history)
    └──enhances──> [Graph-derived social proof] (same "local analytics" framing)

[Progressive disclosure: teaser → full essay]
    └──requires──> [post-essay.service.ts continuation path] (new function, not new file)
    └──enhances──> [Citation render polish] (full essay has more citations to render)

[Per-concept domain rotation]
    └──requires──> [usedDomains tracking per anchor] (new field in anchor metadata or localStorage)
    └──enhances──> [Near-duplicate detection] (same URL check is simpler than domain rotation)

[Tighter Tavily source grounding]
    └──enhances──> [Richer essays] (more grounding = less hallucination)
    └──conflicts──> [Per-concept domain rotation] (grounding on 2-3 snippets must respect exclude_domains)

[Media-type mixing within concept]
    └──requires──> [appendToDerivedList style-per-concept tracking] (new annotation on DerivedListEntry)
    └──enhances──> [Stratified style allocation] (already guaranteed ±1 per style per N; this adds per-concept fairness)
```

### Dependency Notes

- **Masonry layout requires tile height declarations:** Unlike CSS Grid equal-height rows, masonry needs column heights to compute placement. Height must be knowable before render to avoid reflow. Each post type must map to a height bucket (image: tall, text-art: medium, suggestion: short). This is data at queue-fill time, not layout-time measurement.
- **Dismiss requires walkDerivedList extension:** The walker already accepts `exploredIds: Set<string>`. Extending it to `skipIds: Set<string>` (union of explored + dismissed) is a one-line change with zero pipeline impact.
- **"Less of this" style signal requires style-assignment.ts to read external weights:** Currently `STYLE_WEIGHTS` is a compile-time constant. Extracting the weights to a function that reads from `feedPreferences.service.ts` makes `style-assignment.ts` impure — the leaf module must be re-evaluated. Add the leaf module as a dependency injection parameter rather than a direct import to keep unit tests deterministic.
- **Progressive disclosure must NOT disrupt the `bodyMarkdown: ''` invariant:** The existing CLAUDE.md invariant says `bodyMarkdown: ''` causes `PostDetailScreen` to invoke the streamer. The continuation path must check `bodyMarkdown.length > 0` before appending — it is a second-phase call, not a replacement of the first.

---

## MVP Definition for v1.5

### Launch With (must close before v1.5 ships)

- [ ] **2-column masonry layout with fixed tile height buckets** — visual foundation for everything else; without it the milestone's leading feature doesn't exist
- [ ] **Scroll-position restoration (ref-save pattern)** — table stakes for any masonry grid; trivially implemented via the Phase 36-14 `[location.pathname]` useEffect already on `HomeScreen`
- [ ] **Save / bookmark posts** — table stakes in 2026; `savedPosts.service.ts` + heart/bookmark icons on tile and detail
- [ ] **Dismiss ("not interested")** — table stakes; extends existing `walkDerivedList` skip mechanism; no pipeline risk
- [ ] **Teaser → full essay progressive disclosure** — differentiator; `post-essay.service.ts` continuation path; low risk

### Add After Validation (v1.5.x)

- [ ] **"Less of this" style signal** — needs `feedPreferences.service.ts` and style-assignment impurity; worth validating dismiss first
- [ ] **Graph-derived social proof ("N connections" micro-label)** — differentiator; requires candidatePack at queue-fill time; validate masonry tile design first
- [ ] **Per-concept domain rotation** — needs `usedDomains` tracking; validate essay quality improvement first
- [ ] **Tighter Tavily source grounding (2-3 snippets)** — low risk change to essay prompt; add after validating existing stream path is stable

### Future Consideration (v1.6+)

- [ ] **"Trending in your graph" shelf** — requires SQLite review history aggregation; valuable but not blocking
- [ ] **Tap-to-expand overlay (vs nav-based detail)** — architectural change to PostDetailScreen navigation model; replaces 4 detectors; significant scope
- [ ] **Media-type mixing within concept** — requires derived list annotation system; deferred until append-only semantics are proven stable across multi-week usage
- [ ] **Citation render polish** — pure UI work; not blocking v1.5 launch

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 2-column masonry layout | HIGH | MEDIUM | P1 |
| Scroll-position restoration | HIGH | LOW | P1 |
| Save / bookmark | HIGH | LOW | P1 |
| Dismiss ("not interested") | HIGH | LOW | P1 |
| Teaser → full essay | MEDIUM | LOW | P1 |
| Tile height buckets (per post type) | HIGH | LOW | P1 (blocking masonry) |
| Like / heart | MEDIUM | LOW | P2 |
| Graph-derived social proof | MEDIUM | MEDIUM | P2 |
| Per-concept domain rotation | MEDIUM | LOW | P2 |
| Tighter Tavily grounding | MEDIUM | LOW | P2 |
| "Less of this" style signal | MEDIUM | MEDIUM | P2 |
| "Trending in your graph" shelf | LOW | MEDIUM | P3 |
| Tap-to-expand overlay | HIGH | HIGH | P3 |
| Media-type mixing within concept | MEDIUM | HIGH | P3 |
| Citation render polish | LOW | LOW | P3 |
| Pull-to-refresh | LOW | MEDIUM | P3 |

---

## Engagement Signals: What Is Table Stakes vs Differentiator in 2026

Research confirms the following hierarchy as of 2026 (sources: platform algorithm documentation, 2026 UX trend reports):

**Ranking of signal quality (strongest → weakest):**
1. **Save / bookmark** — strongest positive signal; indicates user wants to return (Pinterest, Rednote, LinkedIn all weight this above likes)
2. **Dwell time / completion** — already tracked via Detector B (30s) and scroll-70% sentinel; no new infra needed
3. **Follow-up action** (Q&A, review add) — already tracked via Detector C; highest-intent signal
4. **Dismiss / "not interested"** — strongest negative signal; more actionable than absence of engagement
5. **Like / heart** — weakest positive signal in 2026; algorithms de-weight it vs saves; still expected as table stakes
6. **Explicit rating** (1-5 stars, thumbs up/down with reason) — differentiator for research/productivity apps; anti-feature for casual feeds (introduces friction before user decides to invest attention)

**Local-only social-proof approaches (ranked by authenticity vs engineering cost):**

1. **Graph-derived connection count** (e.g., "4 of your anchors connect to this concept") — computed from local knowledge graph, 100% accurate, zero privacy risk, medium engineering. RECOMMENDED.
2. **Local trending from review history** ("You've revisited this concept 5 times this week") — computed from SQLite, personal analytics framed as trending, zero privacy risk. RECOMMENDED for the shelf feature.
3. **Synthetic "recommended for you" label** — deterministic from SM-2 due dates and anchor importance; already how the pipeline works. ALREADY IMPLEMENTED (just unlabeled). Add a "why this post" tooltip/label.
4. **Crowd-sourced trending** — requires backend, violates local-first. ANTI-FEATURE.

---

## Word Count Norms for Educational Content (2026 Research)

Based on current educational content research:

- **Feed tile body (scan):** 150-250 words, 30-45 second read time. This is what `post-essay.service.ts` already produces. Correct for feed context.
- **On-expand continuation (depth):** 350-600 additional words (total 500-850w). Users who expand have signaled intent; 500-850w matches newsletter and Substack educational content norms.
- **Long-form deep dive (optional):** 1,500-3,000 words. Out of scope for v1.5 — this is article-length content, not feed content.

**"Read more" expansion is still the dominant pattern in 2026** for educational/informational feeds. It is NOT out of fashion. Apple News, Substack, and Medium all use it. The key is: expansion must be in-place (no navigation away from feed context), and the transition must feel instant (no LLM latency visible — progressive streaming into an expanded container is the right approach).

---

## Masonry Library Recommendation

**Use `masonic` (jaredLunde) for production.**

Rationale:
- Virtualized via red-black interval tree (O(log n + m) cell lookup); renders ~40-50 DOM nodes regardless of item count
- ResizeObserver-based: handles variable-height cells without forcing full reflows
- React 18+ compatible; no known incompatibility with Capacitor WebView
- Actively maintained as of 2025 (npm: `masonic`)

**Do NOT use CSS Grid Lanes (`grid-template-rows: masonry`)** — Safari 26 shipped it but Chrome/Firefox are behind experimental flags as of May 2026. Capacitor's embedded Chromium WebView lags Chrome stable, making this unreliable for the Android target.

**Do NOT use `react-masonry-css`** for a virtualized feed. It renders all items in DOM (no virtualization). Acceptable for static galleries; not for a growing feed that could reach 100+ posts.

---

## Sources

- [Scrolling Designs: 8 Patterns (Lovable, 2026)](https://lovable.dev/guides/scrolling-designs-patterns-when-to-use)
- [Infinite Scroll Feed System Design Guide (2026)](https://www.muhammadtayyab.dev/blog/how-to-design-an-infinite-scroll-feed-the-complete-system-design-guide)
- [Masonic: High-performance masonry for React (GitHub)](https://github.com/jaredLunde/masonic)
- [CSS Grid Lanes Complete Guide (DEV, 2026)](https://dev.to/bean_bean/css-grid-lanes-masonry-layout-is-here-a-complete-guide-for-2026-4686)
- [Building High-Performance Scroll Restoration Infinite Lists (Medium, Feb 2026)](https://suhaotian.medium.com/building-high-performance-scroll-restoration-infinite-lists-on-the-web-baa55d4cd52f)
- [Social Media Algorithms 2026: How Platforms Rank Content (Hootsuite)](https://blog.hootsuite.com/social-media-algorithm/)
- [Google Discover Feb 2026 Core Update Scorecard (Newzdash)](https://www.newzdash.com/guide/google-discover-feb-2026-core-update-scorecard-data-shows-what-actually-changed)
- [Designing swipe-to-delete and swipe-to-reveal interactions (LogRocket)](https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers/)
- [Content Length Best Practices 2026](https://www.georgescifo.com/2025/10/the-definitive-guide-to-content-length-best-practices-for-2026/)
- [Mobile-First UX Patterns Driving Engagement 2026 (TensorBlue)](https://tensorblue.com/blog/mobile-first-ux-patterns-driving-engagement-design-strategies-for-2026)
- [Tavily Web Search Essentials Docs](https://docs.tavily.com/examples/quick-tutorials/search-api)
- [On-Device Recommender Systems Survey (Springer, 2025)](https://link.springer.com/article/10.1007/s41019-025-00308-8)
- [Progressive Disclosure in UX (IxDF, 2026)](https://ixdf.org/literature/topics/progressive-disclosure)
- [Instagram New UI 2026 (ClickAnalytic)](https://www.clickanalytic.com/instagram-new-ui-2025-explained/)

---

*Feature research for: Trellis v1.5 Curiosity Feed v2*
*Researched: 2026-05-08*
