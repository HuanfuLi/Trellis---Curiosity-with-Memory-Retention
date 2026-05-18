// Plan 48-03 Task 3 — graphCommandService.prune
//
// Covers D-14/D-17/R6:
//   - prune(anchorId) DELEGATES to trellisActionsService.prune
//     (preserving the existing ANCHOR_DELETED emit + PrunedSection
//     subscriber chain). This is R6's consolidation decision: delegate,
//     don't replace.
//   - On success: writes ONE journal entry (cmd='prune', before captures
//     pre-state flags) AND emits ONE GRAPH_UPDATED with payload.kind
//     === 'prune'. NOTE: trellisActionsService.prune emits ANCHOR_DELETED,
//     NOT GRAPH_UPDATED — so the command-boundary GRAPH_UPDATED is the
//     ONLY GRAPH_UPDATED. No double-emit risk on this verb.
//   - No-op: anchor already pruned (flagged && prunedFromTrellis) →
//     success, no journal, no GRAPH_UPDATED, no delegated call.
//   - Validation: QA target (isAnchorNode !== true) → VALIDATION_ERROR;
//     missing target → NOT_FOUND.
//
// Isolation per R10 risk 8: storage.clear() + _resetStore([]) +
// graphEditJournal.clear() per test.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

function makeAnchor(overrides = {}) {
  return {
    id: `anchor-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    date: '2026-05-17',
    content: 'What is X?',
    answer: 'X.',
    summary: 'X',
    title: 'X',
    keywords: [],
    relatedQuestionIds: [],
    categoryIds: ['cat-general'],
    reviewSchedule: { nextReviewDate: '2026-05-17', reviewCount: 0, easeFactor: 2.5 },
    createdAt: Date.now(),
    isAnchorNode: true,
    flagged: false,
    prunedFromTrellis: false,
    ...overrides,
  };
}

function makeQA(overrides = {}) {
  return {
    id: `qa-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    date: '2026-05-17',
    content: 'placeholder content',
    answer: 'placeholder answer',
    summary: 'placeholder summary',
    title: 'Placeholder',
    keywords: [],
    relatedQuestionIds: [],
    categoryIds: ['cat-general'],
    reviewSchedule: { nextReviewDate: '2026-05-17', reviewCount: 0, easeFactor: 2.5 },
    createdAt: Date.now(),
    ...overrides,
  };
}

async function resetAll() {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([]);
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  graphEditJournal.clear();
}

// ════════════════════════════════════════════════════════════════════════
// Source-reading invariants — acceptance criteria grep gates
// ════════════════════════════════════════════════════════════════════════

test('source: prune delegates to trellisActionsService.prune (R6)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes('trellisActionsService.prune'),
    'prune must call trellisActionsService.prune (R6 — delegate, don\'t replace)',
  );
});

test('source: prune body validates isAnchorNode (QAs cannot be pruned)', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  // detach body also references isAnchorNode/isClusterNode, so count
  // occurrences to ensure prune adds its own gate.
  const occurrences = (src.match(/isAnchorNode/g) ?? []).length;
  assert.ok(
    occurrences >= 2,
    `prune body must reference isAnchorNode to enforce its validation (detach also references it); found ${occurrences}`,
  );
});

test('source: prune emits typed GRAPH_UPDATED with kind="prune" from command boundary', () => {
  const src = readFileSync(
    new URL('../../src/services/graph-command.service.ts', import.meta.url),
    'utf8',
  );
  assert.ok(
    src.includes("kind: 'prune'"),
    'prune must emit GRAPH_UPDATED with payload.kind === "prune"',
  );
});

// ════════════════════════════════════════════════════════════════════════
// Validation tests
// ════════════════════════════════════════════════════════════════════════

test('prune missing id → NOT_FOUND', async () => {
  await resetAll();
  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.prune('not-real');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'NOT_FOUND');
});

test('prune QA (non-anchor) → VALIDATION_ERROR', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeQA({ id: 'qa-1' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.prune('qa-1');
  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.ok(/anchor/i.test(result.error.message), 'error message mentions anchors-only');
});

// ════════════════════════════════════════════════════════════════════════
// No-op (already pruned)
// ════════════════════════════════════════════════════════════════════════

test('prune already-pruned anchor → success no-op; no journal; no GRAPH_UPDATED; no delegated call', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'anchor-A', flagged: true, prunedFromTrellis: true })]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const graphEvents = [];
  const anchorDeletedEvents = [];
  const unsubGraph = eventBus.subscribe('GRAPH_UPDATED', (e) => graphEvents.push(e));
  const unsubAnchor = eventBus.subscribe('ANCHOR_DELETED', (e) => anchorDeletedEvents.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.prune('anchor-A');
  unsubGraph();
  unsubAnchor();

  assert.equal(result.success, true);
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  assert.equal(graphEditJournal.list().length, 0, 'no journal entry for no-op prune');
  assert.equal(graphEvents.length, 0, 'no GRAPH_UPDATED for no-op prune');
  assert.equal(anchorDeletedEvents.length, 0, 'no ANCHOR_DELETED (delegate not called)');

  // Store state unchanged.
  const stored = _getStore().find((q) => q.id === 'anchor-A');
  assert.equal(stored.flagged, true);
  assert.equal(stored.prunedFromTrellis, true);
});

// ════════════════════════════════════════════════════════════════════════
// Happy path — delegate + journal + emit
// ════════════════════════════════════════════════════════════════════════

test('prune: delegates to trellisActionsService.prune (anchor patched with flagged=true + prunedFromTrellis=true)', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'anchor-A', flagged: false, prunedFromTrellis: false })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.prune('anchor-A');
  assert.equal(result.success, true);

  const stored = _getStore().find((q) => q.id === 'anchor-A');
  assert.equal(stored.flagged, true, 'flagged must be true after delegated prune');
  assert.equal(stored.prunedFromTrellis, true, 'prunedFromTrellis must be true after delegated prune');
});

test('prune: emits ANCHOR_DELETED via the delegated trellisActionsService.prune (R6 invariant — PrunedSection chain)', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'anchor-A' })]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('ANCHOR_DELETED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.prune('anchor-A');
  unsub();

  assert.equal(result.success, true);
  assert.equal(events.length, 1, 'ANCHOR_DELETED must fire (preserving PrunedSection subscriber chain)');
  assert.equal(events[0].payload?.anchorId, 'anchor-A');
});

test('prune: emits EXACTLY one GRAPH_UPDATED with payload.kind === "prune"', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'anchor-A' })]);

  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.prune('anchor-A');
  unsub();

  assert.equal(result.success, true);
  // trellisActionsService.prune emits ANCHOR_DELETED, NOT GRAPH_UPDATED —
  // so the command-boundary GRAPH_UPDATED is the ONLY GRAPH_UPDATED.
  assert.equal(events.length, 1, 'EXACTLY one GRAPH_UPDATED (no double-emit risk on prune)');
  assert.equal(events[0].payload?.kind, 'prune');
  assert.equal(events[0].payload?.anchorId, 'anchor-A');
});

test('prune journal entry: cmd=prune, targetIds=[anchorId], before snapshots {flagged:false, prunedFromTrellis:false}, after records {flagged:true, prunedFromTrellis:true}', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeAnchor({ id: 'anchor-A', flagged: false, prunedFromTrellis: false })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.prune('anchor-A');
  assert.equal(result.success, true);

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 1);

  const entry = entries[0];
  assert.equal(entry.cmd, 'prune');
  assert.deepEqual(entry.targetIds, ['anchor-A']);
  assert.equal(entry.before.flagged, false);
  assert.equal(entry.before.prunedFromTrellis, false);
  assert.equal(entry.after.flagged, true);
  assert.equal(entry.after.prunedFromTrellis, true);
});
