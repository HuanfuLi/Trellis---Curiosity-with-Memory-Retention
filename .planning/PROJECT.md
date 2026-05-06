# PROJECT: EchoLearn

## What This Is

EchoLearn is an AI-powered personalized learning platform designed to facilitate non-linear knowledge acquisition through AI-driven content generation, visual knowledge mapping, and spaced repetition. It bridges the gap between passive content consumption and active, long-term learning.

The platform prioritizes a high-quality, native-first mobile experience built with React, TypeScript, Vite, and Capacitor, combining local-first privacy with seamless AI integration (OpenAI, Claude, Gemini, and local LLMs).

## Core Value

Enable learners to transform fragmented information into structured knowledge through AI-driven Q&A, visual mapping, and adaptive spaced repetition—all while maintaining complete local-first privacy.

## Current Milestone: v1.4 (next — planning)

**Status:** Awaiting scope. v1.3 (pre-release) closed 2026-04-16 with phases 20-27 shipped — see `.planning/v1.3-MILESTONE-AUDIT.md`. First queued phase is Phase 28 (UI/UX polish from audit findings). Pre-existing tsc/Node 25 items from v1.3 should be rolled into v1.4 planning.

## Previous Milestones

- **v1.0** — phases 5-6 (foundation UI polish, question quality evaluation)
- **v1.1** — phases 7-9 (image-forward feed, post detail, infinite scroll)
- **v1.2** — phases 10-19 (Planner auto-suggestions, knowledge graph classification, token optimization, feed expansion, web search)
- **v1.3 (pre-release)** — phases 20-27 (orchestration, streaming, swipe nav, incremental classification, Trellis, harvest actions, i18n/L10n)

## Key Decisions

- **Local-First Privacy:** All user data persists locally via localStorage/SQLite. No backend required.
- **LLM Flexibility:** Support multiple providers (OpenAI, Claude, Gemini, local endpoints like LM Studio).
- **Visual-First UX:** Post feeds emphasize images and hooks (questions/stories) to drive engagement.
- **Adaptive Recommendations:** Planner logic respects user trajectory, review performance, and engagement patterns.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

**Phase 14 complete (2026-03-29):** Knowledge Graph Classification & Anchor Nodes — dedicated second LLM classification call, concept anchor nodes (isAnchorNode), Q&A attachment via parentId, mindmap renders anchors as collapsed leaves with expand/retract Q&A children. GRAPH-01 through GRAPH-06 validated.

**Phase 23 complete (2026-04-09):** Incremental Classification Pipeline + Ask Rate Limiter — replaced single-call classification with 3-step branch→cluster→anchor pipeline using append-only messages for KV cache efficiency. Added configurable monthly rate limiter with Settings UI, inline warning/error banners, and send button disable at limit.

**Phase 26 complete (2026-04-15):** Trellis Harvest Panel + Node Actions + Suggested Moves Refactor — Planner now shows a flat 3-column status panel (Dying | Fruit | Dead) with Fruit as a centered harvest button (direct tap, fly-to-counter + confetti, credits persisted). Suggested Moves refactored to be trellis-health-driven (dead → dying → filtered autoGen); heal, re-plant, and prune actions live directly on the rows. Re-plant reuses the "Learn as Post" flow (fire-and-forget, bumps node to dying state). PrunedSection archive at page bottom. UX simplified from the originally-planned bottom-sheet design per user feedback (D-09/D-14/D-17 voided, D-13 modified — see `.planning/phases/26-*/26-ADDENDUM.md`). Also landed cross-cutting fix: BottomNavigation tap = instant transport (reverted from Phase 22's animated jump), finger-swipe keeps the spring; all 5 first-level screens always mounted + always visible.

**Phase 27 complete (2026-04-16):** i18n/L10n support — 4 locales shipped (EN canonical + Simplified Chinese + Spanish + Japanese). `i18next` + `react-i18next` with synchronous init in `main.tsx`; 602 flattened keys across all 4 bundles (ZH 92.7% / ES 90.2% / JA 92.4% leaf coverage — remainder are intentional EN retention for proper nouns, provider names, LLM system prompts per D-07). Centralized locale injection: LLM provider prepends `applyLocaleDirective` to system prompts (D-12), TTS maps locale→voice (D-13), YouTube forwards `hl`/`regionCode` (D-14), Tavily web-search stays English by design (D-15), dates use `Intl.DateTimeFormat` (D-11). User flow: onboarding Language step (4-option script picker with cross-locale `Language / 语言 / Idioma / 言語` header, D-18), Settings locale switcher with instant swap (D-19), mid-stream LLM abort on `LOCALE_CHANGED` event (D-22 — `AbortController` shared across Pass 1/2 streams), locale-specific CSS font stacks via `:root[data-locale]` overrides (D-23). Workflow codified: root `CLAUDE.md` requires syncing all 4 bundles when adding UI strings; `app/scripts/translate-locales.md` is the Sonnet subagent template for future re-translations (D-09). Dev-time translation only — runtime LLM translation is prohibited (D-07). Operator UAT walkthrough approved (D-24).

**Milestone v1.3 (pre-release) complete (2026-04-16):** Phases 20-27 archived as milestone v1.3. Audit: `.planning/v1.3-MILESTONE-AUDIT.md`. Phase archives moved to `.planning/milestones/v1.3-phases/`. Phase 28 queued as first phase of v1.4. Four phases carry `human_needed` verification status (20, 21, 22, 26) — automated checks pass; visual/timing/feel QA on device is the pending work if v1.4 decides to close those gaps.

**Phase 35 complete (2026-04-29, empirically closed via UAT round 2):** Ask-chat system-prompt stability — moved per-turn `formatCandidateContextPack` interpolation out of the system role into a tail-position assistant message in both Pass 1 and Pass 2 of `useQuestions.askStreaming`. Provider KV-cache prefix now covers `[system, ...history]` across chat turns instead of breaking at the first dynamic byte. UAT round 1 surfaced a CONTEXT.md D-08 risk: Qwen 3.5 via LM Studio rejected the assistant-before-user shape with "No user query found in messages" jinja error. Plan 35-05 inserted a constant byte-stable `USER_ACK_BEFORE_GRAPH_CONTEXT` user message between history and the assistant context, restoring user→assistant→user alternation while preserving cache properties (constant ack stays inside the byte-stable prefix). UAT round 2 confirmed all 3 tests pass on Qwen via LM Studio. Source-reading invariant test (`useQuestions-system-prompt-stability.test.mjs`, 6/6 green) prevents future drift on both invariants. CLAUDE.md gained a new "Ask-chat system prompt — byte-stable across turns (Phase 35 — load-bearing)" section with strict-alternation rationale documenting the LM Studio incident. Phase 32.1 lesson #8 (documentation in three places: inline comment + test + CLAUDE.md) applied. Project-wide chatStream/chatCompletion audit confirmed 24/26 call sites are intentionally one-shot; Phase 23 classification descent in `canonical-knowledge.service.ts` remains append-only. Closes the public self-disclosure in `LabPresentation/SCRIPTS.md` slide 4.7 — line can flip from "I haven't shipped the fix yet" to past tense.

**Phase 36 complete (2026-05-06, verifier 13/13 must-haves):** Curiosity-feed randomness/weights gap closure — closed four design-drift gaps between live code and CLAUDE.md "Concept Feed Generation Pipeline" load-bearing section. (GAP-1) Derived list promoted from per-call ad-hoc array to persistent `derivedList: string[]` field in `QueueState` localStorage payload, with append-only semantics across same-day refill cycles. (GAP-2) New `walkDerivedList(count, exploredIds)` cyclic walker advances a persisted `cyclePosition` index, lazy-skipping explored conceptIds via `dailyReadService.getExploredAnchors()` at walk time (not array splicing — the index-stable approach avoids cyclePosition corruption). (GAP-3) i.i.d. style sampling replaced with Hamilton's largest-remainder allocation + Fisher-Yates shuffle in `style-assignment.ts`, guaranteeing `round(N×w_style)` of each available style ±1 per N-entry batch — small batches no longer starve image/news/video/short. (GAP-4) New `spreadByConcept` mixer (in new leaf module `feed-spread.ts` — workaround for the i18n JSON-import-attribute chain that prevented test imports through `concept-feed.service.ts`) wires into `enqueueInterleaved` BEFORE the existing `spreadByStyle`. Two-branch placement algorithm (skip-position formula for dominant buckets, half-stride for balanced) provably keeps max-run ≤ 2 even when one important anchor monopolizes 6 of 8 entries. (GAP-6) CLAUDE.md doc-sync: `MAX_QUEUE_SIZE = 32` documented, `appendToDerivedList` cross-referenced, lazy-skip described, GAP-1/3/4 struck from "Known divergences" with closure annotations. GAP-5 (variable-count vs strict-4 per swipe) intentionally out of scope — generateMorePosts default is 4 and the only caller passes 4, so the loose contract is empirically tight. Phase 33 fixes preserved: `dueAnchors` filter at concept-feed.service.ts:798 + `allExplored` cap-gate at 1265-1267 verified intact. 33 new passing tests across 4 files (derived-list 10, style-assignment-stratified 10, spread-by-concept 7, refill-queue-integration 6); npm test baseline preserved at 422 pass / 26 pre-existing JSON-import-attribute fail. Plan 36-00 wrote Wave-0 RED tests FIRST (per Phase 32.1 lesson #2 — tests must guard the LIVE code path), Waves 1-3 flipped them to GREEN. Two checker-iteration-1 blockers landed correctly: (a) appendToDerivedList uses seed-once-before-loop `existing` variable with NO in-loop mutation so first-call multiplicity (8 entries for an important anchor) is preserved while across-call dedup still works, (b) integration-smoke imports STYLE_WEIGHTS from style-assignment.ts (drift-proof, negative-grep enforced) instead of redeclaring inline.

_Last updated: 2026-05-06 — Phase 36 (curiosity-feed randomness and weights gap closure) verified 13/13 must-haves_
