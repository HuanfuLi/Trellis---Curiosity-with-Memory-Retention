/**
 * PickModeBanner.test.mjs — Phase 49-04 Task 2
 *
 * 6 source-reading tests verifying Plan 49-04 ships
 * `app/src/components/graph/PickModeBanner.tsx`:
 *   Test 1 — renders banner with `graph.correction.pickMode.move` key when kind=move.
 *   Test 2 — renders banner with `graph.correction.pickMode.merge` key when kind=merge.
 *   Test 3 — Cancel button invokes onCancel.
 *   Test 4 — Escape key on document invokes onCancel (with cleanup).
 *   Test 5 — Renders in-tree (NOT portaled — per R19 + CLAUDE.md Header invariant).
 *   Test 6 — role="status" + aria-live="polite" for screen reader announcement.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/graph/PickModeBanner.tsx');

function readSrc() {
  return readFileSync(SRC_PATH, 'utf-8');
}

test('Test 1 — renders banner with move pickMode i18n key', () => {
  assert.equal(
    existsSync(SRC_PATH),
    true,
    `PickModeBanner.tsx must exist after Plan 49-04 (path: ${SRC_PATH})`,
  );
  const src = readSrc();
  assert.match(
    src,
    /export\s+function\s+PickModeBanner\s*\(/,
    'must export `PickModeBanner` component',
  );
  assert.match(
    src,
    /graph\.correction\.pickMode\.move/,
    'must reference graph.correction.pickMode.move i18n key',
  );
});

test('Test 2 — renders banner with merge pickMode i18n key', () => {
  const src = readSrc();
  assert.match(
    src,
    /graph\.correction\.pickMode\.merge/,
    'must reference graph.correction.pickMode.merge i18n key',
  );
  // Branching on pickMode.kind for the message:
  assert.match(
    src,
    /pickMode\.kind\s*===\s*['"]move['"]/,
    'must branch on pickMode.kind === "move" to pick the message',
  );
});

test('Test 3 — Cancel button invokes onCancel handler', () => {
  const src = readSrc();
  assert.match(
    src,
    /onClick=\{onCancel\}/,
    'Cancel button must wire onClick={onCancel}',
  );
  assert.match(
    src,
    /graph\.correction\.pickMode\.cancel/,
    'must reference graph.correction.pickMode.cancel label',
  );
});

test('Test 4 — Escape key on document invokes onCancel + cleanup', () => {
  const src = readSrc();
  assert.match(
    src,
    /addEventListener\(\s*['"]keydown['"]/,
    'must add a keydown listener on the document',
  );
  assert.match(
    src,
    /e\.key\s*===\s*['"]Escape['"]/,
    'must check for e.key === "Escape"',
  );
  assert.match(
    src,
    /removeEventListener\(\s*['"]keydown['"]/,
    'cleanup must call removeEventListener("keydown", ...)',
  );
});

test('Test 5 — renders in-tree, NOT portaled (R19 + CLAUDE.md Header invariant)', () => {
  const src = readSrc();
  // PickModeBanner MUST NOT import createPortal — it renders in-tree below
  // the Header so the existing GraphScreen Header positioning stays correct.
  assert.equal(
    /createPortal/.test(src),
    false,
    'PickModeBanner must NOT use createPortal — it renders in-tree (R19 + CLAUDE.md)',
  );
});

test('Test 6 — a11y role="status" + aria-live="polite"', () => {
  const src = readSrc();
  assert.match(
    src,
    /role=['"]status['"]/,
    'banner must have role="status"',
  );
  assert.match(
    src,
    /aria-live=['"]polite['"]/,
    'banner must have aria-live="polite" for screen reader pick-mode announcement',
  );
});
