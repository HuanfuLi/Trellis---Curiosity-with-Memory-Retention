---
status: partial
phase: 26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status
source: [26-VERIFICATION.md]
started: 2026-04-15T07:00:00Z
updated: 2026-04-15T07:35:00Z
---

## Current Test

[awaiting human re-test of tests 3, 4, 5, 7 after runtime fixes]

## Tests

### 1. Harvest animation — fly-to-counter + confetti
expected: Tapping "Harvest All" in the fruit bottom sheet fires amber cherry particles flying from the status panel center to the header counter, then triggers a confetti burst 1.2s later. All particles share a unified animation (not per-fruit-type).
result: passed

### 2. Fruit column glow when count > 0
expected: The Fruits column in the status panel pulses with a warm amber glow (status-glow keyframe, 3s loop) when any anchor has leafState==='fruit'. Column is inert when count is 0.
result: passed

### 3. Heal flow — parallel podcast add + review navigation
expected: Tapping "Heal" on a dying anchor in the bottom sheet (or in the Suggested Moves list) adds the topic to today's podcast queue AND navigates to /review with the anchor filtered. Both happen together, not sequentially as choices.
result: pending — blocked initially by pre-existing `hashStr is not defined` runtime error in trellis-state.service.ts which prevented trellis recompute from producing dying/dead nodes in real data. Fixed in commit 715e5ec4 (added missing hashStr import). Awaiting retest.

### 4. Re-plant flow — schedule reset + post generation + review navigation
expected: Tapping "Re-plant" on a dead anchor resets all flashcard and question SM-2 schedules to today (reviewCount=0, easeFactor=2.5), generates a new post for the anchor topic, shows a "Schedule reset - review to revive" toast, then navigates to /review filtered to that anchor.
result: pending — blocked by same hashStr error as #3 (no real dead nodes rendered). Fixed. Awaiting retest.

### 5. Prune animation — scissors cut + leaf fall
expected: Tapping "Prune" on a dying or dead node plays a scissors snip animation on the scissors icon, then the node card translates down 60px while fading out. Node disappears from sheet and appears in pruned archive.
result: pending — original keyframe was too subtle (single 25deg rotation, 0.3s, 14px icon). Fixed in commit 983a9688: multi-snip animation with 35deg rotation + scale pulse, 0.5s duration, 16px icon. Leaf-fall delay bumped to 0.5s + timeout to 1.0s. Awaiting retest.

### 6. Suggested Moves priority ordering with real trellis data
expected: With a mix of dead, dying, and healthy anchors — dead anchors appear first with Sprout icon and "Re-plant" red badge; dying anchors appear second with Heart icon and "Heal" yellow badge; autoGen moves appear third. The total count badge on the section header reflects all three groups combined.
result: passed

### 7. AutoGen dedup — no anchor appears in both trellis moves and autoGen
expected: If an autoGen move's conceptId matches a dying or dead anchor, that autoGen move is suppressed from the list. The same anchor does not appear in two places in Suggested Moves.
result: pending — blocked by hashStr error (same as #3/#4). Fixed. Awaiting retest.

## Summary

total: 7
passed: 3
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

### Gap 1: hashStr not imported in trellis-state.service.ts
status: resolved
detected: 2026-04-15 during human UAT test #3
resolution: commit 715e5ec4 — added hashStr to existing import from trellis-layout.service.ts
source_test: 3
notes: Pre-existing bug (logged in deferred-items.md pre-phase) surfaced during dev-mode disabled testing with real data. Harvest UAT with mocked data masked it.

### Gap 2: Prune scissors animation not visible
status: resolved
detected: 2026-04-15 during human UAT test #5
resolution: commit 983a9688 — multi-snip keyframe, 0.5s duration, 35deg + 1.15 scale, 16px icon, transformOrigin:center, display:inline-block; leaf-fall delay → 0.5s, setTimeout → 1.0s
source_test: 5
