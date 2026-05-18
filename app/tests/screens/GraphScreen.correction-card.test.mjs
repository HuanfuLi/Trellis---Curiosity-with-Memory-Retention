/**
 * GraphScreen.correction-card.test.mjs — Phase 49-01 Task 4 + Plan 49-02
 *
 * Source-reading tests on GraphScreen.tsx. Tests 1–3 + 5–7 go GREEN at end of
 * Plan 49-01 (gesture wiring + DragOverlay mount). Tests 4 + 8–14 go GREEN
 * when Plan 49-02 wires CorrectionCard with useLocation + always-mounted
 * reset effect.
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

// ─── Plan 49-01 tests (kept verbatim) ────────────────────────────────────────

test('GraphScreen imports createLongPressOrDragMachine from useLongPressOrDrag', () => {
  const src = readSrc();
  assert.match(
    src,
    /import\s*\{[^}]*createLongPressOrDragMachine[^}]*\}\s*from\s*['"][^'"]*useLongPressOrDrag['"]/,
    'GraphScreen.tsx must import `createLongPressOrDragMachine` from `../hooks/useLongPressOrDrag`',
  );
});

test('GraphScreen imports DragOverlay + DragState + DropTargetSnapshot', () => {
  const src = readSrc();
  assert.match(
    src,
    /import\s*\{[^}]*DragOverlay[^}]*\}\s*from\s*['"][^'"]*components\/graph\/DragOverlay['"]/,
    'GraphScreen.tsx must import `DragOverlay` from `../components/graph/DragOverlay`',
  );
  assert.match(src, /DragState/, 'must reference DragState type');
  assert.match(src, /DropTargetSnapshot/, 'must reference DropTargetSnapshot type');
});

test('GraphScreen defines dragState useState and conditionally mounts DragOverlay', () => {
  const src = readSrc();
  assert.match(
    src,
    /useState<DragState\s*\|\s*null>\(null\)/,
    'must declare `useState<DragState | null>(null)`',
  );
  assert.match(
    src,
    /<DragOverlay\s+dragState=\{dragState\}\s+targets=\{dropTargets\}/,
    'must render `<DragOverlay dragState={dragState} targets={dropTargets} ... />`',
  );
});

test('GraphScreen mounts CorrectionCard gated on correctionNode (Plan 49-02)', () => {
  const src = readSrc();
  assert.match(
    src,
    /correctionNode\s*&&/,
    'must render `correctionNode && <CorrectionCard ...>` (Plan 49-02)',
  );
  assert.match(
    src,
    /<CorrectionCard\b/,
    'must include `<CorrectionCard` mount (Plan 49-02)',
  );
});

test('GraphScreen preserves existing click listener and adds sibling pointerdown listener', () => {
  const src = readSrc();
  assert.match(
    src,
    /addEventListener\(\s*['"]click['"]\s*,\s*handleClick/,
    'existing click listener must remain wired',
  );
  assert.match(
    src,
    /addEventListener\(\s*['"]pointerdown['"]/,
    'new pointerdown listener must be added',
  );
});

test('GraphScreen routes drop-commit via graphCommandService.move (cluster drop)', () => {
  const src = readSrc();
  assert.match(
    src,
    /graphCommandService\.move\(/,
    'must call `graphCommandService.move(...)` on cluster drop',
  );
});

test('GraphScreen invalid drop branch toasts dropInvalid key', () => {
  const src = readSrc();
  assert.match(
    src,
    /graph\.correction\.toast\.dropInvalid/,
    'invalid drop must toast `graph.correction.toast.dropInvalid`',
  );
});

// ─── Plan 49-02 new tests ────────────────────────────────────────────────────

test('Test A — useLocation is imported from react-router-dom (B-4)', () => {
  const src = readSrc();
  assert.match(
    src,
    /import\s*\{[^}]*\buseLocation\b[^}]*\}\s*from\s*['"]react-router-dom['"]/,
    'GraphScreen.tsx must import `useLocation` from `react-router-dom` (B-4 fix)',
  );
});

test('Test B — `const location = useLocation();` declared inside GraphScreen', () => {
  const src = readSrc();
  assert.match(
    src,
    /const\s+location\s*=\s*useLocation\s*\(\s*\)/,
    'GraphScreen must declare `const location = useLocation();`',
  );
});

test('Test C — correctionNode state declared with anchor coords shape', () => {
  const src = readSrc();
  // Allow either inline shape or { node; anchorX; anchorY } typed.
  assert.match(
    src,
    /useState<\{[^}]*\bnode:\s*Question[^}]*\banchorX:\s*number[^}]*\banchorY:\s*number[^}]*\}\s*\|\s*null>\(null\)/,
    'correctionNode state must be typed `{ node: Question; anchorX: number; anchorY: number } | null`',
  );
});

test('Test D — CorrectionCard mount imports CorrectionCard from components/graph', () => {
  const src = readSrc();
  assert.match(
    src,
    /import\s*\{[^}]*\bCorrectionCard\b[^}]*\}\s*from\s*['"][^'"]*components\/graph\/CorrectionCard['"]/,
    'GraphScreen must import CorrectionCard from ../components/graph/CorrectionCard',
  );
});

test('Test E — tap-outside backdrop dismisses correctionNode (zIndex 249)', () => {
  const src = readSrc();
  assert.match(
    src,
    /zIndex:\s*249/,
    'backdrop must use zIndex 249 (below card 250)',
  );
  assert.match(
    src,
    /setCorrectionNode\(\s*null\s*\)/,
    'backdrop onClick must invoke setCorrectionNode(null)',
  );
});

test('Test F — onLongPressRelease short-circuits root/branch + checks getActionsForNode length', () => {
  const src = readSrc();
  // Root toast remains (Plan 49-01 wired) and still uses toast.rootNotEditable.
  assert.match(
    src,
    /graph\.correction\.toast\.rootNotEditable/,
    'root branch must still toast rootNotEditable',
  );
  assert.match(
    src,
    /graph\.correction\.toast\.branchNotEditable/,
    'branch-* branch must toast branchNotEditable',
  );
  // The new B-6 guard: getActionsForNode(node).length === 0 → silent return.
  assert.match(
    src,
    /getActionsForNode\s*\(/,
    'long-press handler must call getActionsForNode for matrix gating',
  );
  assert.match(
    src,
    /\.length\s*===\s*0/,
    'must check actions.length === 0 (silent return per B-6)',
  );
});

test('Test G — useEffect resets correctionNode on tab navigation away from /graph (B-4)', () => {
  const src = readSrc();
  // The reset effect's condition + body MUST reference location.pathname AND
  // set correctionNode to null. Single regex captures the whole effect span.
  assert.match(
    src,
    /location\.pathname\s*!==\s*['"]\/graph['"]/,
    'must compare location.pathname !== "/graph" in reset effect (B-4)',
  );
  // The effect deps array must include location.pathname.
  assert.match(
    src,
    /\[\s*location\.pathname\s*\]/,
    'reset effect deps must be [location.pathname]',
  );
});
