---
phase: 26
slug: trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) |
| **Config file** | none — uses node --test directly |
| **Quick run command** | `cd app && node --test tests/services/trellis-*.test.mjs` |
| **Full suite command** | `cd app && node --test tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | HARVEST-CREDITS | unit | `node --test tests/services/trellis-credits.test.mjs` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | HARVEST-EVENT | unit | `node --test tests/services/trellis-harvest.test.mjs` | ❌ W0 | ⬜ pending |
| 26-02-01 | 02 | 2 | STATUS-PANEL | integration | manual — visual layout | N/A | ⬜ pending |
| 26-03-01 | 03 | 3 | HEAL-ACTION | unit | `node --test tests/services/trellis-heal.test.mjs` | ❌ W0 | ⬜ pending |
| 26-03-02 | 03 | 3 | REPLANT-ACTION | unit | `node --test tests/services/trellis-replant.test.mjs` | ❌ W0 | ⬜ pending |
| 26-04-01 | 04 | 4 | PRUNE-ACTION | unit | `node --test tests/services/trellis-prune.test.mjs` | ❌ W0 | ⬜ pending |
| 26-05-01 | 05 | 5 | MOVES-REFACTOR | unit | `node --test tests/services/trellis-moves.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/trellis-credits.test.mjs` — credit accumulation and persistence
- [ ] `tests/services/trellis-harvest.test.mjs` — harvest clears blossom dates, emits event
- [ ] `tests/services/trellis-heal.test.mjs` — heal resets overdue schedule
- [ ] `tests/services/trellis-replant.test.mjs` — replant resets flashcard schedules
- [ ] `tests/services/trellis-prune.test.mjs` — prune flags question, getPrunedQuestions returns it
- [ ] `tests/services/trellis-moves.test.mjs` — dedup filter, priority ordering

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Harvest collection animation | D-03 | Visual animation timing | Tap harvest → fruits fly to counter + confetti |
| Scissors prune animation | D-17 | Visual animation | Tap prune → scissors cut + leaf falls |
| Status panel glow on fruits | D-05 | Visual CSS effect | Check glow when fruit count > 0 |
| Bottom sheet interaction | D-09 | Touch/scroll UX | Tap column → sheet opens with correct items |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
