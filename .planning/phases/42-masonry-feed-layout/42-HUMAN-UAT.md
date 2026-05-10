---
status: partial
phase: 42-masonry-feed-layout
source: [42-VERIFICATION.md]
started: 2026-05-09T02:00:00.000Z
updated: 2026-05-09T02:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. VineBloomCard end-to-end
expected: After all anchors are explored (real CONCEPT_EXPLORED events fired by reading every post in the daily feed), the VineBloomCard renders at the bottom of the home feed with the vine illustration, suggested-tomorrow plan, and Heal/Re-plant/Open Planner CTAs visible.
result: [pending]

### 2. Column stability under scroll
expected: With real card heights (image posts, variable text-art lengths, video tiles, news tiles), cards never jump between columns when scrolling or when new tiles append. Each tile stays in the column it was first assigned to (height-accumulating split is append-only — confirmed by `tileColumnAssignmentsRef` immutability guard at MasonryFeed.tsx:382).
result: [pending]

### 3. Reduced Motion honored
expected: With `System Preferences → Accessibility → Reduce Motion → ON`, reload `/home` and trigger swipe-for-more. New tiles appear instantly with no fade-up entrance animation. `<MotionConfig reducedMotion="user">` wrapper should propagate through framer-motion v12 (RESEARCH.md Pitfall 1).
result: [pending]

### 4. VineBloomCard navigation CTAs
expected: With a real anchor dataset (mix of dying/dead leafStates), tapping Heal navigates to `/review` with anchorId/qaIds/title; tapping Re-plant navigates to `/posts/anchor-post-{id}`; tapping Open Planner navigates to `/planner`. ZERO new methods on `trellisActionsService` (Pitfall 3 — confirmed by source-reading test).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
