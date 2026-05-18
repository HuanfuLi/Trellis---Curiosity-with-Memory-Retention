/**
 * CorrectionCard.test.mjs — Phase 49-02
 *
 * Asserts the per-node-type action matrix (GRAPHUI-01) via the
 * `getActionsForNode` helper PLUS source-reading checks on the CorrectionCard
 * shell + sub-flow + reorg-paused state.
 *
 * Tests 1–6: matrix correctness (pure-function tests, no jsdom).
 * Tests 7–13: source-reading assertions on the component file (no-jsdom convention).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(here, '../../../src/components/graph/CorrectionCard.tsx');

function readSrc() {
  assert.equal(existsSync(SRC_PATH), true, `CorrectionCard.tsx must exist (path: ${SRC_PATH})`);
  return readFileSync(SRC_PATH, 'utf-8');
}

// ─── Matrix tests (pure-function) ────────────────────────────────────────────

test('CorrectionCard.tsx exports getActionsForNode (re-exported from correction-actions.ts)', () => {
  const src = readSrc();
  // Either declared inline OR re-exported from the sibling .ts module.
  const hasDirectExport = /export\s+function\s+getActionsForNode\s*\(/.test(src);
  const hasReExport = /export\s*\{[^}]*\bgetActionsForNode\b[^}]*\}\s*from\s*['"]\.\/correction-actions(\.ts)?['"]/.test(src);
  assert.ok(
    hasDirectExport || hasReExport,
    'CorrectionCard.tsx must export `getActionsForNode` directly OR re-export from ./correction-actions',
  );
});

test('Test 2 — getActionsForNode returns 4 actions for cluster (Rename, Move, Merge, Delete)', async () => {
  const mod = await import('../../../src/components/graph/correction-actions.ts');
  const clusterFixture = {
    id: 'cluster-1',
    title: 'Memory Science',
    content: 'Memory Science',
    isClusterNode: true,
    isAnchorNode: false,
    parentId: undefined,
    flagged: false,
  };
  const actions = mod.getActionsForNode(clusterFixture);
  assert.equal(actions.length, 4, `cluster must yield 4 actions; got ${actions.length}`);
  assert.deepEqual(
    actions.map((a) => a.kind),
    ['rename', 'move', 'merge', 'delete'],
    'cluster action order must be [rename, move, merge, delete]',
  );
});

test('Test 3 — getActionsForNode returns 5 actions for anchor (Rename, Move, Merge, Prune, Delete)', async () => {
  const mod = await import('../../../src/components/graph/correction-actions.ts');
  const anchorFixture = {
    id: 'anchor-1',
    title: 'Spaced Repetition',
    content: 'What is spaced repetition?',
    isAnchorNode: true,
    isClusterNode: false,
    parentId: 'cluster-1',
    flagged: false,
  };
  const actions = mod.getActionsForNode(anchorFixture);
  assert.equal(actions.length, 5, `anchor must yield 5 actions; got ${actions.length}`);
  assert.deepEqual(
    actions.map((a) => a.kind),
    ['rename', 'move', 'merge', 'prune', 'delete'],
    'anchor action order must be [rename, move, merge, prune, delete]',
  );
});

test('Test 4 — getActionsForNode returns 2 actions for QA leaf (Detach, Delete)', async () => {
  const mod = await import('../../../src/components/graph/correction-actions.ts');
  const qaFixture = {
    id: 'qa-1',
    title: 'Forgetting curve',
    content: 'What is the forgetting curve?',
    isAnchorNode: false,
    isClusterNode: false,
    parentId: 'anchor-1',
    flagged: false,
  };
  const actions = mod.getActionsForNode(qaFixture);
  assert.equal(actions.length, 2, `QA leaf must yield 2 actions; got ${actions.length}`);
  assert.deepEqual(
    actions.map((a) => a.kind),
    ['detach', 'delete'],
    'QA leaf action order must be [detach, delete]',
  );
});

test('Test 5 — getActionsForNode returns [] for orphan QA (no parentId)', async () => {
  const mod = await import('../../../src/components/graph/correction-actions.ts');
  const orphanFixture = {
    id: 'qa-orphan',
    title: 'Orphan question',
    content: 'Orphan',
    isAnchorNode: false,
    isClusterNode: false,
    parentId: undefined,
    flagged: false,
  };
  const actions = mod.getActionsForNode(orphanFixture);
  assert.equal(actions.length, 0, `orphan must yield [] (B-6 fix); got ${actions.length}`);
});

test('Test 6 — getActionsForNode returns [] for flagged QA', async () => {
  const mod = await import('../../../src/components/graph/correction-actions.ts');
  const flaggedFixture = {
    id: 'qa-flagged',
    title: 'Off-topic question',
    content: 'Off-topic',
    isAnchorNode: false,
    isClusterNode: false,
    parentId: 'anchor-1',
    flagged: true,
  };
  const actions = mod.getActionsForNode(flaggedFixture);
  assert.equal(actions.length, 0, `flagged must yield [] (B-6 fix); got ${actions.length}`);
});

test('Test 6b — getActionsForNode returns [] for synthetic root/branch IDs (defensive)', async () => {
  const mod = await import('../../../src/components/graph/correction-actions.ts');
  const rootFixture = { id: 'root-knowledge', title: 'Knowledge', content: '', isAnchorNode: false, isClusterNode: false, parentId: undefined };
  const branchFixture = { id: 'branch-Knowledge-Math', title: 'Math', content: '', isAnchorNode: false, isClusterNode: false, parentId: undefined };
  assert.equal(mod.getActionsForNode(rootFixture).length, 0, 'root-knowledge yields []');
  assert.equal(mod.getActionsForNode(branchFixture).length, 0, 'branch-* yields []');
});

// ─── Source-reading tests on CorrectionCard.tsx ──────────────────────────────

test('Test 7 — CorrectionCard renders the paused row when isReorganizing is true', () => {
  const src = readSrc();
  // The component must branch on isReorganizing BEFORE rendering action list / rename form.
  assert.match(
    src,
    /isReorganizing/,
    'CorrectionCard must reference isReorganizing prop',
  );
  // The paused-row i18n key must be present in the source.
  assert.match(
    src,
    /graph\.correction\.reorgPaused/,
    'CorrectionCard must reference the paused-row i18n key',
  );
});

test('Test 8 — CorrectionCard uses the per-action icons from lucide-react', () => {
  const src = readSrc();
  // Verify all 6 action icons + chevron + close are imported.
  assert.match(src, /from\s+['"]lucide-react['"]/, 'imports lucide-react');
  assert.match(src, /\bPencil\b/, 'imports Pencil (rename icon)');
  assert.match(src, /\bMove\b/, 'imports Move (move icon)');
  assert.match(src, /\bGitMerge\b/, 'imports GitMerge (merge icon)');
  assert.match(src, /\bScissors\b/, 'imports Scissors (prune icon)');
  assert.match(src, /\bTrash2\b/, 'imports Trash2 (delete icon)');
  assert.match(src, /\bArrowLeftRight\b/, 'imports ArrowLeftRight (detach icon)');
  assert.match(src, /\bChevronRight\b/, 'imports ChevronRight (row trailing)');
  assert.match(src, /\bX\b/, 'imports X (close button)');
});

test('Test 9 — CorrectionCard rename sub-flow commits via graphCommandService.rename', () => {
  const src = readSrc();
  // Sub-flow gate by 'flow' state with 'rename' literal.
  assert.match(
    src,
    /flow\s*===\s*['"]rename['"]/,
    'CorrectionCard must gate on flow === "rename"',
  );
  // graphCommandService.rename call site.
  assert.match(
    src,
    /graphCommandService\.rename\s*\(/,
    'CorrectionCard must call graphCommandService.rename(...) on submit',
  );
});

test('Test 10 — RenameForm validates against MAX_TITLE_LENGTH = 100 + non-empty trim', () => {
  const src = readSrc();
  // The fast-path validation rule must mirror Phase 48 D-16.
  assert.match(
    src,
    /100/,
    'CorrectionCard must reference 100-char max (Phase 48 D-16)',
  );
  // Use .trim() somewhere in the validation path.
  assert.match(
    src,
    /\.trim\s*\(\s*\)/,
    'CorrectionCard must trim the user-typed title',
  );
  // VALIDATION_ERROR fast-path surface for service-side errors that are not validation.
  assert.match(
    src,
    /VALIDATION_ERROR/,
    'CorrectionCard must surface VALIDATION_ERROR inline (no card close)',
  );
});

test('Test 11 — Cancel button in rename form returns to action list (does not close card)', () => {
  const src = readSrc();
  // The cancel handler must setFlow('list') (NOT call onClose).
  assert.match(
    src,
    /setFlow\(\s*['"]list['"]\s*\)/,
    'rename Cancel must setFlow(\'list\') instead of closing the card',
  );
});

test('Test 12 — X close button invokes onClose', () => {
  const src = readSrc();
  // The close-button handler invokes the onClose prop.
  assert.match(
    src,
    /onClick\s*=\s*\{\s*[^}]*onClose[^}]*\}/,
    'X close button must invoke onClose',
  );
});

test('Test 13 — no Tailwind utility classes in CorrectionCard.tsx', () => {
  const src = readSrc();
  // Look for common Tailwind-utility patterns inside className strings.
  // We allow `className="active-squish"` (a project utility class) — that one is OK.
  const tailwindLike = src.match(/className=["'][^"']*\b(p-\d|flex\b|w-\d|h-\d|m-\d|gap-\d|bg-|text-|rounded-)\b[^"']*["']/g);
  assert.equal(tailwindLike, null, `CorrectionCard.tsx must not use Tailwind utility classes (found: ${tailwindLike})`);
});

test('Test 14 — CorrectionCard exports the component + types', () => {
  const src = readSrc();
  assert.match(src, /export\s+(function|const)\s+CorrectionCard\b/, 'exports CorrectionCard');
  assert.match(src, /export\s+(type|interface)\s+CorrectionCardProps\b/, 'exports CorrectionCardProps type');
  // CorrectionAction may be declared inline OR re-exported from correction-actions.ts.
  const hasDirect = /export\s+type\s+CorrectionAction\b/.test(src);
  const hasReExport = /export\s+type\s*\{[^}]*\bCorrectionAction\b[^}]*\}\s*from\s*['"]\.\/correction-actions(\.ts)?['"]/.test(src);
  assert.ok(hasDirect || hasReExport, 'exports CorrectionAction type (directly or via re-export)');
});
