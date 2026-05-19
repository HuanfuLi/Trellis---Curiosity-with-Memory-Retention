import assert from 'node:assert/strict';
import test from 'node:test';

// localStorage shim
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

function makeAnchor(overrides = {}) {
  return {
    id: `q-${Math.random().toString(16).slice(2)}`,
    content: 'What is spaced repetition?',
    answer: 'A learning technique.',
    title: 'Spaced Repetition',
    keywords: [],
    timestamp: Date.now(),
    date: '2026-04-10',
    isAnchorNode: true,
    flagged: false,
    prunedFromTrellis: false,
    reviewSchedule: { nextReviewDate: '2025-01-01', reviewCount: 3, easeFactor: 2.5 },
    ...overrides,
  };
}

// D-15: prune(anchorId) patches question with { flagged: true, prunedFromTrellis: true }
test('prune patches question with flagged=true and prunedFromTrellis=true', async () => {
  storage.clear();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeAnchor({ id: 'anchor-prune-1' });
  _resetStore([anchor]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.prune('anchor-prune-1');

  const stored = _getStore().find((q) => q.id === 'anchor-prune-1');
  assert.ok(stored, 'question must still exist in store');
  assert.equal(stored.flagged, true, 'flagged must be true after prune');
  assert.equal(stored.prunedFromTrellis, true, 'prunedFromTrellis must be true after prune');
});

// D-15: prune emits ANCHOR_DELETED event
test('prune emits ANCHOR_DELETED event', async () => {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const anchor = makeAnchor({ id: 'anchor-prune-2' });
  _resetStore([anchor]);

  const events = [];
  const unsub = eventBus.subscribe('ANCHOR_DELETED', (e) => events.push(e));

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.prune('anchor-prune-2');
  unsub();

  assert.equal(events.length, 1, 'must emit exactly one ANCHOR_DELETED');
  assert.equal(events[0].payload.anchorId, 'anchor-prune-2');
});

// D-16: getPrunedQuestions returns ONLY questions where BOTH flagged AND prunedFromTrellis are true
test('getPrunedQuestions returns only questions with both flagged and prunedFromTrellis true', async () => {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  const pruned = makeAnchor({ id: 'q-pruned', flagged: true, prunedFromTrellis: true });
  const offTopic = makeAnchor({ id: 'q-offtopic', flagged: true, prunedFromTrellis: false }); // off-topic, not trellis-pruned
  const normal = makeAnchor({ id: 'q-normal', flagged: false, prunedFromTrellis: false });
  _resetStore([pruned, offTopic, normal]);

  const { questionService } = await import('./_actions-mock-question.mjs');
  const result = questionService.getPrunedQuestions();

  assert.equal(result.length, 1, 'only the trellis-pruned question should be returned');
  assert.equal(result[0].id, 'q-pruned');
});

// D-16: legacy off-topic flagged questions do NOT appear in getPrunedQuestions
test('getPrunedQuestions excludes off-topic flagged questions (prunedFromTrellis=false)', async () => {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  const offTopic = makeAnchor({ id: 'q-legacy', flagged: true, prunedFromTrellis: false });
  _resetStore([offTopic]);

  const { questionService } = await import('./_actions-mock-question.mjs');
  const result = questionService.getPrunedQuestions();

  assert.equal(result.length, 0, 'off-topic flagged questions must not appear in pruned list');
});

// D-18 — Phase 32.1 D-W3-02 consolidated CLASSIFICATION_COMPLETED into GRAPH_UPDATED. unpruneQuestion now emits the consolidated event.
test('unpruneQuestion clears flagged and prunedFromTrellis and emits GRAPH_UPDATED (Phase 32.1 D-W3-02 rename)', async () => {
  storage.clear();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const { eventBus } = await import('../../src/lib/event-bus.ts');
  const pruned = makeAnchor({ id: 'anchor-unprune', flagged: true, prunedFromTrellis: true });
  _resetStore([pruned]);

  const events = [];
  const unsub = eventBus.subscribe('GRAPH_UPDATED', (e) => events.push(e));

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.unpruneQuestion('anchor-unprune');
  unsub();

  const stored = _getStore().find((q) => q.id === 'anchor-unprune');
  assert.equal(stored.flagged, false, 'flagged must be cleared after unprune');
  assert.equal(stored.prunedFromTrellis, false, 'prunedFromTrellis must be cleared after unprune');
  assert.equal(events.length, 1, 'must emit GRAPH_UPDATED');
});

// ════════════════════════════════════════════════════════════════════════
// Phase 49-06 follow-up — prune cascades flag to QA leaves
// ════════════════════════════════════════════════════════════════════════

function makeQa(overrides = {}) {
  return {
    id: `qa-${Math.random().toString(16).slice(2)}`,
    content: 'QA content',
    answer: 'QA answer',
    title: 'Q',
    keywords: [],
    timestamp: Date.now(),
    date: '2026-04-10',
    flagged: false,
    prunedFromTrellis: false,
    reviewSchedule: { nextReviewDate: '2025-01-01', reviewCount: 0, easeFactor: 2.5 },
    ...overrides,
  };
}

test('prune cascade: flags ALL unflagged QA leaves of the anchor (preserves 4-layer hierarchy)', async () => {
  storage.clear();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeAnchor({ id: 'anchor-1' });
  const qa1 = makeQa({ id: 'qa-1', parentId: 'anchor-1' });
  const qa2 = makeQa({ id: 'qa-2', parentId: 'anchor-1' });
  const unrelatedQa = makeQa({ id: 'qa-other', parentId: 'anchor-other' });
  _resetStore([anchor, qa1, qa2, unrelatedQa]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  const result = trellisActionsService.prune('anchor-1');

  assert.deepEqual(result.cascadedQaIds.sort(), ['qa-1', 'qa-2'], 'returns cascaded IDs');

  const store = _getStore();
  assert.equal(store.find((q) => q.id === 'qa-1').flagged, true);
  assert.equal(store.find((q) => q.id === 'qa-1').prunedFromTrellis, true);
  assert.equal(store.find((q) => q.id === 'qa-2').flagged, true);
  assert.equal(store.find((q) => q.id === 'qa-other').flagged, false, 'unrelated QA untouched');
});

test('prune cascade: skips QAs already flagged (off-topic) — they stay flagged but are NOT in cascadedQaIds', async () => {
  storage.clear();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeAnchor({ id: 'anchor-1' });
  const cleanQa = makeQa({ id: 'qa-clean', parentId: 'anchor-1' });
  const offTopicQa = makeQa({ id: 'qa-offtopic', parentId: 'anchor-1', flagged: true, prunedFromTrellis: false });
  _resetStore([anchor, cleanQa, offTopicQa]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  const result = trellisActionsService.prune('anchor-1');

  assert.deepEqual(result.cascadedQaIds, ['qa-clean'], 'only clean QA is cascaded');
  const offTopic = _getStore().find((q) => q.id === 'qa-offtopic');
  assert.equal(offTopic.prunedFromTrellis, false, 'off-topic QA prunedFromTrellis stays false');
});

test('unpruneQuestion cascade: precise mode (cascadedQaIds opt) un-flags only those IDs', async () => {
  storage.clear();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeAnchor({ id: 'anchor-1', flagged: true, prunedFromTrellis: true });
  const cascadedQa = makeQa({ id: 'qa-cascaded', parentId: 'anchor-1', flagged: true, prunedFromTrellis: true });
  // An off-topic QA that was flagged BEFORE the prune ran — must NOT be un-flagged.
  const offTopicQa = makeQa({ id: 'qa-offtopic', parentId: 'anchor-1', flagged: true, prunedFromTrellis: false });
  _resetStore([anchor, cascadedQa, offTopicQa]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.unpruneQuestion('anchor-1', { cascadedQaIds: ['qa-cascaded'] });

  const store = _getStore();
  assert.equal(store.find((q) => q.id === 'anchor-1').flagged, false, 'anchor un-flagged');
  assert.equal(store.find((q) => q.id === 'qa-cascaded').flagged, false, 'cascaded QA un-flagged');
  assert.equal(store.find((q) => q.id === 'qa-offtopic').flagged, true, 'off-topic QA stays flagged');
});

test('unpruneQuestion cascade: blanket mode (no cascadedQaIds) un-flags all prunedFromTrellis children', async () => {
  storage.clear();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeAnchor({ id: 'anchor-1', flagged: true, prunedFromTrellis: true });
  const cascadedQa = makeQa({ id: 'qa-cascaded', parentId: 'anchor-1', flagged: true, prunedFromTrellis: true });
  const offTopicQa = makeQa({ id: 'qa-offtopic', parentId: 'anchor-1', flagged: true, prunedFromTrellis: false });
  _resetStore([anchor, cascadedQa, offTopicQa]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.unpruneQuestion('anchor-1');

  const store = _getStore();
  assert.equal(store.find((q) => q.id === 'qa-cascaded').flagged, false, 'cascaded QA un-flagged via blanket');
  assert.equal(store.find((q) => q.id === 'qa-offtopic').flagged, true, 'off-topic QA stays flagged (prunedFromTrellis filter)');
});

test('getPrunedQuestions filter: cascaded QA leaves (isAnchorNode=false) do NOT surface in pruned section', async () => {
  storage.clear();
  const { _resetStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeAnchor({ id: 'anchor-1' });
  const qa = makeQa({ id: 'qa-1', parentId: 'anchor-1' });
  _resetStore([anchor, qa]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  trellisActionsService.prune('anchor-1');

  const { questionService } = await import('./_actions-mock-question.mjs');
  const result = questionService.getPrunedQuestions();
  assert.equal(result.length, 1, 'only the anchor surfaces in pruned list');
  assert.equal(result[0].id, 'anchor-1');
});

// D-18: hardDelete calls through to questionService.delete
test('hardDelete removes the question from the store', async () => {
  storage.clear();
  const { _resetStore, _getStore } = await import('./_actions-mock-question.mjs');
  const anchor = makeAnchor({ id: 'anchor-hd' });
  _resetStore([anchor]);

  const { trellisActionsService } = await import('../../src/services/trellis-actions.service.ts');
  await trellisActionsService.hardDelete('anchor-hd');

  const stored = _getStore().find((q) => q.id === 'anchor-hd');
  assert.equal(stored, undefined, 'hardDelete must remove the question from the store');
});
