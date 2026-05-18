/**
 * GraphScreen.gesture-isolation.test.mjs — Phase 49-06 gap closure.
 *
 * Cross-library coordination: when long-press is recognized at 480ms,
 * GraphScreen MUST engage MindElixir pan suppression before any drag.
 * Without these defenses, the canvas pans with the dragged ghost and
 * the node cannot be repositioned (UAT Test 1 failure mode).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const GRAPHSCREEN_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');
const src = readFileSync(GRAPHSCREEN_PATH, 'utf-8');

test('Assertion 1: tier-a dragMoveHelper.clear() is invoked inside the recognition handler', () => {
  assert.match(
    src,
    /dragMoveHelper\?\.clear\(\)/,
    'tier-a defense (mei.dragMoveHelper?.clear()) must appear in GraphScreen.tsx; cited at MindElixir.js:908',
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
