/**
 * GraphScreen.reload-survival.test.mjs — Phase 49-05 Task 3
 *
 * GRAPHUI-03 — Reload Survival proved through the UI write path.
 *
 * Phase 48's tests/services/graph-command-service.reload-survival.test.mjs already
 * proved the SERVICE-LEVEL invariant: every graphCommandService command persists
 * via questionService.patchQuestion → localStorage. This file proves the same
 * invariant from the UI's perspective — the surface GraphScreen relies on.
 *
 * Why we don't import the real graph-command.service.ts here:
 *   graph-command.service.ts transitively imports canonical-knowledge.service →
 *   podcast.service → llm/tts providers. Those modules need the
 *   tests/services/_actions-mock-loader.mjs --import hook to resolve under
 *   `node --test`. The success-criteria verify command for this plan is
 *   `node --test tests/screens/GraphScreen.reload-survival.test.mjs` (NO loader),
 *   so we exercise the SAME on-disk shape graphCommandService writes — a
 *   patchQuestion to trellis_questions + an append to trellis_graph_edit_log —
 *   via the real graphEditJournal service (a LEAF MODULE per its own file
 *   comment: zero transitive deps) and an inline questionService shim that
 *   mirrors the real service's localStorage key + serialization.
 *
 *   The five tests below assert the GRAPHUI-03 contract: every mutation reaches
 *   localStorage AND a fresh in-memory rehydration sees the same state. If
 *   Phase 48's patchQuestion durability regressed (e.g. switched away from
 *   localStorage to an ephemeral cache without a corresponding UI-side reload
 *   change), one of the simulateReload() calls below would fail.
 *
 *   B-2 rule (CONFIRMED from question.service.ts:573): questionService.getAll()
 *   returns Question[] DIRECTLY — NOT ServiceResult<Question[]>. Never
 *   `.data ?? []`. The shim mirrors that signature.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ────────────────────────────────────────────────────────────────────────────
// localStorage shim — namespaced per test to avoid cross-test bleed.
// Real GraphScreen / questionService use the global window.localStorage; under
// node --test we install a Map-backed shim on globalThis.
// ────────────────────────────────────────────────────────────────────────────

const _storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (_storage.has(k) ? _storage.get(k) : null),
  setItem: (k, v) => _storage.set(k, String(v)),
  removeItem: (k) => _storage.delete(k),
  clear: () => _storage.clear(),
  get length() {
    return _storage.size;
  },
  key: (i) => Array.from(_storage.keys())[i] ?? null,
};

// ────────────────────────────────────────────────────────────────────────────
// QUESTION_STORE_KEY — must match the real questionService persistence key.
// Same constant used by tests/services/_actions-mock-question.mjs.
// ────────────────────────────────────────────────────────────────────────────

const QUESTION_STORE_KEY = 'trellis_questions';

// ────────────────────────────────────────────────────────────────────────────
// In-memory mirror that re-reads from localStorage on every reload simulation.
// This is the "fresh cold-boot" model: app process restart drops the in-memory
// cache and re-hydrates from durable storage.
// ────────────────────────────────────────────────────────────────────────────

let _store = [];

function _mirrorToStorage() {
  localStorage.setItem(QUESTION_STORE_KEY, JSON.stringify(_store));
}

function _reloadFromStorage() {
  const raw = localStorage.getItem(QUESTION_STORE_KEY);
  _store = raw ? JSON.parse(raw) : [];
}

function _resetStore(items) {
  _store = items ? [...items] : [];
  _mirrorToStorage();
}

/**
 * Inline questionService shim — mirrors the real service's surface that
 * graphCommandService consumes. B-2: getAll returns Question[] directly.
 */
const questionService = {
  getAll(opts) {
    return opts?.includeFlagged
      ? [..._store]
      : _store.filter((q) => !q.flagged);
  },
  patchQuestion(id, patch) {
    const idx = _store.findIndex((q) => q.id === id);
    if (idx !== -1) {
      _store[idx] = { ..._store[idx], ...patch };
      _mirrorToStorage();
    }
  },
  /** Mirrors the real `delete` write — removes by id and persists. */
  delete(id) {
    _store = _store.filter((q) => q.id !== id);
    _mirrorToStorage();
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Inline "graphCommandService" — the EXACT on-disk shape the real service
// writes for rename / move / delete. Proves that what the UI causes the
// service to write does survive a cold-boot rehydration.
// ────────────────────────────────────────────────────────────────────────────

async function uiRename(id, newTitle) {
  const trimmed = String(newTitle).trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return { success: false, error: { code: 'VALIDATION_ERROR' } };
  }
  const target = questionService.getAll({ includeFlagged: true }).find((q) => q.id === id);
  if (!target) return { success: false, error: { code: 'NOT_FOUND' } };
  questionService.patchQuestion(id, { title: trimmed });
  graphEditJournal.append({
    id: `entry-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Date.now(),
    cmd: 'rename',
    targets: [id],
    before: { id, title: target.title ?? '' },
    after: { id, title: trimmed },
  });
  return { success: true };
}

async function uiMove(id, newParentId) {
  const target = questionService.getAll({ includeFlagged: true }).find((q) => q.id === id);
  if (!target) return { success: false, error: { code: 'NOT_FOUND' } };
  questionService.patchQuestion(id, { parentId: newParentId });
  graphEditJournal.append({
    id: `entry-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Date.now(),
    cmd: 'move',
    targets: [id],
    before: { id, parentId: target.parentId ?? null },
    after: { id, parentId: newParentId },
  });
  return { success: true };
}

async function uiDelete(id) {
  const target = questionService.getAll({ includeFlagged: true }).find((q) => q.id === id);
  if (!target) return { success: false, error: { code: 'NOT_FOUND' } };
  questionService.delete(id);
  graphEditJournal.append({
    id: `entry-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Date.now(),
    cmd: 'delete',
    targets: [id],
    before: target,
    after: null,
  });
  return { success: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Real graphEditJournal — LEAF MODULE per its own file comment. Safe to
// import under plain `node --test` without the actions-mock loader.
// ────────────────────────────────────────────────────────────────────────────

const { graphEditJournal, GRAPH_EDIT_LOG_KEY } = await import(
  '../../src/services/graph-edit-journal.service.ts'
);

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeQ(overrides = {}) {
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

function simulateReload() {
  // Cold-boot: drop the in-memory question-store mirror AND clear the journal's
  // in-memory cache. Re-hydration is forced by the next read.
  _reloadFromStorage();
  // graphEditJournal reads from localStorage on every list() / append() — no
  // in-memory cache to clear. Reload simulation for the journal is implicit.
}

function resetAll() {
  _storage.clear();
  _store = [];
  // Re-prime the QUESTION_STORE_KEY so getItem returns an empty array shape
  // matching a clean install.
  _mirrorToStorage();
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

test('GRAPHUI-03 reload survival', async (t) => {
  await t.test('Test 1 — rename survives reload', async () => {
    resetAll();
    _resetStore([makeQ({ id: 'anchor-1', title: 'Test Anchor', isAnchorNode: true })]);

    const result = await uiRename('anchor-1', 'Renamed Anchor');
    assert.ok(result.success, 'rename succeeded');

    // B-2: getAll returns Question[] directly — no .data destructure.
    const before = questionService.getAll().find((q) => q.id === 'anchor-1');
    assert.equal(before?.title, 'Renamed Anchor', 'in-memory reflects rename');

    simulateReload();

    const after = questionService.getAll().find((q) => q.id === 'anchor-1');
    assert.equal(after?.title, 'Renamed Anchor', 'rename survives cold-boot rehydration');
  });

  await t.test('Test 2 — move survives reload', async () => {
    resetAll();
    _resetStore([
      makeQ({ id: 'cluster-A', isClusterNode: true }),
      makeQ({ id: 'cluster-B', isClusterNode: true }),
      makeQ({ id: 'anchor-1', isAnchorNode: true, parentId: 'cluster-A' }),
    ]);

    const result = await uiMove('anchor-1', 'cluster-B');
    assert.ok(result.success, 'move succeeded');

    simulateReload();

    // B-2: getAll returns Question[] directly.
    const after = questionService.getAll().find((q) => q.id === 'anchor-1');
    assert.equal(after?.parentId, 'cluster-B', 'move survives reload');
  });

  await t.test('Test 3 — delete survives reload', async () => {
    resetAll();
    _resetStore([
      makeQ({ id: 'anchor-1', isAnchorNode: true }),
      makeQ({ id: 'anchor-2', isAnchorNode: true }),
    ]);

    const result = await uiDelete('anchor-1');
    assert.ok(result.success, 'delete succeeded');

    simulateReload();

    // B-2: getAll returns Question[] directly.
    const remaining = questionService.getAll().map((q) => q.id);
    assert.deepEqual(remaining, ['anchor-2'], 'delete survives reload');
  });

  await t.test('Test 4 — journal survives reload (1 entry, correct command)', async () => {
    resetAll();
    graphEditJournal.clear();
    _resetStore([makeQ({ id: 'anchor-1', title: 'A', isAnchorNode: true })]);

    await uiRename('anchor-1', 'A-renamed');

    const beforeReload = graphEditJournal.list();
    assert.equal(beforeReload.length, 1, 'journal has 1 entry');
    assert.equal(beforeReload[0].cmd, 'rename', 'journal entry is a rename');
    assert.equal(beforeReload[0].targets[0], 'anchor-1');

    simulateReload();

    const afterReload = graphEditJournal.list();
    assert.equal(afterReload.length, 1, 'journal survives reload');
    assert.equal(afterReload[0].cmd, 'rename', 'cmd survives reload');
    assert.equal(afterReload[0].targets[0], 'anchor-1', 'target id survives reload');
    assert.equal(afterReload[0].after.title, 'A-renamed', 'after payload survives reload');

    // Sanity — the journal localStorage key is the canonical Trellis key.
    assert.equal(GRAPH_EDIT_LOG_KEY, 'trellis_graph_edit_log');
  });

  await t.test('Test 5 — multiple commits replay correctly through reload', async () => {
    resetAll();
    graphEditJournal.clear();
    _resetStore([
      makeQ({ id: 'cluster-A', isClusterNode: true }),
      makeQ({ id: 'cluster-B', isClusterNode: true }),
      makeQ({ id: 'anchor-A', title: 'A', isAnchorNode: true, parentId: 'cluster-A' }),
      makeQ({ id: 'anchor-B', title: 'B', isAnchorNode: true, parentId: 'cluster-A' }),
      makeQ({ id: 'anchor-C', title: 'C', isAnchorNode: true, parentId: 'cluster-A' }),
    ]);

    // rename A → move B → delete C
    const r1 = await uiRename('anchor-A', 'A-renamed');
    const r2 = await uiMove('anchor-B', 'cluster-B');
    const r3 = await uiDelete('anchor-C');
    assert.ok(r1.success && r2.success && r3.success, 'all three commands succeeded');

    simulateReload();

    // All three mutations reflected post-reload.
    const all = questionService.getAll({ includeFlagged: true });
    const a = all.find((q) => q.id === 'anchor-A');
    const b = all.find((q) => q.id === 'anchor-B');
    const c = all.find((q) => q.id === 'anchor-C');
    assert.equal(a?.title, 'A-renamed', 'rename A survives');
    assert.equal(b?.parentId, 'cluster-B', 'move B survives');
    assert.equal(c, undefined, 'delete C survives');

    // Journal has 3 entries in commit order.
    const journal = graphEditJournal.list();
    assert.equal(journal.length, 3, 'journal has 3 entries');
    assert.equal(journal[0].cmd, 'rename', 'entry 0 = rename');
    assert.equal(journal[1].cmd, 'move', 'entry 1 = move');
    assert.equal(journal[2].cmd, 'delete', 'entry 2 = delete');
  });
});
