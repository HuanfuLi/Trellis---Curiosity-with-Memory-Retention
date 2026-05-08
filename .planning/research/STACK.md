# Technology Stack: Trellis v1.5 — Curiosity Feed v2 + Tech-Debt Hardening

**Project:** Trellis v1.5
**Researched:** 2026-05-08
**Baseline Stack (locked, do not re-research):** React 19.2.0, TypeScript 5.9.3, Vite 7.3.1,
Tailwind CSS 4.2.1, Capacitor 8.1.0, framer-motion 12.38.0, react-router-dom 7.13.1,
lucide-react 0.575.0, ReactMarkdown 10.1.0, i18next 26.0.5, @capacitor-community/sqlite 8.0.1,
mind-elixir 5.9.3

---

## Executive Summary

v1.5 adds four new capabilities: masonry feed layout, richer post essays with citation polish,
source diversity scoring, and engagement signals (like/save/dismiss). It also runs a broad
tech-debt sweep. After researching each decision area, the net new dependency count is **one
production package** (@virtuoso.dev/masonry) and **zero dev-dependency additions**. Everything
else is either a version bump on existing packages or implemented with existing tooling.

The most consequential decisions: (1) **Use @virtuoso.dev/masonry** (not masonic, not CSS
columns, not native CSS grid masonry) — it is the only library that satisfies virtualization +
window-scroll + auto-sizing + active maintenance simultaneously on Android WebView. (2) **Do
NOT upgrade Vite 7 to Vite 8** — Vite 8 is a Rolldown/Oxc rewrite with breaking config changes
that offer no benefit to a mobile-first Capacitor app. (3) **Persist engagement signals in
localStorage** under the existing `trellis_*` namespace via the settings service pattern, not in
IndexedDB or SQLite — the data is small (<10 KB) and the event-bus cross-screen reactivity
pattern is already wired. (4) **Source diversity scoring is purely heuristic from Tavily's
existing `score` field + domain extraction** — no external library is needed. (5) **Citation
rendering is a custom `sup`/`a` component override inside the existing ReactMarkdown chain** —
no new remark/rehype plugin.

---

## 1. Masonry Feed Layout

### Decision: `@virtuoso.dev/masonry` v1.4.3

**Reject CSS `grid-template-rows: masonry`** (experimental syntax): As of May 2026 it is
behind flags in Chrome/Firefox and only in Safari Technology Preview. Android Chrome has no
support at all. Cannot ship.

**Reject CSS columns / `react-masonry-css`**: CSS column-count fills top-to-bottom (newspaper
layout), not left-to-right. Items rendered at position 1, 5, 9 appear in column 1 rather than
reading order. `react-masonry-css` works around this with JavaScript pre-reordering, which
breaks animated list insertions and the existing framer-motion stagger pattern. Also has no
virtualization — 32 queue posts + infinite scroll eventually hits the DOM limit on low-end
Android.

**Reject `masonic` v4.1.0**: Last published ~May 2025, no updates in ~12 months. Does not
expose a `useWindowScroll` mode compatible with Trellis's existing `overflow: auto` per-screen
scroll container pattern. Uses `resize-observer-polyfill` as a dependency, adding unnecessary
weight.

**Use `@virtuoso.dev/masonry` v1.4.3** (published 2026-04-25):
- Virtualizes: only visible items in DOM — safe for 32-post queue + infinite scroll
- Auto-sizes variable-height cards without explicit height configuration
- Supports `useWindowScroll={true}` — works with the per-screen `overflow: auto` container
  (each SwipeTabContainer slot has its own scroll root, so the window-scroller targets the
  correct container)
- From the actively maintained React Virtuoso family (react-virtuoso has weekly releases)
- ~25 KB gzipped including all Virtuoso shared internals
- No known Android WebView blockers; uses ResizeObserver + IntersectionObserver, both fully
  supported in Android WebView 95+ (Capacitor 8 targets Android 23+, WebView 117+)

**Integration constraint:** The existing `useInfiniteScroll.ts` + `infiniteScroll.service.ts`
swipe-for-more entry point still manages the 32-post queue and the 4-per-swipe pop logic.
`@virtuoso.dev/masonry` replaces only the rendering layer (`InfoFlow.tsx` column layout), not
the queue management layer. Pass `data={posts}` and `ItemContent={MasonryCard}`. The
`endReached` callback on `VirtuosoMasonry` replaces the current IntersectionObserver sentinel.

**Column count:** 2 columns fixed (design spec: 2-column flow). Do not use the
`columnCount` auto-detection feature — the feed design calls for fixed 2-column Pinterest
rhythm, not responsive breakpoints.

```bash
npm install @virtuoso.dev/masonry
```

### What NOT to do

- Do not add `react-masonry-css` alongside Virtuoso. Two masonry renderers in one project is
  confusion debt.
- Do not attempt CSS grid masonry with a feature flag — Capacitor WebView doesn't expose Chrome
  experimental flags.
- Do not use `masonic` — maintenance status is unclear, window-scroll integration is awkward.

---

## 2. Engagement Signals (Like / Save / Dismiss)

### Decision: localStorage under `trellis_*` namespace, event-bus reactivity

**Reject IndexedDB** for this use case: Engagement flags are small key-value annotations (post
ID → `{liked: bool, saved: bool, dismissedAt: ISOString}`). Total payload for 1000 posts is
<50 KB. localStorage benchmarks show it outperforms IndexedDB at this scale, and it blocks the
main thread for microseconds — well within threshold. IndexedDB's async API adds code
complexity with no payoff. The project already has a localStorage abstraction (settingsService
pattern) with synchronous `.getSync()` and structured namespacing.

**Reject extending SQLite schema**: The SQLite connection (`'echolearn'`) is used for
anchor/cluster/question graph data with typed migrations. Adding an engagement annotation table
for what is essentially user-preference data would couple UI annotations to the graph data layer
and require a schema migration. LocalStorage is the right tier for annotations that follow the
same access pattern as `trellis_post_queue` and `trellis_daily_posts`.

**Implementation:** Create `engagementService` following the settingsService pattern:
- Storage key: `trellis_engagement_v1` (JSON map of `postId → EngagementRecord`)
- Read: synchronous `.getSync(postId)` (no waiting, no async race in render)
- Write: synchronous `.set(postId, record)` + emit `ENGAGEMENT_UPDATED` on the event bus
- Cross-screen: HomeScreen and any future SavedScreen subscribe to `ENGAGEMENT_UPDATED` via
  the existing `event-bus.ts` (same pattern as `CONCEPT_EXPLORED`, `GRAPH_UPDATED`)
- Pruning: records older than 90 days with `dismissedAt` set are dropped on `load()` to
  prevent unbounded growth

**No new dependencies.** Uses existing `src/lib/event-bus.ts` and localStorage.

---

## 3. Source Diversity Scoring

### Decision: Heuristic scoring from Tavily's existing response fields — no external library

**What Tavily already returns per result:** `title`, `url`, `content`, `score` (float, relevance
rank), `favicon`, `images`. It does NOT return publish date, domain reputation score, or
recency metadata in the result object (confirmed via docs.tavily.com). Tavily's `score` field
is a relevance-to-query rank, not a source credibility signal.

**Domain reputation — no offline npm library exists** for this: npm search found no maintained
offline domain-reputation library suitable for bundling in a mobile app. WhoisXML and IPQualityScore
are API-only services (require backend, violate local-first constraint). Spamhaus is a DNS-level
tool, not a browser bundle.

**Recommended approach: bundled domain-tier allowlist + heuristics**

Build a small typed module `src/services/source-quality.ts` with:

1. **Domain tier map** (~200 entries, bundled as a `Map<string, number>`):
   - Tier 3 (0.9 bonus): `arxiv.org`, `pubmed.ncbi.nlm.nih.gov`, `nature.com`, `science.org`,
     `scholar.google.com`, Wikipedia, `britannica.com`, BBC, Reuters, AP, major university `.edu`
     TLDs
   - Tier 2 (0.6 bonus): Established mainstream news outlets, Substack anchors, known science
     blogs
   - Tier 1 (0.3 bonus): Everything else that passes snippet length check
   - Tier 0 (0.0): Domains with query-bait patterns (`site:pinterest.com`, `quora.com`,
     social aggregators) — these are likely to appear in Tavily results for educational queries
   
2. **Snippet length heuristic**: `content.length > 200` chars = +0.2 (long snippets indicate
   substantive pages, not landing pages)

3. **Near-duplicate filter**: Compare `url` hostnames across results in the same Tavily batch.
   If >2 results share a hostname, keep only the highest-scoring one (prevents Wikipedia + 3
   Wikipedia mirrors all scoring high).

4. **Composite score**: `tavilyScore * 0.5 + domainTierBonus * 0.3 + snippetLengthBonus * 0.2`

**This is explicitly scoped as heuristic-first**: the design doc defers ML-based scoring. The
bundled map is a flat TypeScript `const` — 200 entries at ~30 chars each is ~6 KB before
gzip, no runtime cost, no network calls, no external dep.

**No new dependencies.**

---

## 4. Citation Rendering Improvements

### Decision: Custom `sup` and `a` component overrides in the existing ReactMarkdown chain

**What `remark-gfm` produces for footnotes**: GFM footnote references (`[^1]`) render as
`<sup><a href="#user-content-fn-1">1</a></sup>` and footnote definitions render at the bottom
as a `<section>` with `<ol>`. The `components` prop in ReactMarkdown 10 accepts `sup` and `a`
keys to override these HTML elements.

**No new remark/rehype plugins needed**: The existing plugin chain
(`remark-gfm`, `remark-math`, `rehype-katex`, `rehype-raw`, `rehype-sanitize`) is sufficient.
Adding `remark-footnotes` would be redundant — `remark-gfm` v4 already includes GFM footnotes.
Any attempt to add `remark-footnotes` alongside `remark-gfm` creates a plugin conflict (both
try to own the footnoteReference node type).

**Recommended pattern** — intercept at the `sup` and `a` level in the `components` prop:
- Override `sup` to detect footnote references (check child `<a>` href starts with
  `#user-content-fn-`) and render as styled pill badges instead of superscript
- Override `a` inside footnote sections to strip the `#user-content-fn-` prefix and present
  clean numbered citations
- Footnote definition section (`<section data-footnotes>`) is overridden via the `section`
  component key to render as a sticky bottom-of-card sources block with the Trellis
  `--surface-variant` background

**Sticky footnote vs. inline**: Sticky (bottom-of-card) is recommended. Inline tooltips require
hover events that do not translate well to touch on Android. The bottom-of-card block matches
the existing `SourcesSection` component pattern in `ChatMessage.tsx`.

**No new dependencies.** All changes are within `src/components/Markdown.tsx` and a new
`src/components/CitationBlock.tsx`.

---

## 5. Richer Post Body Essays

### Decision: Extend existing `chatStream` pipeline — increase word target, tighten grounding prompt

The current `post-essay.service.ts:generateNewsEssay` streams 150-250 words. The v1.5 target
is 300-500 words with stronger source grounding. This is a prompt engineering change, not a
library change. The existing `chatStream` infrastructure handles arbitrary length streaming.

**No new dependencies.** Changes are to prompt templates in `post-essay.service.ts` and
`concept-feed.service.ts`.

---

## 6. Dependency Version Sweep

### React: Stay on 19.2.x — do NOT upgrade to React 19.2's latest minor

React 19.2 (released 2025-10-01) introduced the Activity API and `useEffectEvent`. These are
additive; 19.2.x patch releases are safe to accept via `^19.2.0`. However, do not upgrade to
a hypothetical 19.3+ until the milestone is scoped for it. The Activity API (`<Activity
mode="hidden">`) is not needed for masonry virtualization — `@virtuoso.dev/masonry` handles
its own DOM management.

**Action:** `npm update react react-dom` to pick up latest 19.2.x patch. No code changes.

### Vite: Stay on 7.x — do NOT upgrade to Vite 8

Vite 8 (released 2026-03-12) is a Rolldown/Oxc rewrite. Breaking changes include:
- `build.rollupOptions` renamed to `build.rolldownOptions`
- `esbuild` config options replaced by `oxc` equivalents  
- CJS interop behavior changes that could affect the esbuild tsx loader used by `node --test`
- Lightning CSS replaces esbuild for CSS minification (Tailwind 4's Vite plugin needs testing)

Vite 7.x is still actively maintained with security backports. The Rolldown migration offers
10-30x faster builds in theory, but Capacitor + the custom `node --test` + esbuild tsx test
runner stack would need non-trivial validation. This is v1.6 work if the build becomes a
bottleneck. **Stay on `^7.3.x` for v1.5.**

**Action:** `npm update vite @vitejs/plugin-react` within the `^7.x` range only.

### Capacitor: Upgrade to 8.3.1 (latest 8.x)

Capacitor 8.3.1 (released 2026-04-16) is the current 8.x latest. It is a minor/patch release
from 8.1.0. No breaking changes within 8.x. Upgrade all `@capacitor/*` packages together:

```bash
npm update @capacitor/core @capacitor/android @capacitor/cli @capacitor/app \
  @capacitor/device @capacitor/haptics @capacitor/local-notifications \
  @capacitor-community/sqlite
```

Note: `@capacitor-community/sqlite` 8.1.0 is already current (published 2026-03-30). Confirm
all packages resolve to 8.x. The Capacitor 8 edge-to-edge requirement and mandatory Node 22+
are already satisfied (they were v1.4-era requirements).

### TypeScript: Stay on 5.9.x — do NOT upgrade to 6.0

TypeScript 6.0 (released 2026-03-17) is a transition release toward TS 7.0 (Go-native port).
It introduces a new `--strictInference` flag (enabled under `--strict`) that tightens ambiguous
generic inference. The Trellis codebase has not been audited for `strictInference` impact; this
upgrade belongs in the tech-debt sweep phase as an explicit task, not a silent `npm update`.
Stay on `~5.9.3` (pinned tilde, not caret).

**Action for v1.5 tech-debt sweep:** Run a `tsc --strict` audit under 5.9.x first (the
existing tsc strictness gap), document which flags are already enabled, then decide whether to
enable the remaining flags before or after a future TS 6.0 migration.

### i18next: Safe to update to 26.0.10

i18next 26.0.10 is the current 26.x latest (published within the last 24 hours as of research
date). v26 breaking changes from v25 are: (a) removed `interpolation.format` legacy function
(Trellis does not use it — all formatting is via `t('key', {count})` standard i18next
interpolation); (b) removed `simplifyPluralSuffix` option (not used in Trellis); (c) dropped
`@babel/runtime` dependency (additive improvement). The Trellis i18n init in `main.tsx` uses
synchronous init — confirmed safe under 26.x.

```bash
npm update i18next react-i18next
```

### react-router-dom: Safe to update to 7.15.0

Latest is 7.15.0 (released ~May 2026). v7.13.x → 7.15.0 are minor/patch releases (security
fixes, new `future.*` flags that are all opt-in). No breaking changes to the `createBrowserRouter`
+ `RouterProvider` + `Outlet` pattern Trellis uses. The SwipeTabContainer route structure is
unaffected.

```bash
npm update react-router-dom
```

### lucide-react: Do NOT upgrade to 1.x in this milestone

lucide-react crossed the 1.0 boundary (current: 1.14.0). The 0.x → 1.0 migration has one
material breaking change: **all brand icons removed** (GitHub, Twitter/X, etc.). Trellis likely
uses some brand icons in Settings (OpenAI, provider logos). Additionally, the package moved to
ESM-only (UMD removed). This migration requires an icon audit and is a dedicated sub-task,
not a `npm update`. Defer to v1.5 tech-debt sweep as an explicit phase, or to v1.6.

**Stay on `^0.575.0` for now.**

**Action:** Add a TODO to the tech-debt sweep: audit all `lucide-react` imports against the
[v1 migration guide](https://lucide.dev/guide/react/migration), replace any removed brand
icons with custom SVGs, then bump.

### framer-motion: Package renamed to `motion` — do NOT migrate this milestone

framer-motion has been renamed to the `motion` package (import from `motion/react` instead of
`framer-motion`). The `framer-motion` npm package still works but is no longer actively
developed. There are no breaking API changes in v12.38.x — this is purely a package rename.

Migration is mechanical (find/replace imports) but touches every animated component in the
project. This is v1.6 work — flag it but do not migrate in v1.5.

**Stay on `framer-motion ^12.38.0` for now.**

### TypeScript ESLint: Safe to update

`typescript-eslint` 8.48.0 → current 8.x. Safe minor update.

```bash
npm update typescript-eslint eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
```

---

## 7. What NOT to Add

| Category | Tempting Option | Why Not |
|----------|----------------|---------|
| Masonry | `react-masonry-css` | No virtualization; column-order problem breaks left-to-right reading |
| Masonry | CSS `grid-template-rows: masonry` | Not supported in Android Chrome (May 2026) |
| Masonry | `masonic` | Stale (last updated ~1 year); awkward window-scroll integration |
| Engagement | IndexedDB | Overkill for <50 KB annotation store; async API adds complexity |
| Engagement | SQLite schema extension | Couples UI annotations to graph data layer |
| Source scoring | WhoisXML / IPQualityScore | API-only; violates local-first constraint |
| Source scoring | `domain-reputation` npm packages | None exist that are suitable for bundling |
| Citation | `remark-footnotes` | Conflicts with `remark-gfm` v4 which already owns footnotes |
| Citation | `react-tooltip` for inline citations | Hover semantics broken on touch; adds ~15 KB |
| Bundler | Vite 8 | Rolldown breaking changes need dedicated migration sprint |
| Language | TypeScript 6.0 | `--strictInference` needs audit before enabling |
| Icons | lucide-react 1.x | Brand icon removal requires explicit icon audit |
| Animation | `motion` package | framer-motion rename; mechanical migration, defer to v1.6 |

---

## 8. Installation Summary

### New production dependency (one)

```bash
npm install @virtuoso.dev/masonry
```

### Version bumps (existing packages, safe)

```bash
npm update react react-dom
npm update @capacitor/core @capacitor/android @capacitor/cli \
  @capacitor/app @capacitor/device @capacitor/haptics \
  @capacitor/local-notifications @capacitor-community/sqlite
npm update i18next react-i18next
npm update react-router-dom
npm update typescript-eslint eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
```

### Pinned / held back

| Package | Current | Available | Hold Reason |
|---------|---------|-----------|-------------|
| vite | ^7.3.1 | 8.0.11 | Rolldown breaking changes |
| typescript | ~5.9.3 | 6.0 | strictInference audit needed |
| lucide-react | ^0.575.0 | 1.14.0 | Brand icon removal audit needed |
| framer-motion | ^12.38.0 | latest (motion rename) | Defer package rename to v1.6 |

### Zero new dev dependencies

The existing `node --test` + esbuild tsx loader pattern covers all new modules. No Vitest, no
additional test utilities.

---

## 9. Android WebView Compatibility Checklist

| Technology | Required API | Android WebView (Capacitor 8) | Safe? |
|------------|-------------|-------------------------------|-------|
| @virtuoso.dev/masonry | ResizeObserver, IntersectionObserver | WebView 76+ (available WebView 117+) | Yes |
| localStorage engagement store | localStorage | All | Yes |
| Custom ReactMarkdown `sup`/`a` override | None (pure React) | All | Yes |
| Bundled domain-tier map | None (compiled TS const) | All | Yes |
| CSS column-count (rejected) | CSS columns | All, but order broken | No |
| CSS grid masonry (rejected) | Experimental flag | Not available | No |

---

## Sources

- [Can I Use — CSS grid-template-rows: masonry](https://caniuse.com/mdn-css_properties_grid-template-rows_masonry) — confirms no Android Chrome support (May 2026)
- [Chrome for Developers — masonry update](https://developer.chrome.com/blog/masonry-update) — Chrome 140 experimental only
- [@virtuoso.dev/masonry npm](https://www.npmjs.com/package/@virtuoso.dev/masonry) — v1.4.3, last published 2026-04-25
- [Virtuoso Masonry docs](https://virtuoso.dev/masonry/) — useWindowScroll, columnCount, ItemContent API
- [masonic GitHub](https://github.com/jaredLunde/masonic) — confirms stale (~1 year no updates)
- [react-masonry-css column-order problem](https://dev.to/iurii_rogulia/react-masonry-layout-why-the-popular-reorder-trick-fails-5f9l) — documents the top-to-bottom fill ordering failure
- [Tavily Search API docs](https://docs.tavily.com/documentation/api-reference/endpoint/search) — confirms no publish date / domain reputation fields in response
- [React 19.2 release](https://react.dev/blog/2025/10/01/react-19-2) — Activity API, useEffectEvent (additive, no breaking changes for 19.2.x)
- [Vite 8 migration guide](https://vite.dev/guide/migration) — Rolldown/Oxc breaking config changes
- [TypeScript 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) — strictInference, transition release toward TS 7.0
- [lucide-react v1 migration](https://lucide.dev/guide/version-1) — brand icon removal breaking change
- [i18next CHANGELOG](https://github.com/i18next/i18next/blob/master/CHANGELOG.md) — v26 breaking changes (legacy format function removed)
- [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide) — framer-motion → motion package rename (no API breakage)
- [react-router-dom CHANGELOG](https://reactrouter.com/changelog) — 7.13 → 7.15 all minor/security
- [Capacitor 8 releases](https://github.com/ionic-team/capacitor/releases) — 8.3.1 current, no 8.x breaking changes
- [RxDB localStorage vs IndexedDB](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html) — performance characteristics at small data scale
- [remarkjs footnote customization discussion](https://github.com/orgs/remarkjs/discussions/1270) — sup/a override pattern confirmed
