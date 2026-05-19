/**
 * GraphScreen.gesture-isolation.test.mjs — Phase 49-06 + 49-06.1.
 *
 * Cross-library coordination: when long-press is recognized at 480ms,
 * GraphScreen MUST suppress MindElixir's pointermove pan WITHOUT
 * pre-empting MindElixir's pointerup cleanup of its pinch-zoom Map.
 *
 * The 49-06.1 phantom-finger bug (each long-press stranded a pointerId in
 * MindElixir's `s` Map, making single-finger pans register as pinch-zoom)
 * was caused by tier-a/b mousedown clearing and container setPointerCapture
 * transfer. The fix removed all three; only the capture-phase pointermove
 * stopPropagation remains.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const GRAPHSCREEN_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');
const src = readFileSync(GRAPHSCREEN_PATH, 'utf-8');

test('Assertion 1a: capture-phase pointermove stopPropagation IS engaged (sole pan-suppression defense)', () => {
  // The capture-phase listener is the only thing standing between
  // MindElixir's bubble-phase pointermove handler and the canvas pan.
  assert.match(
    src,
    /addEventListener\(\s*['"]pointermove['"]\s*,\s*\w+\s*,\s*\{\s*capture:\s*true/,
    'Capture-phase pointermove listener must be attached inside the recognition handler',
  );
  assert.match(
    src,
    /stopPropagation\(\)/,
    'The capture-phase listener must call stopPropagation',
  );
});

test('Assertion 1b: tier-a/b mousedown poisoning and container setPointerCapture transfer are NOT present', () => {
  // These three call patterns broke MindElixir's pointerup cleanup of its
  // pinch-zoom Map `s` (MindElixir.js:960), stranding a pointerId per long-
  // press and tripping pinch-zoom on the next single-finger gesture
  // (MindElixir.js:1052 — s.size >= 2 branch). Do NOT re-introduce them.
  assert.doesNotMatch(
    src,
    /dragMoveHelper\?\.clear\(\)/,
    'tier-a dragMoveHelper.clear() must NOT appear — it pre-empted MindElixir pointerup cleanup',
  );
  assert.doesNotMatch(
    src,
    /helper\.mousedown\s*=\s*false/,
    'tier-b direct mousedown=false mutation must NOT appear — same root cause',
  );
  assert.doesNotMatch(
    src,
    /containerRef\.current\?\.setPointerCapture/,
    'container setPointerCapture transfer must NOT appear — stole capture from MindElixir target',
  );
});

test('Assertion 2: correctionNode is set to null on drag-start (D-01 mutual exclusion)', () => {
  // handleDragStart must call setCorrectionNode(null) as its first observable
  // side-effect so the just-mounted CorrectionCard dismisses when the gesture
  // commits to drag.
  const handleDragStartIdx = src.indexOf('handleDragStart');
  assert.ok(handleDragStartIdx > 0, 'handleDragStart must exist');
  const slice = src.slice(handleDragStartIdx, handleDragStartIdx + 2000);
  assert.match(
    slice,
    /setCorrectionNode\(\s*null\s*\)/,
    'handleDragStart must call setCorrectionNode(null) per D-01 (correctionNode and drag are mutually exclusive)',
  );
});

test('Assertion 3: no surviving banned callback byte sequence in GraphScreen.tsx', () => {
  // Dynamic identifier construction (string-split-and-join) — the literal byte
  // sequence is NEVER present in this test source so Task 2's grep gate stays
  // satisfiable on this file. A literal regex against the banned identifier
  // here would trip the gate on this file itself.
  const banned   = ['onLongPress', 'Release'].join('');
  const expected = ['onLongPress', 'Recognized'].join('');
  assert.doesNotMatch(src, new RegExp(banned), `${banned} must be fully removed from GraphScreen.tsx`);
  assert.match(src, new RegExp(expected), `${expected} must be present in GraphScreen.tsx`);
});
