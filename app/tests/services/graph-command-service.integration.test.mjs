// Plan 48-04 Task 2 — End-to-end integration tests
//
// Verifies GRAPH-01 (one service boundary), GRAPH-02 (preservation), and
// GRAPH-03 (undo without losing source Q&A content) by exercising
// realistic sequences and asserting both store state AND journal state at
// every step.
//
// ─── Note on undo semantics (Blocker #3 — load-bearing) ──────────────────
//
// The integration test follows the inverse-verb-with-swapped-snapshots
// design (RESEARCH Summary point 6 / Blocker #3 fix). This means:
//
//   - undo PEEKS the newest journal entry (does NOT physically pop in the
//     happy path; corruption / vanished-target failure paths DO pop).
//   - undo applies the inverse mutation and APPENDS a new journal entry
//     with the SAME cmd as the peeked entry and SWAPPED before/after.
//   - Repeated undo cycles the most-recent operation between two states
//     (e.g., rename A→B → undo → undo cycles A↔B). It does NOT step back
//     through older commands — that's a different design (sequential
//     rollback) that the operator's Blocker #3 fix explicitly rejected
//     in favor of the journal-as-prompt-constraint discipline. Reading
//     the journal newest-first always gives the user's most recent
//     intent direction; the reorg prompt sees the full history.
//
// The earlier plan-text "undo×3 reverses merge then move then rename"
// was inconsistent with the Blocker #3 design (and inconsistent with
// the rename→undo→undo round-trip test in graph-command-service.undo
// .test.mjs that asserts journal grows to 3 'rename' entries). This
// integration test honors the load-bearing design.
//
// Closes the Blocker #3 enforcement at integration level by asserting NO
// journal entry's cmd is the literal 'undo' — every entry uses one of the
// six real verbs.

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
// Forward composition: rename → move → merge — each step lands cleanly,
// each writes ONE journal entry. Verifies GRAPH-01 (one boundary) + GRAPH-02
// (preservation) + GRAPH-03 (source Q&A content preserved across merge).
// ════════════════════════════════════════════════════════════════════════

test('integration: rename → move → merge composes correctly; store + journal coherent at every step', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({
      id: 'cluster-A',
      isClusterNode: true,
      title: 'Biology',
      branchLabel: 'Science',
      clusterLabel: 'Biology',
    }),
    makeNode({
      id: 'anchor-A',
      isAnchorNode: true,
      parentId: 'cluster-A',
      clusterNodeId: 'cluster-A',
      branchLabel: 'Science',
      clusterLabel: 'Biology',
      title: 'Photosyntheis',
      content: 'Photosyntheis',
      summary: 'Photosyntheis',
      qaCount: 2,
      embeddingVector: [0.1, 0.2, 0.3],
    }),
    makeNode({
      id: 'anchor-B',
      isAnchorNode: true,
      parentId: 'cluster-A',
      clusterNodeId: 'cluster-A',
      branchLabel: 'Science',
      clusterLabel: 'Biology',
      title: 'Mitosis',
      qaCount: 2,
      nodeSummary: '[qa-3] existing 3\n[qa-4] existing 4',
      embeddingVector: [0.4, 0.5, 0.6],
    }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology', content: 'Q1 source content preserved' }),
    makeNode({ id: 'qa-2', parentId: 'anchor-A', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology', content: 'Q2 source content preserved' }),
    makeNode({ id: 'qa-3', parentId: 'anchor-B', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology' }),
    makeNode({ id: 'qa-4', parentId: 'anchor-B', clusterNodeId: 'cluster-A', branchLabel: 'Science', clusterLabel: 'Biology' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');

  // ── Step 1: rename(anchor-A, 'Photosynthesis') ─────────────────────────
  const rename = await graphCommandService.rename('anchor-A', 'Photosynthesis');
  assert.equal(rename.success, true);

  let store = _getStore();
  assert.equal(store.find((q) => q.id === 'anchor-A').title, 'Photosynthesis');

  let entries = graphEditJournal.list();
  assert.equal(entries.length, 1, 'after rename: 1 journal entry');
  assert.equal(entries[0].cmd, 'rename');

  // ── Step 2: move(qa-1, anchor-B) ───────────────────────────────────────
  const move = await graphCommandService.move('qa-1', 'anchor-B');
  assert.equal(move.success, true);

  store = _getStore();
  const qa1 = store.find((q) => q.id === 'qa-1');
  assert.equal(qa1.parentId, 'anchor-B', 'qa-1 moved to anchor-B');
  // GRAPH-03 — source Q&A content preserved across move.
  assert.equal(qa1.content, 'Q1 source content preserved');
  const anchorAAfterMove = store.find((q) => q.id === 'anchor-A');
  assert.equal(anchorAAfterMove.qaCount, 1, 'anchor-A qaCount decremented');
  const anchorBAfterMove = store.find((q) => q.id === 'anchor-B');
  assert.equal(anchorBAfterMove.qaCount, 3, 'anchor-B qaCount incremented');

  entries = graphEditJournal.list();
  assert.equal(entries.length, 2);
  assert.equal(entries[1].cmd, 'move');

  // ── Step 3: merge(anchor-A, anchor-B) ──────────────────────────────────
  const merge = await graphCommandService.merge('anchor-A', 'anchor-B');
  assert.equal(merge.success, true);
  assert.equal(merge.data.reparentedCount, 1, 'one child reparented (qa-2; qa-1 was already moved)');
  assert.equal(merge.data.newSurvivorQaCount, 4, 'survivor qaCount = 3 (post-move) + 1 reparented');

  store = _getStore();
  assert.equal(store.find((q) => q.id === 'anchor-A'), undefined, 'loser hard-deleted');
  // GRAPH-03 — source Q&A content preserved across merge.
  assert.equal(store.find((q) => q.id === 'qa-1').content, 'Q1 source content preserved');
  assert.equal(store.find((q) => q.id === 'qa-2').content, 'Q2 source content preserved');
  assert.equal(store.find((q) => q.id === 'qa-2').parentId, 'anchor-B', 'qa-2 reparented to survivor');

  entries = graphEditJournal.list();
  assert.equal(entries.length, 3);
  assert.equal(entries[2].cmd, 'merge');

  // ── Blocker #3 enforcement: NO entry has cmd === 'undo' ───────────────
  for (const entry of entries) {
    assert.notEqual(entry.cmd, 'undo', `Blocker #3 invariant: no entry may have cmd === 'undo'`);
    assert.ok(
      ['rename', 'move', 'merge', 'detach', 'prune', 'delete'].includes(entry.cmd),
      `cmd must be in the six real verbs (got: ${entry.cmd})`,
    );
  }
});

// ════════════════════════════════════════════════════════════════════════
// undo of merge (resurrection) at integration scope: full pre-merge state
// restored including children + survivor (GRAPH-03 — undo without losing
// source Q&A content).
// ════════════════════════════════════════════════════════════════════════

test('integration: undo of merge resurrects loser + children + survivor pre-state (GRAPH-03)', async () => {
  await resetAll();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const oldSurvivorVec = [0.4, 0.5, 0.6];
  _resetStore([
    makeNode({
      id: 'anchor-A',
      isAnchorNode: true,
      title: 'Photosynthesis',
      qaCount: 2,
    }),
    makeNode({
      id: 'anchor-B',
      isAnchorNode: true,
      title: 'Mitosis',
      qaCount: 2,
      nodeSummary: 'orig nodeSummary',
      embeddingVector: oldSurvivorVec,
    }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', content: 'Q1 content' }),
    makeNode({ id: 'qa-2', parentId: 'anchor-A', content: 'Q2 content' }),
    makeNode({ id: 'qa-3', parentId: 'anchor-B' }),
    makeNode({ id: 'qa-4', parentId: 'anchor-B' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  await graphCommandService.merge('anchor-A', 'anchor-B');

  // Now undo the merge.
  const undo = await graphCommandService.undo();
  assert.equal(undo.success, true);
  assert.equal(undo.data.undoneCmd, 'merge');

  const store = _getStore();
  // Loser resurrected.
  const resurrected = store.find((q) => q.id === 'anchor-A');
  assert.ok(resurrected);
  assert.equal(resurrected.title, 'Photosynthesis');
  // Children reparented back.
  assert.equal(store.find((q) => q.id === 'qa-1').parentId, 'anchor-A');
  assert.equal(store.find((q) => q.id === 'qa-2').parentId, 'anchor-A');
  // GRAPH-03 — source content preserved across merge → undo cycle.
  assert.equal(store.find((q) => q.id === 'qa-1').content, 'Q1 content');
  assert.equal(store.find((q) => q.id === 'qa-2').content, 'Q2 content');
  // Survivor pre-merge state restored.
  const survivor = store.find((q) => q.id === 'anchor-B');
  assert.equal(survivor.qaCount, 2);
  assert.equal(survivor.nodeSummary, 'orig nodeSummary');
  assert.deepEqual(survivor.embeddingVector, oldSurvivorVec);

  // Journal: original merge + inverse merge (Blocker #3 invariant).
  const { graphEditJournal } = await import('../../src/services/graph-edit-journal.service.ts');
  const entries = graphEditJournal.list();
  assert.equal(entries.length, 2);
  for (const entry of entries) {
    assert.equal(entry.cmd, 'merge', `Blocker #3: inverse uses same cmd, NOT 'undo'`);
  }
});

// ════════════════════════════════════════════════════════════════════════
// Cross-cutting invariant: every successful command emits a typed
// GRAPH_UPDATED whose LAST observed payload.kind matches the verb
// (or 'undo' for undo).
// ════════════════════════════════════════════════════════════════════════

test('integration: each command emits a GRAPH_UPDATED whose LAST observed kind matches the verb', async () => {
  await resetAll();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  _resetStore([
    makeNode({ id: 'cluster-A', isClusterNode: true, title: 'C' }),
    makeNode({ id: 'anchor-A', isAnchorNode: true, parentId: 'cluster-A', clusterNodeId: 'cluster-A', title: 'A' }),
    makeNode({ id: 'qa-1', parentId: 'anchor-A', clusterNodeId: 'cluster-A' }),
  ]);

  const { graphCommandService } = await import('../../src/services/graph-command.service.ts');
  const { eventBus } = await import('../../src/lib/event-bus.ts');

  const collected = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => collected.push(e));

  await graphCommandService.rename('anchor-A', 'A2');
  assert.equal(collected[collected.length - 1].payload?.kind, 'rename');

  await graphCommandService.undo();
  assert.equal(collected[collected.length - 1].payload?.kind, 'undo');

  unsub();
});
