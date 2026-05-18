/**
 * GraphScreen.reorg-gate.test.mjs — Phase 49-01 + 49-02
 *
 * Source-reading tests on GraphScreen.tsx reorg-gate wiring (D-16).
 * Test 1 went GREEN at end of Plan 49-01 (drag-start gate).
 * Tests 2–4 go GREEN when Plan 49-02 wires CorrectionCard with `isReorganizing`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../src/screens/GraphScreen.tsx');

function readSrc() {
  return readFileSync(SRC_PATH, 'utf-8');
}

test('Test 1 — drag-start handler checks isReorgInProgress (Plan 49-01)', () => {
  const src = readSrc();
  assert.match(
    src,
    /isReorgInProgress\(\)/,
    'GraphScreen must call `isReorgInProgress()` in the drag-start handler (D-16 gate)',
  );
  assert.match(
    src,
    /graph\.correction\.toast\.reorgInProgress/,
    'must toast `graph.correction.toast.reorgInProgress` when drag attempted during reorg',
  );
});

test('Test 2 — CorrectionCard receives isReorganizing prop from reorganizing state', () => {
  const src = readSrc();
  assert.match(
    src,
    /isReorganizing=\{reorganizing\}/,
    'CorrectionCard must receive `isReorganizing={reorganizing}` (Plan 49-02 + D-16)',
  );
});

test('Test 3 — reorganizing state subscribes to REORG_STARTED/COMPLETED/FAILED', () => {
  const src = readSrc();
  assert.match(
    src,
    /eventBus\.subscribe\(\s*['"]REORG_COMPLETED['"]/,
    'must subscribe to REORG_COMPLETED',
  );
  assert.match(
    src,
    /eventBus\.subscribe\(\s*['"]REORG_FAILED['"]/,
    'must subscribe to REORG_FAILED',
  );
  assert.match(
    src,
    /eventBus\.subscribe\(\s*['"]REORG_STARTED['"]/,
    'must subscribe to REORG_STARTED',
  );
});

test('Test 4 — CorrectionCard receives onClose handler that nulls correctionNode', () => {
  const src = readSrc();
  // The onClose handler must reset correctionNode. Allow either inline arrow
  // OR a named handler.
  assert.match(
    src,
    /onClose=\{[^}]*setCorrectionNode\(\s*null\s*\)[^}]*\}/,
    'CorrectionCard onClose must call setCorrectionNode(null) so the card dismisses on close',
  );
});
