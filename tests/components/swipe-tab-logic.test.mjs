/**
 * swipe-tab-logic.ts — Pure Gesture Logic Unit Tests
 *
 * Phase 22, Plan 01 — TDD RED scaffold
 * Tests run via: node --test tests/components/swipe-tab-logic.test.mjs
 *
 * Tests pure functions extracted from SwipeTabContainer gesture handling:
 *   - resolveAxisLock: axis lock after 10px threshold
 *   - computeDragOffset: rubber-band at edges
 *   - resolveCommitIndex: 20% screen-width threshold for commit
 *   - shouldBlockGesture: keyboard + nested-drag guard
 *
 * Requirements covered: SWIPE-01, SWIPE-02, SWIPE-03, SWIPE-04, SWIPE-05
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAxisLock,
  computeDragOffset,
  resolveCommitIndex,
  shouldBlockGesture,
} from '../../app/src/lib/swipe-tab-logic.ts';

// ─── Test group: resolveAxisLock (SWIPE-01 / D-07) ─────────────────────────

describe('resolveAxisLock', () => {
  it('returns "x" when horizontal offset exceeds threshold', () => {
    const result = resolveAxisLock({ x: 15, y: 3 });
    assert.equal(result, 'x');
  });

  it('returns "y" when vertical offset exceeds threshold', () => {
    const result = resolveAxisLock({ x: 3, y: 15 });
    assert.equal(result, 'y');
  });

  it('returns null when both offsets are below threshold', () => {
    const result = resolveAxisLock({ x: 5, y: 5 });
    assert.equal(result, null);
  });
});

// ─── Test group: computeDragOffset (SWIPE-03 / D-13) ───────────────────────

describe('computeDragOffset', () => {
  it('returns raw offset unchanged for middle screen', () => {
    const result = computeDragOffset(100, 2, 5);
    assert.equal(result, 100);
  });

  it('applies rubber-band factor at left edge (index 0, positive offset)', () => {
    const result = computeDragOffset(100, 0, 5);
    assert.equal(result, 25); // 100 * 0.25
  });

  it('applies rubber-band factor at right edge (last index, negative offset)', () => {
    const result = computeDragOffset(-100, 4, 5);
    assert.equal(result, -25); // -100 * 0.25
  });
});

// ─── Test group: resolveCommitIndex (SWIPE-02 / D-14) ──────────────────────

describe('resolveCommitIndex', () => {
  it('commits right when negative offset exceeds 20% threshold', () => {
    // offset=-80, screenWidth=375 → threshold=75, |80| > 75 → commit right
    const result = resolveCommitIndex(-80, 1, 375, 5);
    assert.equal(result, 2);
  });

  it('commits left when positive offset exceeds 20% threshold', () => {
    const result = resolveCommitIndex(80, 1, 375, 5);
    assert.equal(result, 0);
  });

  it('snaps back when offset is below threshold', () => {
    // offset=-50, screenWidth=375 → threshold=75, |50| < 75 → snap back
    const result = resolveCommitIndex(-50, 1, 375, 5);
    assert.equal(result, 1);
  });

  it('cannot go past right edge', () => {
    // At last index (4), negative offset should not go further
    const result = resolveCommitIndex(-80, 4, 375, 5);
    assert.equal(result, 4);
  });
});

// ─── Test group: shouldBlockGesture (SWIPE-04, SWIPE-05 / D-08, D-09) ─────

describe('shouldBlockGesture', () => {
  it('returns true when keyboard is open', () => {
    const result = shouldBlockGesture({ keyboardOpen: true, gestureBlocked: false });
    assert.equal(result, true);
  });

  it('returns true when gesture is blocked by nested draggable', () => {
    const result = shouldBlockGesture({ keyboardOpen: false, gestureBlocked: true });
    assert.equal(result, true);
  });

  it('returns false when neither keyboard nor gesture block is active', () => {
    const result = shouldBlockGesture({ keyboardOpen: false, gestureBlocked: false });
    assert.equal(result, false);
  });
});
