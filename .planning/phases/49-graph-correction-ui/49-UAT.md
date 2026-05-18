---
status: diagnosed
phase: 49-graph-correction-ui
source: 49-05-SUMMARY.md
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Magnetic snap on long-press drag
expected: Long-press anchor at default 0.5× zoom → haptic + ghost @480ms → drag toward another anchor → halo activates within ~32px → ghost snaps to target. Acceptable band 24-48px.
result: issue
reported: "Yes popover displayed, but was triggered by release of finger after long-press instead of time-lapsed of long-press like the long-press behavior in feed post tiles. Another issue: The graph canvas is also moved along with the node when user long-press and drag the node, which keeps the node centered and cannot really be repositioned to other location. Blocked."
severity: major
findings:
  - "Long-press menu fires on FINGER RELEASE rather than on the 480ms TIMER tick. Expected: menu pops while finger is still down at 480ms (matches feed post tile long-press behavior)."
  - "Canvas pans along with the dragged ghost — node stays visually centered relative to viewport, so the user cannot reposition the node relative to other anchors. MindElixir pan/zoom is not being suppressed during long-press-drag."

### 2. Haptic feedback
expected: Long-press a node → light tap haptic at 480ms. Drag + drop on a valid cluster → medium tap haptic at drop.
result: skipped
reason: "Skipped after Test 1 failure surfaced that the long-press menu fires on finger-release instead of at the 480ms timer tick. Haptic-at-480ms is likely affected by the same root cause; defer to post-fix re-verification on phone."

### 3. Drag does not fight MindElixir pan/zoom
expected: Pinch-zoom out to ~0.3×; long-press a deep anchor; drag toward a different cluster. Gesture commits without the map snapping back to default scale.
result: skipped
reason: "Pinch-zoom needs a touch device; operator testing on web (no Capacitor deploy yet). Test 1 already captured the broader 'canvas pans with drag' issue at default zoom."

### 4. Pick-mode banner + Header positioning
expected: Long-press an anchor → Move row → banner appears below Header. Swipe to Planner tab and back to Graph. Header stays in place; banner is still visible OR resets cleanly (always-mounted reset effect nulls pickMode on /graph leave).
result: pass
note: "Confirmed 'resets cleanly' path — pickMode nulled on /graph leave, banner gone on return. Operator confirmed the disappearing element was the pick-mode banner (intentional), not the Graph tab Header (which would be a regression)."

### 5. Pick-mode original-coord restore (W-2)
expected: Long-press an anchor in the upper-left of the visible map → Move row → banner → tap Cancel in banner. CorrectionCard reappears at the ORIGINAL anchor position (upper-left), NOT at screen-center.
result: pass

### 6. Reorganize gate (D-16)
expected: Trigger Reorganize; during reorg, long-press an anchor → card shows paused row; attempt drag → toast "Reorganize in progress — try again in a moment" and ghost does NOT mount; Undo button is grayed. After REORG_COMPLETED, all controls re-enable.
result: pass

### 7. Detach two-emit correlation (B-1)
expected: Long-press a Q&A leaf → Detach (Re-classify) row → wait for classifier. Toast surfaces the re-anchored OR same-anchor variant with the resulting anchor title. If LLM is slow (>5s), toast may be silent (B-1 timeout fallback) but the map still updates correctly.
result: pass

### 8. Undo summary toast (B-5)
expected: Rename an anchor → tap Undo corner button → toast reads `Undone: rename '<new>' → '<old>'` (operator-facing `summary`), NOT a bare verb literal like `Undone: rename`.
result: pass

### 9. Prune toast type review (W-6)
expected: Prune an anchor → snackbar appears with type `'info'` (current default). Operator decides: accept `'info'` OR file a follow-up to switch to `'success'`. Record the decision in 49-05-SUMMARY.md's Operator Decisions section.
result: pass
decision: "info — accepted current default; prune is a soft reversible action, neutral coloring is appropriate. No follow-up needed."

### 10. All translations (zh / es / ja)
expected: Switch app to zh / es / ja in Settings. Repeat long-press → correction card flow; action labels render in the selected locale; interpolated titles render correctly. Proper nouns like "Trellis" are NOT translated.
result: pass

## Summary

total: 10
passed: 7
issues: 1
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "Long-press menu fires at the 480ms timer tick (haptic + ghost appear while finger is still pressed); long-press-drag suppresses MindElixir pan/zoom so the dragged node can be repositioned relative to other anchors."
  status: failed
  reason: "User reported: 'Yes popover displayed, but was triggered by release of finger after long-press instead of time-lapsed of long-press like the long-press behavior in feed post tiles. Another issue: The graph canvas is also moved along with the node when user long-press and drag the node, which keeps the node centered and cannot really be repositioned to other location. Blocked.'"
  severity: major
  test: 1
  findings:
    - "Long-press menu fires on FINGER RELEASE rather than at the 480ms TIMER tick. Expected: menu pops while finger is still down at 480ms (matches feed post tile long-press behavior)."
    - "Canvas pans along with the dragged ghost — node stays visually centered, so it cannot be repositioned relative to other anchors. MindElixir pan/zoom is not suppressed during long-press-drag."
  root_cause_finding_1: "useLongPressOrDrag.ts createLongPressOrDragMachine (lines 78-149) is structurally wrong: the 480ms setTimeout (line 104-108) only sets internal didLongPress=true + fires haptic; it never invokes a consumer-visible 'long-press recognized' callback. onLongPressRelease fires from inside onPointerUp (line 148), gated on didLongPress && !didDrag. GraphScreen wires CorrectionCard mount to onLongPressRelease (GraphScreen.tsx:439-442 → handleLongPressRelease at 769-797), so the card only mounts after the user lifts their finger. Diverges from the codebase feed-tile convention at useLongPress.ts:42-45 which fires the callback INSIDE the timer."
  root_cause_finding_2: "Two stacked issues. (a) MindElixir registers its own pointerdown/pointermove/pointerup listeners on the SAME container GraphScreen attaches its delegated gesture listener to (MindElixir.js:1095-1101). (b) With Trellis's editable:false config, MindElixir's pointerdown handler ALWAYS falls into the pan branch — t.mousedown=true + setPointerCapture(pointerId) on first touch (MindElixir.js:1044-1045). Every subsequent pointermove calls t.onMove(dx,dy) → e.move(dx,dy) which pans the map. GraphScreen never neutralizes MindElixir's pan after long-press is recognized: no mei.dragMoveHelper.clear(), no capture-phase stopPropagation, no override of MindElixir's pointer capture. setPointerCapture at GraphScreen.tsx:446 fires only on onDragStart (480ms + 8px later) and only reroutes events — it does NOT prevent MindElixir's co-registered listener on the same container from firing."
  artifacts:
    - path: "app/src/hooks/useLongPressOrDrag.ts"
      issue: "Missing onLongPressRecognized callback inside the 480ms timer (Finding 1)"
    - path: "app/src/screens/GraphScreen.tsx"
      issue: "handlePointerDown (line 404-484) never engages MindElixir pan-suppression; comment at 379-380 acknowledges half of the constraint without implementing the other half (Finding 2)"
    - path: "app/tests/hooks/useLongPressOrDrag.test.mjs"
      issue: "Test 1 (lines 64-87) asserts onLongPressRelease fires AFTER pointerup, encoding the bug; no test asserts mid-press recognition"
    - path: "app/tests/components/graph/DragOverlay.test.mjs"
      issue: "No behavioral test for the 'MindElixir pan suppressed during drag' invariant"
  missing:
    - "onLongPressRecognized callback invoked inside the 480ms timer (alongside didLongPress=true + haptic). Match useLongPress.ts:42-45 pattern."
    - "GraphScreen wires setCorrectionNode to onLongPressRecognized instead of onLongPressRelease (drop the latter — no consumer the new callback doesn't already cover)."
    - "MindElixir pan-suppression engaged at the same 480ms recognition point. Three layered defenses in the new onLongPressRecognized GraphScreen handler: (a) call mei.dragMoveHelper.clear() to reset MindElixir's internal mousedown=true; (b) attach capture-phase pointermove listener on container calling event.stopPropagation(), torn down on pointerup/pointercancel; (c) re-setPointerCapture to the container (not the target node) so MindElixir's pointerup also routes correctly. Move existing setPointerCapture out of onDragStart."
    - "Rewrite useLongPressOrDrag.test.mjs Test 1 to assert onLongPressRecognized fires at the 480ms tick BEFORE any pointerup."
    - "Add integration test app/tests/screens/GraphScreen.gesture-isolation.test.mjs asserting mei.move is NOT invoked between recognition and pointerup."
    - "Update load-bearing comment at GraphScreen.tsx:379-380 to reflect the new symmetric 'DO stopPropagation AFTER recognition' policy."
  debug_session: ".planning/debug/phase-49-gesture-engine.md"
