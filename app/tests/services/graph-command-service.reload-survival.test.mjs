// Plan 48-04 Task 2 — Reload-survival + SERVICE-LEVEL invariant
//
// success criterion 3: corrected graph survives reload
// Blocker #5 deferral: GraphScreen.tsx subscription to GRAPH_UPDATED for
// selected-node re-render is Phase 49 (GRAPHUI-03). Phase 48 proves the
// SERVICE-LEVEL invariant only: that after every command,
// questionService.getAll() returns the mutated state. The reload-after-each-
// command sub-tests below prove that the service invariant holds for every
// cmd, which is what Phase 49's UI subscription will rely on.

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
  const { _resetStore, _setDeleteFail, _enableLocalStorageMirror } = await import('./_actions-mock-question.mjs');
  // Enable mirror for THIS file's tests. Plan 02 + 03 tests don't import this
  // file, so their default-OFF behavior is unchanged.
  _enableLocalStorageMirror(true);
  _resetStore([]);
  if (typeof _setDeleteFail === 'function') _setDeleteFail(false);
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  graphEditJournal.clear();
  const settingsMod = await import('./_actions-mock-settings.mjs');
  if (typeof settingsMod._setEmbeddingConfigured === 'function') {
    settingsMod._setEmbeddingConfigured(true);
  }
}

// Disable mirror at the end so subsequent test files (which may run in
// the same node process via the test:actions multi-file invocation) start
// with mock defaults.
test.after(async () => {
  const { _enableLocalStorageMirror } = await import('./_actions-mock-question.mjs');
  _enableLocalStorageMirror(false);
});

// ════════════════════════════════════════════════════════════════════════
// Standalone post-rename reload assertion (preserved from earlier plan)
// ════════════════════════════════════════════════════════════════════════

test('post-rename reload survival: rename → getAll truthful → reload → getAll still truthful', async () => {
  await resetAll();
  const { _resetStore, _reloadFromStorage, questionService } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1', title: 'OldName', content: 'OldName', summary: 'OldName' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const result = await graphCommandService.rename('q-1', 'NewName');
  assert.equal(result.success, true);

  // SERVICE-LEVEL INVARIANT (Blocker #5 fix): proves the post-command store is truthful — Phase 49 GraphScreen subscription depends on this.
  const beforeReload = questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'q-1');
  assert.equal(beforeReload.title, 'NewName', 'service-level: post-rename getAll reflects new title');

  // Simulate cold boot — drop the in-memory store, re-read from localStorage.
  _reloadFromStorage();

  // success criterion 3: corrected graph survives reload
  const afterReload = questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'q-1');
  assert.equal(afterReload.title, 'NewName', 'reload-survival: rename survived simulated cold boot');
});

// ════════════════════════════════════════════════════════════════════════
// Per-command reload-survival + service-level invariant (Blocker #5)
// ════════════════════════════════════════════════════════════════════════

test('reload-survival: rename → getAll truthful + reload still truthful', async () => {
  await resetAll();
  const { _resetStore, _reloadFromStorage, questionService } = await import('./_actions-mock-question.mjs');
  _resetStore([makeNode({ id: 'q-1', title: 'Old' })]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.rename('q-1', 'New');

  // SERVICE-LEVEL INVARIANT (Blocker #5 fix): proves the post-command store is truthful — Phase 49 GraphScreen subscription depends on this.
  assert.equal(questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'q-1').title, 'New');

  _reloadFromStorage();
  // success criterion 3: corrected graph survives reload
  assert.equal(questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'q-1').title, 'New');
});

test('reload-survival: move → getAll truthful + reload still truthful', async () => {
  await resetAll();
  const { _resetStore, _reloadFromStorage, questionService } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true }),
    makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A' }),
    makeNode({ id: 'anchor-B', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', clusterNodeId: 'cluster-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.move('qa-1', 'anchor-B');

  // SERVICE-LEVEL INVARIANT (Blocker #5 fix): proves the post-command store is truthful — Phase 49 GraphScreen subscription depends on this.
  assert.equal(questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'qa-1').parentId, 'anchor-B');

  _reloadFromStorage();
  // success criterion 3: corrected graph survives reload
  assert.equal(questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'qa-1').parentId, 'anchor-B');
});

test('reload-survival: delete → getAll truthful + reload still truthful', async () => {
  await resetAll();
  const { _resetStore, _reloadFromStorage, questionService } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'qa-1', parentId: 'anchor-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.delete('qa-1');

  // SERVICE-LEVEL INVARIANT (Blocker #5 fix): proves the post-command store is truthful — Phase 49 GraphScreen subscription depends on this.
  assert.equal(questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'qa-1'), undefined);

  _reloadFromStorage();
  // success criterion 3: corrected graph survives reload
  assert.equal(questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'qa-1'), undefined);
});

test('reload-survival: merge → getAll truthful + reload still truthful', async () => {
  await resetAll();
  const { _resetStore, _reloadFromStorage, questionService } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'loser-X', isAnchorNode: true, qaCount: 1 }),
    makeNode({ id: 'survivor-Y', isAnchorNode: true, qaCount: 1 }),
    makeNode({ id: 'qa-1', parentId: 'loser-X' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.merge('loser-X', 'survivor-Y');

  // SERVICE-LEVEL INVARIANT (Blocker #5 fix): proves the post-command store is truthful — Phase 49 GraphScreen subscription depends on this.
  let all = questionService.getAll({ includeFlagged: true });
  assert.equal(all.find((q) => q.id === 'loser-X'), undefined, 'loser hard-deleted');
  assert.equal(all.find((q) => q.id === 'qa-1').parentId, 'survivor-Y', 'child reparented');

  _reloadFromStorage();
  // success criterion 3: corrected graph survives reload
  all = questionService.getAll({ includeFlagged: true });
  assert.equal(all.find((q) => q.id === 'loser-X'), undefined);
  assert.equal(all.find((q) => q.id === 'qa-1').parentId, 'survivor-Y');
});

test('reload-survival: detach → getAll truthful + reload still truthful', async () => {
  await resetAll();
  const { _resetStore, _reloadFromStorage, questionService } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, qaCount: 1 }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', clusterNodeId: 'cluster-X', branchLabel: 'Sci' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.detach('qa-1');

  // SERVICE-LEVEL INVARIANT (Blocker #5 fix): proves the post-command store is truthful — Phase 49 GraphScreen subscription depends on this.
  const qa = questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'qa-1');
  assert.equal(qa.parentId, undefined, 'placement cleared');

  _reloadFromStorage();
  // success criterion 3: corrected graph survives reload
  const qaAfter = questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'qa-1');
  assert.equal(qaAfter.parentId, undefined);
});

test('reload-survival: prune → getAll truthful + reload still truthful', async () => {
  await resetAll();
  const { _resetStore, _reloadFromStorage, questionService } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'anchor-A', isAnchorNode: true, flagged: false, prunedFromTrellis: false }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.prune('anchor-A');

  // SERVICE-LEVEL INVARIANT (Blocker #5 fix): proves the post-command store is truthful — Phase 49 GraphScreen subscription depends on this.
  const anchor = questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'anchor-A');
  assert.equal(anchor.flagged, true);
  assert.equal(anchor.prunedFromTrellis, true);

  _reloadFromStorage();
  // success criterion 3: corrected graph survives reload
  const anchorAfter = questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'anchor-A');
  assert.equal(anchorAfter.flagged, true);
  assert.equal(anchorAfter.prunedFromTrellis, true);
});

test('reload-survival: undo (post-delete-then-undo) → getAll truthful + reload still truthful (resurrection survives)', async () => {
  await resetAll();
  const { _resetStore, _reloadFromStorage, questionService } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({
      id: 'qa-1',
      parentId: 'anchor-A',
      clusterNodeId: 'cluster-A',
      branchLabel: 'Sci',
      title: 'ImportantQA',
    }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.delete('qa-1');
  // Verify deletion landed.
  assert.equal(questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'qa-1'), undefined);

  // undo the delete — resurrect the qa.
  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);
  assert.equal(undo.data.undoneCmd, 'delete');

  // SERVICE-LEVEL INVARIANT (Blocker #5 fix): proves the post-command store is truthful — Phase 49 GraphScreen subscription depends on this.
  const resurrected = questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'qa-1');
  assert.ok(resurrected, 'qa-1 resurrected');
  assert.equal(resurrected.title, 'ImportantQA');

  _reloadFromStorage();
  // success criterion 3: corrected graph survives reload
  const afterReload = questionService.getAll({ includeFlagged: true }).find((q) => q.id === 'qa-1');
  assert.ok(afterReload, 'resurrected qa survives reload');
  assert.equal(afterReload.title, 'ImportantQA');
});
