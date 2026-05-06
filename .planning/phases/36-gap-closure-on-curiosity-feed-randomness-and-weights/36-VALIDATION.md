---
phase: 36
slug: gap-closure-on-curiosity-feed-randomness-and-weights
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `36-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` with esbuild tsx loader |
| **Config file** | none — see `app/package.json` `"test"` script |
| **Quick run command** | `cd app && node --test tests/services/derived-list.test.mjs tests/services/style-assignment-stratified.test.mjs tests/services/spread-by-concept.test.mjs tests/services/style-assignment.test.mjs tests/services/post-queue.test.mjs` |
| **Full suite command** | `cd app && npm test` |
| **Estimated runtime** | ~6 seconds (quick), ~45 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 36-W0-01 | 36-00 | 0 | GAP-1 / GAP-2 / REGRESSION | unit (stub) | `node --test tests/services/derived-list.test.mjs` | ❌ W0 | ⬜ pending |
| 36-W0-02 | 36-00 | 0 | GAP-3 | unit (stub) | `node --test tests/services/style-assignment-stratified.test.mjs` | ❌ W0 | ⬜ pending |
| 36-W0-03 | 36-00 | 0 | GAP-4 | unit (stub) | `node --test tests/services/spread-by-concept.test.mjs` | ❌ W0 | ⬜ pending |
| 36-01-01 | 36-01 | 1 | GAP-3 | unit | `node --test tests/services/style-assignment-stratified.test.mjs` | ✅ after W0 | ⬜ pending |
| 36-02-01 | 36-02 | 1 | GAP-4 | unit | `node --test tests/services/spread-by-concept.test.mjs` | ✅ after W0 | ⬜ pending |
| 36-03-01 | 36-03 | 2 | GAP-1 / GAP-2 | unit | `node --test tests/services/derived-list.test.mjs` | ✅ after W0 | ⬜ pending |
| 36-04-01 | 36-04 | 3 | GAP-1..4 (integration) | integration | `cd app && npm test` | n/a | ⬜ pending |
| 36-05-01 | 36-05 | 3 | GAP-6 (doc drift) | grep | `grep -q "MAX_QUEUE_SIZE = 32" CLAUDE.md` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Final task IDs may shift slightly when planner emits PLAN.md frontmatter — this map mirrors RESEARCH.md's Test Map and the planner is expected to keep the columns in sync.*

---

## Wave 0 Requirements

- [ ] `app/tests/services/derived-list.test.mjs` — covers GAP-1 (append-only, persistence, reset, migration), GAP-2 (walker advances, wraps, lazy-skip explored, returns empty when all explored), REGRESSION (important anchors get 2× entries)
- [ ] `app/tests/services/style-assignment-stratified.test.mjs` — covers GAP-3 (round(N×w) ±1 per style; small-batch text-art floor; image/suggestion present in 8-entry batches; respects API-availability redistribution BEFORE stratification; deterministic under seeded RNG)
- [ ] `app/tests/services/spread-by-concept.test.mjs` — covers GAP-4 (no same-concept-adjacent when 2+ concepts; single-concept input unchanged; combined with spreadByStyle preserves both invariants)

*All three are NEW files. Existing test files (`style-assignment.test.mjs`, `post-queue.test.mjs`, `concept-batch-filter.test.mjs`) provide regression coverage and are NOT modified except where research's "Open Question 2" comment is added.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Feed feels varied across 4-post swipes after fix | GAP-3, GAP-4 (subjective UX) | Distribution feel is judgmental, not assertable | After install: open app, swipe-for-more 5×, observe — image/news/video/short should each appear at least once across the 20 posts; same concept should not appear in 2 of any 4 consecutive posts when ≥2 concepts are due |
| No regression in image pre-gen + downgrade flow | (already-correct invariant) | Async + provider-dependent | After install with image-gen key: trigger refill; check devtools for `[refillQueue] pre-generating N image(s)` log + no `downgraded` post-render fallback in InfoFlow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (planner flips this after Wave 0 lands)

**Approval:** pending
