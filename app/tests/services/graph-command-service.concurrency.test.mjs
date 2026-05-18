// Plan 48-04 Task 2 — Concurrency: per-process mutex (refill-mutex pattern)
//
// R10 risk 9: the per-process createPromiseMutex serializes commands at
// the boundary. Note that refill-mutex's `run(fn)` DEDUPES concurrent
// callers (`if (inFlight) return inFlight`) rather than queueing them —
// this is by design (Phase 36 leaf extraction: the original boolean mutex
// had bailers silently no-op, causing empty-swipe bugs; the Promise mutex
// makes concurrent callers AWAIT the same body Promise so they all see
// the same successful result). See refill-mutex.ts header.
//
// Consequence for graphCommandService: three parallel renames against the
// same id execute the FIRST one's body once; the second and third callers
// share that Promise and return the same success. Net journal effect = 1
// entry per concurrent burst.
//
// Assertions:
//   - All N parallel calls resolve with { success: true } (mutex shares
//     the body Promise).
//   - The journal records ONE entry per burst — the mutex's dedup pattern
//     is the source-of-truth for "what really ran."
//   - SEQUENTIAL (awaited) commands DO produce N journal entries with
//     correctly chained before/after — proving the mutex releases between
//     awaits and the read-fresh-inside-mutex discipline works.

import assert from 'node:assert/strict';
import test from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

function makeNode(overrides = {}) {
  return {
    id: `q-${Math.random().toString(16).slice(2)}`,
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
  const { _resetStore, _setDeleteFail } = await import('./_actions-mock-question.mjs');
  _resetStore([]);
  if (typeof _setDeleteFail === 'function') _setDeleteFail(false);
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  graphEditJournal.clear();
  const settingsMod = await import('./_actions-mock-settings.mjs');
  if (typeof settingsMod._setEmbeddingConfigured === 'function') {
    settingsMod._setEmbeddingConfigured(true);
  }
}

// ════════════════════════════════════════════════════════════════════════
// Concurrent (Promise.all) renames against the same id — mutex DEDUPES.
// All callers share the same in-flight Promise per the refill-mutex
// design. Net effect: ONE rename body executes; ONE journal entry.
// ════════════════════════════════════════════════════════════════════════

test('concurrent rename × 3 on same id (Promise.all): all resolve success; mutex dedupes → 1 journal entry', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1', title: 'Orig', content: 'Orig', summary: 'Orig' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');

  // Fire all three at once — the mutex's `if (inFlight) return inFlight`
  // pattern (refill-mutex.ts:51) makes the second and third callers share
  // the first caller's Promise. The fn for callers 2/3 is NEVER invoked.
  const results = await Promise.all([
    graphCommandService.rename('q-1', 'A'),
    graphCommandService.rename('q-1', 'B'),
    graphCommandService.rename('q-1', 'C'),
  ]);

  for (const r of results) {
    assert.equal(r.success, true, 'all parallel renames must resolve success (shared Promise)');
  }

  // Mutex dedup: only the FIRST rename's body actually executed. Its
  // newTitle landed on the store.
  const finalTitle = _getStore().find((q) => q.id === 'q-1').title;
  assert.equal(finalTitle, 'A', 'mutex dedup runs ONLY the first rename body; final title = A');

  // Journal: ONE entry (only the first body wrote one).
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 1, 'mutex dedup → one journal entry per concurrent burst');
  assert.equal(entries[0].cmd, 'rename');
  assert.equal(entries[0].after.title, 'A');
});

// ════════════════════════════════════════════════════════════════════════
// SEQUENTIAL renames against the same id — mutex releases between awaits,
// each body sees the previous one's mutation via read-fresh-inside-mutex.
// Net effect: N rename bodies; N journal entries; chained before/after.
// ════════════════════════════════════════════════════════════════════════

test('sequential rename × 3 on same id (awaited): each body sees previous mutation; journal chains via before/after', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1', title: 'Orig', content: 'Orig', summary: 'Orig' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');

  // Sequential awaits — mutex releases between each, so each body runs
  // and the read-fresh-inside-mutex sees the previous body's write.
  const r1 = await graphCommandService.rename('q-1', 'A');
  const r2 = await graphCommandService.rename('q-1', 'B');
  const r3 = await graphCommandService.rename('q-1', 'C');

  for (const r of [r1, r2, r3]) {
    assert.equal(r.success, true);
  }

  // Final title is the last sequential write.
  assert.equal(_getStore().find((q) => q.id === 'q-1').title, 'C');

  // Journal: three rename entries, chained before/after through the title field.
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 3);
  assert.equal(entries[0].before.title, 'Orig');
  assert.equal(entries[0].after.title, 'A');
  assert.equal(entries[1].before.title, 'A', "second rename's before.title equals first rename's after.title");
  assert.equal(entries[1].after.title, 'B');
  assert.equal(entries[2].before.title, 'B', "third rename's before.title equals second rename's after.title");
  assert.equal(entries[2].after.title, 'C');
});

// ════════════════════════════════════════════════════════════════════════
// Concurrent moves against the same QA — same dedup behavior.
// ════════════════════════════════════════════════════════════════════════

test('concurrent move × 2 on same QA (Promise.all): mutex dedupes → 1 journal entry; first move wins', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true }),
    makeNode({ id: 'parent-X', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', qaCount: 1 }),
    makeNode({ id: 'parent-Y', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', qaCount: 0 }),
    makeNode({ id: 'parent-Z', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', qaCount: 0 }),
    makeNode({ id: 'qa-1', parentId: 'parent-X', clusterNodeId: 'cluster-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');

  const results = await Promise.all([
    graphCommandService.move('qa-1', 'parent-Y'),
    graphCommandService.move('qa-1', 'parent-Z'),
  ]);

  for (const r of results) {
    assert.equal(r.success, true);
  }

  // First move wins (mutex dedup); qa-1 ended up at parent-Y.
  assert.equal(_getStore().find((q) => q.id === 'qa-1').parentId, 'parent-Y');

  // Journal: ONE move entry.
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].cmd, 'move');
  assert.equal(entries[0].after.parentId, 'parent-Y');
});

// ════════════════════════════════════════════════════════════════════════
// SEQUENTIAL moves: each body runs; journal entries chain.
// ════════════════════════════════════════════════════════════════════════

test('sequential move × 2 (awaited): both bodies run; second move observes first via read-fresh-inside-mutex', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true }),
    makeNode({ id: 'parent-X', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', qaCount: 1 }),
    makeNode({ id: 'parent-Y', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', qaCount: 0 }),
    makeNode({ id: 'parent-Z', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', qaCount: 0 }),
    makeNode({ id: 'qa-1', parentId: 'parent-X', clusterNodeId: 'cluster-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');

  await graphCommandService.move('qa-1', 'parent-Y');
  await graphCommandService.move('qa-1', 'parent-Z');

  assert.equal(_getStore().find((q) => q.id === 'qa-1').parentId, 'parent-Z');

  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].cmd, 'move');
  assert.equal(entries[1].cmd, 'move');
  // Second move's before.parentId equals first move's after.parentId.
  assert.equal(
    entries[1].before.parentId,
    entries[0].after.parentId,
    'second move observed first move (read-fresh-inside-mutex)',
  );
});
