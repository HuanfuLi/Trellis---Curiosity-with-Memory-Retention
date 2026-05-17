# Milestones

## v1.5 Curiosity Feed v2 + Tech-Debt Hardening (Shipped: 2026-05-13)

**Timeline:** 2026-05-08 → 2026-05-13 (5 days)
**Phases:** 10 (37-46)
**Plans:** 44 plan files / 48 summary files
**Git range:** `e10bca7d..c90ebafb`
**Diff:** 278 files / +51,076 / −1,764

**Key accomplishments:**

- **Curiosity Feed v2 shipped** — Pinterest-style two-column masonry feed, vine-bloom end state, richer essays, source diversity, citation rendering, and local-first engagement signals.
- **Engagement UX landed** — save, like, dismiss, saved/liked views, long-press menu, read-boundary dismiss filtering, and Force-New-Day dismissed reset with saved/liked archives preserved.
- **Essay/content pipeline hardened** — Deep Dive variant, multi-snippet Tavily grounding, citation rendering, source-domain rotation, and Phase 46 queued-news prefetch multi-source closure for CONTENT-03.
- **v1.4 carry-overs closed** — i18n leaf-module refactor, validation drift, roadmap polish, device retests, brand-history localStorage docs, and YouTube short-classification removal.
- **Code-quality and dependency sweep complete** — safe in-major dependency updates, strictness/lint/dead-code/TODO/operator-note/performance evidence, GraphScreen Android drag mitigation, and final verification.
- **Milestone audit passed with accepted debt** — 21/21 active requirements satisfied; integration 10/10; remaining debt is documented as non-blocking.

**Audit status:** `tech_debt` — no requirement or integration blockers. Accepted debt: known stale `tests/concept-feed.test.mjs` `buildFallbackPosts` test contract, known lint/build/audit baselines, and partial validation metadata for phases 38/40/41.

**Archive:**

- Roadmap: `.planning/milestones/v1.5-ROADMAP.md`
- Requirements: `.planning/milestones/v1.5-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.5-MILESTONE-AUDIT.md`

---

## v1.4 Curiosity Feed Redesign + UI Polish (Shipped: 2026-05-08)

**Timeline:** 2026-04-16 → 2026-05-08 (22 days)
**Phases:** 10 (28, 29, 30, 31, 32-absorbed, 32.1, 33, 34, 35, 36)
**Plans:** 63 SUMMARY files (+ 32-CLOSURE.md for absorbed phase)
**Git range:** `fdfc2ad7..9e5d1f38` (460 commits / 60 feat commits)
**Diff:** 524 files / +73,067 / −3,801

**Key accomplishments:**

- **VineProgress curiosity feed redesign** — replaced rigid ConceptProgressCard with organic horizontal vine + expandable concept checklist; concept exploration tracked via 3 detectors (scroll 70%, 30s dwell, follow-up question) plus Detector D (YouTube IFrame postMessage) and InfoFlow short tap-to-play emit (Phases 30, 31, 36-08).
- **Concept feed pipeline aligned with design** — derivedList now persistent in QueueState with cyclePosition; cyclic walker with lazy-skip explored anchors; stratified style allocation (largest-remainder + Fisher-Yates); spreadByConcept mixer before spreadByStyle; Promise-mutex refill; durable yesterday-queue snapshot; dev "Force new day" affordance with symmetric two-cache mutation (Phase 36 16/16 plans across 4 rounds).
- **Ask-chat KV-cache prefix preservation** — `useQuestions.ts:askStreaming` system prompt now byte-stable across turns; per-turn graph context lives in tail-position assistant message; USER_ACK_BEFORE_GRAPH_CONTEXT inserted between history and assistant context for strict-alternation chat templates (Qwen via LM Studio); project-wide chatStream/chatCompletion audit confirms 24 one-shot sites + 2 properly append-only (Phase 35).
- **UI/UX audit shipped** — 9 CSS spacing tokens, BottomNavigation slide-down on sub-screens, Header scroll-shadow, SwipeTabContainer resize re-sync, WCAG 2.5.8 44×44 touch targets, trellis shake-on-tap + haptic + pulse-on-focus, "Knowledge Graph" rename across 4 locale bundles, Settings iOS-style sub-page navigation (4 sub-screens), 13 dark-theme CSS vars, full animation polish (Phase 28 30/30 decisions).
- **Code hygiene cleanup** — TD-04 (concept-feed-strategy supersession), TD-05 (3 orphan exports + 4 dead i18n keys), TD-06 (LeafState rename `yellow→dying` / `fallen→dead`), perf memoization (React.memo on ConceptCard + VineProgress), Phase 33 leaf modules (`feed-spread.ts`, `refill-mutex.ts`) for testability (Phases 33, 34, 36).
- **v1.3 gap closure** — TD-01 curiosity-signal wiring, TD-02 + TD-03 AbortSignal plumbing through PostDetailScreen + post-essay.service + classifyAndAnchorIncremental, Node 25 .ts extension sweep on failing-test chain, 25 UAT checkpoints flipped to passed across phases 20/21/22/26 (Phase 29).
- **UAT retest cycles closed** — 5 device-side regressions surfaced and fixed (queue cycling, video touch overlay, starter post persistence, Clear All Data nav, dropdown anchor cosmetic); device retests G2/G4/G5 confirmed PASS by HuanfuLi 2026-04-19; round-4 vine progress chip resync + warm-start re-fallback verified 2026-05-07; UAT round 5 device pass 2026-05-08 (Phases 32.1, 36-14, 36-15).
- **Rebrand EchoLearn → Trellis** — single commit `9e5d1f38`; source code, native config (Capacitor bundle ID), localStorage keys (`echolearn_*` → `trellis_*` via legacy-migration.service.ts runtime migration), and user-facing copy. On-disk directory + sqlite connection name `'echolearn'` intentionally preserved per CLAUDE.md "Brand history" note.

**Test baseline at close:** 570 / 560 pass / 10 fail / tsc clean / vite clean

**Audit status:** `tech_debt` — 16 of 26 v1.3-carried test failures closed; 10 architectural carry-overs (i18n leaf-module refactor) explicitly accepted to v1.5 first wave

**Archive:**

- Roadmap: `.planning/milestones/v1.4-ROADMAP.md`
- Requirements: `.planning/milestones/v1.4-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.4-MILESTONE-AUDIT.md`
- Phase directories: `.planning/milestones/v1.4-phases/`

---
