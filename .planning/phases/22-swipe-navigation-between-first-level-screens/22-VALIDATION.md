---
phase: 22
slug: swipe-navigation-between-first-level-screens
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `cd app && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd app && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd app && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Populated after plans are created.*

---

## Wave 0 Requirements

- [ ] Existing test infrastructure covers phase requirements — no new framework installs needed

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Swipe gesture feel (rubber-band, live peek) | D-06, D-13 | Visual/haptic UX quality | Swipe left/right on each screen, verify smooth animation and adjacent screen peek |
| Axis lock conflict with vertical scroll | D-07 | Gesture interaction quality | Scroll vertically on Home feed, then try diagonal swipe — verify axis locks correctly |
| Real-time bottom nav tracking | D-03 | Visual animation synchronization | Slowly drag horizontally, verify nav highlight follows finger position proportionally |
| MindElixir gesture conflict | D-10 | Canvas drag interaction | Pan the knowledge graph, verify nav swipe doesn't interfere |
| Keyboard-open swipe suppression | D-09 | Keyboard state interaction | Focus Ask input, try swiping — verify swipe is blocked |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
