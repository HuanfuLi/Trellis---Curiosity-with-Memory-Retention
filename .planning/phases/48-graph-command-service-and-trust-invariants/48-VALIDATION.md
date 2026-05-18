---
phase: 48
slug: graph-command-service-and-trust-invariants
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `48-RESEARCH.md` §Validation Architecture (lines 1329–1410).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node --test` (Node 20+) with esbuild tsx loader |
| **Config file** | `app/package.json` scripts `test`, `test:main`, `test:actions` |
| **Quick run command** | `cd app && node --test tests/services/graph-command-service.<verb>.test.mjs` (per-file) |
| **Full suite command** | `cd app && npm test` |
| **Mock loader for command-service tests** | `--import ./tests/services/_actions-mock-loader.mjs` |
| **Estimated runtime** | ~30–60s (full suite incl. 10 new files); <2s per single file |

---

## Sampling Rate

- **After every task commit:** Run the verb-specific file (`graph-command-service.<verb>.test.mjs`) — <2s
- **After every plan wave:** Run `cd app && npm test` — full suite
- **Before `/gsd:verify-work`:** Full suite must be green; plan-checker must verify all 10 new test files exist + pass
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01 | 1 | GRAPH-04 | T-48-01 (journal tamper) | `isValidPreImage` rejects malformed `before`/`after` shapes | unit | `node --test tests/services/graph-edit-journal.test.mjs` | ❌ W0 | ⬜ pending |
| 48-01 | 1 | GRAPH-04 | T-48-03 (quota) | `append` honors N=10 cap with FIFO eviction; QuotaExceededError caught | unit | `node --test tests/services/graph-edit-journal.test.mjs` | ❌ W0 | ⬜ pending |
| 48-01 | 1 | GRAPH-04 | — | Reorg prompt includes `Manual corrections to preserve:` block when journal non-empty; byte-stable when journal unchanged | source-reading + behavioral | `node --test tests/services/reorg-prompt-journal-injection.test.mjs` | ❌ W0 | ⬜ pending |
| 48-02 | 2 | GRAPH-02 | — | Rename: title patched; embedding strategy preserves retrieval identity on failure (Blocker #4 fix); 100-char cap; empty rejected; bypass `normalizeAnchorName` | unit | `node --test tests/services/graph-command-service.rename.test.mjs` | ❌ W0 | ⬜ pending |
| 48-02 | 2 | GRAPH-02 | — | Move: parentId/branchLabel/clusterLabel/clusterNodeId updated; qaCount recomputed on both old + new parent; nodeSummary updated | unit | `node --test tests/services/graph-command-service.move.test.mjs` | ❌ W0 | ⬜ pending |
| 48-02 | 2 | GRAPH-03 | — | Delete: full record snapshot in journal; cascade children re-parent to cluster; emit handled (single `GRAPH_UPDATED`) | unit | `node --test tests/services/graph-command-service.delete.test.mjs` | ❌ W0 | ⬜ pending |
| 48-02 | 2 | GRAPH-01 | — | Per-command invariant: ONE journal entry + ONE `GRAPH_UPDATED` (or one delegated emit) on success; ZERO on failure | unit | (included in per-verb files) | ❌ W0 | ⬜ pending |
| 48-03 | 2 | GRAPH-03 | — | Merge: children reparent; loser hard-deleted; survivor `qaCount` + `embeddingVector` recomputed with graceful degradation; full loser snapshot in journal | unit | `node --test tests/services/graph-command-service.merge.test.mjs` | ❌ W0 | ⬜ pending |
| 48-03 | 2 | GRAPH-03 | — | Detach: placement fields cleared; `classifyAndAnchorIncremental` fires fire-and-forget; AbortSignal threaded; LOCALE_CHANGED cancels mid-flight (D-19) | unit | `node --test tests/services/graph-command-service.detach.test.mjs` | ❌ W0 | ⬜ pending |
| 48-03 | 2 | GRAPH-03 | — | Prune: delegates to `trellisActionsService.prune`; journal entry; emit; PrunedSection subscriber chain preserved | unit | `node --test tests/services/graph-command-service.prune.test.mjs` | ❌ W0 | ⬜ pending |
| 48-04 | 3 | GRAPH-03 + GRAPH-04 | T-48-01 (validate before applying) | Undo: pops newest entry; correctly inverts each cmd type via swapped-snapshots (D-06 strategy); append-only; empty journal returns NOT_FOUND | unit | `node --test tests/services/graph-command-service.undo.test.mjs` | ❌ W0 | ⬜ pending |
| 48-04 | 3 | GRAPH-01 | — | End-to-end integration: rename → move → merge → undo sequence yields expected store + journal state | integration | `node --test tests/services/graph-command-service.integration.test.mjs` | ❌ W0 | ⬜ pending |
| 48-04 | 3 | GRAPH-01 (success criterion 3) | — | Reload survival: after a command commits and storage rehydrates, `questionService.getAll()` returns post-command state | integration | `node --test tests/services/graph-command-service.reload-survival.test.mjs` | ❌ W0 | ⬜ pending |
| 48-04 | 3 | GRAPH-01 | — | Concurrency: per-process mutex serializes overlapping command calls; no journal interleaving | unit | (included in integration test) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All 10 test files are NEW — Wave 0 creates them alongside the production files.

- [ ] `app/tests/services/graph-edit-journal.test.mjs` — GRAPH-04 (journal mechanics + tamper validation + quota)
- [ ] `app/tests/services/reorg-prompt-journal-injection.test.mjs` — GRAPH-04 (reorg prompt)
- [ ] `app/tests/services/graph-command-service.rename.test.mjs` — GRAPH-02 (rename + retrieval-identity preservation)
- [ ] `app/tests/services/graph-command-service.move.test.mjs` — GRAPH-02 (move)
- [ ] `app/tests/services/graph-command-service.merge.test.mjs` — GRAPH-03 (merge)
- [ ] `app/tests/services/graph-command-service.detach.test.mjs` — GRAPH-03 (detach + LOCALE_CHANGED cancellation)
- [ ] `app/tests/services/graph-command-service.prune.test.mjs` — GRAPH-03 (prune delegation)
- [ ] `app/tests/services/graph-command-service.delete.test.mjs` — GRAPH-03 (delete)
- [ ] `app/tests/services/graph-command-service.undo.test.mjs` — GRAPH-03 (undo) + GRAPH-04 (N=10 cap)
- [ ] `app/tests/services/graph-command-service.integration.test.mjs` — GRAPH-01 (boundary end-to-end)
- [ ] `app/tests/services/graph-command-service.reload-survival.test.mjs` — GRAPH-01 success criterion 3
- [ ] `app/package.json` — extend `test:actions` script to include the new files via `_actions-mock-loader.mjs` register hook

**Framework install:** None — already in place. `node --test` is built-in (Node 20+).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reorg prompt LLM compliance — does Claude/GPT actually respect the `Manual corrections to preserve:` block? | GRAPH-04 | Requires a live LLM call; cost + nondeterminism unsuited to unit tests | Phase 49 dogfooding: after building the UI, manually (a) rename an anchor, (b) trigger `reorganizeMindmap`, (c) confirm the renamed anchor's title survives. Log a /planning todo if the LLM ignores the constraint. |
| Cross-screen UX re-read — does GraphScreen's selected-node card update after a command? | success criterion 3 (in-flight) | Requires running the app | **Deferred to Phase 49** per Blocker #5 resolution — the SERVICE guarantees post-command state via `questionService.getAll()` re-read; UI subscription is a Phase 49 GRAPHUI-* concern. |

---

## Validation Sign-Off

- [ ] All tasks have `<acceptance_criteria>` with automated verify references OR Wave 0 dependency on the corresponding test file
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all 11 MISSING test references above
- [ ] No watch-mode flags (`--watch`, `node --test --watch`, etc.)
- [ ] Feedback latency <60s (full suite) / <2s (per-file)
- [ ] `nyquist_compliant: true` set in frontmatter only after all checkboxes above are ticked

**Approval:** pending (created 2026-05-17, awaiting plan revision pass)
