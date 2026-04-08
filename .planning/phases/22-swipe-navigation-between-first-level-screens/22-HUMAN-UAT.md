---
status: partial
phase: 22-swipe-navigation-between-first-level-screens
source: [22-VERIFICATION.md]
started: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Swipe between all 5 screens with proportional bottom nav tracking
expected: Bottom nav icon/label colors animate smoothly as finger drags, not just on commit
result: [pending]

### 2. Rubber-band resistance at edges
expected: Drag feels heavier/sticky at Home right-swipe and Settings left-swipe, springs back on release
result: [pending]

### 3. Small swipe (< 20% screen width) snaps back
expected: Short drag returns to original tab; no navigation commit
result: [pending]

### 4. Tab tap triggers slide animation
expected: Tapping Home from Settings slides visually (spring ~250ms), not instant jump
result: [pending]

### 5. Non-adjacent tab tap slides directly without intermediates
expected: Direct spring from current position to target, no intermediate screens flash
result: [pending]

### 6. PostCarousel image swipe does not trigger tab navigation
expected: Swiping the image carousel changes images, not tabs
result: [pending]

### 7. MindElixir graph pan does not trigger tab navigation
expected: Panning inside the graph container moves the mindmap, not the tab strip
result: [pending]

### 8. Keyboard-open suppresses tab swipe
expected: With virtual keyboard visible on Ask screen, horizontal swipe is ignored
result: [pending]

### 9. GraphScreen MindElixir renders correctly when first revealed
expected: Mind map is visible and centered, not 0-width or collapsed
result: [pending]

### 10. Sub-screens render in overlay with swipe disabled
expected: Navigating to /posts/:id shows full-screen overlay, swiping does nothing
result: [pending]

### 11. Scroll position preserved across tab switches
expected: After scrolling Home feed down and switching to Ask and back, Home scroll position is preserved
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps
