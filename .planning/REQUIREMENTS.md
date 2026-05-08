# Trellis v1.5 Requirements: Curiosity Feed v2 + Tech-Debt Hardening

**Milestone:** v1.5
**Started:** 2026-05-08
**Status:** Active

## Active Requirements

### MASONRY — Pinterest-style 2-column feed layout

- [ ] **MASONRY-01** Feed renders as a 2-column masonry layout via CSS `column-count: 2` + `break-inside: avoid`; cards never split across columns
- [ ] **MASONRY-02** End-of-content state replaces "no more posts" toast with a vine-bloom celebration card and suggested-tomorrow plan when all anchors are explored

### ENGAGE — Local-first engagement signals

- [ ] **ENGAGE-01** User can save / bookmark a post; saved posts persist across days; saved-posts view accessible
- [ ] **ENGAGE-02** User can dismiss / mark "not interested" a concept via long-press contextual menu; dismissed anchors skip in subsequent walker calls
- [ ] **ENGAGE-03** User can like / heart a post; likes persist locally
- [ ] **ENGAGE-04** Tile shows graph-derived social proof: "N connections in your graph" micro-label computed from `candidatePack` at queue-fill time

### CONTENT — Source diversity + richer essays

- [ ] **CONTENT-01** User can request a "Deep dive" essay variant (350-600w) from `PostDetailScreen`; standard 150-250w teaser remains default
- [ ] **CONTENT-02** Web-search filters for per-concept domain rotation: repeated Tavily calls for the same anchor pass `exclude_domains` so re-queries surface fresh sources
- [ ] **CONTENT-03** Essay prompts include 2-3 Tavily snippets (multi-snippet grounding) instead of `sources[0].snippet` only
- [ ] **CONTENT-04** Citations in markdown render via ReactMarkdown `sup`/`a`/`section` component overrides for clean footnote presentation

### TECHDEBT — v1.4 carry-overs + broader hygiene

- [ ] **TECHDEBT-01** i18n leaf-module refactor: `src/lib/i18n-leaf.ts` shim breaks `ERR_IMPORT_ATTRIBUTE_MISSING` chain; 6 service files migrated; 10 carried test failures closed
- [ ] **TECHDEBT-02** VALIDATION drift cleanup: `34-VALIDATION.md` flipped from draft to validated; `35-VALIDATION.md` normalized from `approved` → `validated`
- [ ] **TECHDEBT-03** ROADMAP plan-list polish: 36-14 + 36-15 bullets appended to Phase 36 entry in archived `v1.4-ROADMAP.md`
- [ ] **TECHDEBT-04** 33-HUMAN-UAT-1/2 device retest: touch-target feel + React.memo behavioral correctness verified on physical device
- [ ] **TECHDEBT-05** CLAUDE.md `echolearn_*` localStorage references cleaned up (bulk rename or annotated brand-history note)
- [ ] **TECHDEBT-06** YouTube landscape-listed-as-short bug fixed: feed correctly classifies landscape video posts vs portrait shorts
- [ ] **TECHDEBT-07** TypeScript strictness audit: `tsc` 5.9.x strict-mode gaps documented; remediation plan or in-scope fixes
- [ ] **TECHDEBT-08** Dependency-version sweep: Capacitor 8.1→8.3, i18next 26.0.5→26.0.10, react-router-dom 7.13→7.15, eslint / typescript-eslint minor bumps
- [ ] **TECHDEBT-09** Dead-code sweep: orphan exports, unused imports, removed-feature residue across `src/`
- [ ] **TECHDEBT-10** Performance profiling pass: identify and document hot paths (first-paint, queue refill, masonry scroll); fix any P0/P1 finding
- [ ] **TECHDEBT-11** Project-wide TODO/FIXME triage: catalogue, decide each (close, defer, or in-scope), close the ones in scope
- [ ] **TECHDEBT-12** Operator-note bug sweep: pull from `.planning/notes/*`, triage each note, close or defer

## Future Requirements (deferred to v1.5.x or later)

- **"Less of this" style signal** — `feedPreferences.service.ts` adjusting `STYLE_WEIGHTS` via dependency injection
- **"Trending in your graph" shelf** — requires SQLite review history aggregation
- **Tap-to-expand overlay for post detail** — architectural change replacing 4 detectors (A/B/C/D)
- **Media-type mixing per concept** — `DerivedListEntry` style-annotation system
- **Pull-to-refresh gesture** — low priority
- **SQLite migration for engagement state** — only if localStorage scale becomes an issue
- **Per-style tile height buckets** — masonry visual rhythm refinement
- **Loading skeleton tiles during refill** — polish, layout-shift prevention

## Out of Scope (explicit exclusions)

- **Horizontal swipe-to-dismiss** — gesture conflict with SwipeTabContainer (load-bearing per CLAUDE.md Phase 33 UAT-4). Long-press contextual menu replaces it.
- **Engagement counts → SM-2 scheduling** — like/save is not equivalent to recall success; conflating them corrupts the spaced-repetition model
- **Crowd-sourced "others explored" signals** — requires backend; violates local-first constraint
- **Runtime LLM translation** — prohibited by CLAUDE.md (i18n is dev-time only)
- **CSS Grid Masonry (`grid-template-rows: masonry`)** — Capacitor 8 Android WebView lags Chrome stable; not production-ready in 2026
- **Vite 8 / TypeScript 6.0 / lucide-react 1.x / framer-motion → motion** — major version bumps deferred to v1.6 (Vite 8 is Rolldown rewrite; TS 6.0 strictInference needs dedicated audit; lucide 1.x removes brand icons; framer→motion is mechanical but broad)
- **React 19.x minor bump mid-feature** — held to Wave 4 (avoid StrictMode timing surprises during feature work)

## Traceability

(Empty — filled by roadmap.)

---

*Last updated: 2026-05-08*
