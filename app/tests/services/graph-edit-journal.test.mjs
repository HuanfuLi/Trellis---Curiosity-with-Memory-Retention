// Phase 48-01 — Behavioral tests for graphEditJournal leaf module.
//
// Covers every <behavior> bullet in Task 2 + Task 3 (phrasing) of
// 48-01-PLAN.md. The journal is a LEAF MODULE: zero transitive deps on
// settings.service / llm-provider / locales bundles, so node --test
// imports it directly (same pattern as refill-mutex.test.mjs).
//
// localStorage shim pattern lifted verbatim from daily-read.service.test.mjs:
// every test calls localStorage.clear() in beforeEach so state never
// leaks across cases (R10 risk 8 — test isolation).

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// localStorage polyfill for Node (same shape as daily-read.service.test.mjs).
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const {
  graphEditJournal,
  isValidPreImage,
  GRAPH_EDIT_LOG_KEY,
} = await import('../../src/services/graph-edit-journal.service.ts');

const { phraseJournalEntry } = await import(
  '../../src/services/graph-edit-journal-phrasing.ts'
);

describe('graphEditJournal — storage + lifecycle (Phase 48-01)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('list() returns [] when localStorage key is missing', () => {
    const entries = graphEditJournal.list();
    assert.deepEqual(entries, []);
  });

  it('list() returns [] (not throw) when localStorage value is malformed JSON', () => {
    localStorage.setItem(GRAPH_EDIT_LOG_KEY, '{not valid json');
    const entries = graphEditJournal.list();
    assert.deepEqual(entries, []);
  });

  it('list() returns [] when localStorage value is a non-array JSON value', () => {
    localStorage.setItem(GRAPH_EDIT_LOG_KEY, '{"not":"an array"}');
    const entries = graphEditJournal.list();
    assert.deepEqual(entries, []);
  });

  it('append() returns an entry with auto-generated id + ts; round-trips via list()', () => {
    const before = Date.now();
    const entry = graphEditJournal.append({
      cmd: 'rename',
      targetIds: ['q-1'],
      before: { title: 'A' },
      after: { title: 'B' },
    });
    const after = Date.now();

    assert.equal(typeof entry.id, 'string');
    assert.ok(entry.id.length > 0, 'id must be non-empty');
    assert.equal(typeof entry.ts, 'number');
    assert.ok(entry.ts >= before && entry.ts <= after, 'ts must be Date.now()');
    assert.equal(entry.cmd, 'rename');
    assert.deepEqual(entry.targetIds, ['q-1']);
    assert.deepEqual(entry.before, { title: 'A' });
    assert.deepEqual(entry.after, { title: 'B' });

    const stored = graphEditJournal.list();
    assert.equal(stored.length, 1);
    assert.deepEqual(stored[0], entry);
  });

  it('appending 12 entries — list().length === 10; OLDEST 2 dropped (D-05 retention)', () => {
    for (let i = 0; i < 12; i++) {
      graphEditJournal.append({
        cmd: 'rename',
        targetIds: [`q-${i}`],
        before: { title: `old-${i}` },
        after: { title: `new-${i}` },
      });
    }
    const entries = graphEditJournal.list();
    assert.equal(entries.length, 10, 'D-05 N=10 cap enforced via slice(-10)');
    // First retained entry should be #2 (entries 0 and 1 dropped); last is #11.
    assert.deepEqual(entries[0].targetIds, ['q-2']);
    assert.deepEqual(entries[9].targetIds, ['q-11']);
  });

  it('popNewest() removes and returns the last appended entry', () => {
    graphEditJournal.append({ cmd: 'rename', targetIds: ['q-1'], before: {}, after: {} });
    graphEditJournal.append({ cmd: 'move', targetIds: ['q-2'], before: {}, after: {} });
    graphEditJournal.append({ cmd: 'prune', targetIds: ['q-3'], before: {}, after: {} });

    const popped = graphEditJournal.popNewest();
    assert.ok(popped, 'popNewest must return the entry');
    assert.equal(popped.cmd, 'prune');
    assert.deepEqual(popped.targetIds, ['q-3']);

    const remaining = graphEditJournal.list();
    assert.equal(remaining.length, 2);
    assert.equal(remaining[0].cmd, 'rename');
    assert.equal(remaining[1].cmd, 'move');
  });

  it('popNewest() on empty journal returns undefined', () => {
    const popped = graphEditJournal.popNewest();
    assert.equal(popped, undefined);
  });

  it('clear() empties the journal', () => {
    graphEditJournal.append({ cmd: 'rename', targetIds: ['q-1'], before: {}, after: {} });
    graphEditJournal.append({ cmd: 'move', targetIds: ['q-2'], before: {}, after: {} });
    assert.equal(graphEditJournal.list().length, 2);

    graphEditJournal.clear();
    assert.equal(graphEditJournal.list().length, 0);
  });

  it('journal persists to localStorage under GRAPH_EDIT_LOG_KEY (D-18)', () => {
    assert.equal(GRAPH_EDIT_LOG_KEY, 'trellis_graph_edit_log');
    graphEditJournal.append({
      cmd: 'rename',
      targetIds: ['q-1'],
      before: { title: 'A' },
      after: { title: 'B' },
    });
    const raw = localStorage.getItem(GRAPH_EDIT_LOG_KEY);
    assert.ok(raw, 'JSON string must be persisted');
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed), 'stored value must be an array');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].cmd, 'rename');
  });

  it('journal survives simulated reload (read-after-write via localStorage)', () => {
    graphEditJournal.append({
      cmd: 'merge',
      targetIds: ['l', 's'],
      before: { loser: { title: 'SRS' } },
      after: { survivor: { title: 'Spaced Repetition' } },
    });
    // Simulate a fresh load by going through list() — which always re-reads.
    const reloaded = graphEditJournal.list();
    assert.equal(reloaded.length, 1);
    assert.equal(reloaded[0].cmd, 'merge');
    assert.deepEqual(reloaded[0].targetIds, ['l', 's']);
  });

  it('QuotaExceededError on setItem is caught — append does NOT throw upward', () => {
    // First append succeeds.
    graphEditJournal.append({ cmd: 'rename', targetIds: ['q-1'], before: { title: 'A' }, after: { title: 'B' } });
    const before = graphEditJournal.list();

    // Monkey-patch localStorage.setItem to throw QuotaExceededError.
    const originalSet = localStorage.setItem.bind(localStorage);
    let warned = false;
    const originalWarn = console.warn;
    console.warn = () => { warned = true; };

    localStorage.setItem = () => {
      // Simulate DOMException with the canonical name.
      const err = new Error('mock quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    };

    try {
      assert.doesNotThrow(() => {
        graphEditJournal.append({
          cmd: 'rename',
          targetIds: ['q-2'],
          before: { title: 'C' },
          after: { title: 'D' },
        });
      });
      assert.ok(warned, 'console.warn must fire on quota exceeded');
    } finally {
      localStorage.setItem = originalSet;
      console.warn = originalWarn;
    }

    // Previous journal state preserved (quota failure did not wipe existing data).
    const after = graphEditJournal.list();
    assert.equal(after.length, before.length, 'prior journal state must be preserved');
    assert.equal(after[0].targetIds[0], 'q-1');
  });
});

describe('isValidPreImage (Phase 48-01 — T-48-01 tamper-resistance)', () => {
  it('returns true for plain objects', () => {
    assert.equal(isValidPreImage({ title: 'X' }), true);
    assert.equal(isValidPreImage({ parentId: 'q-1', clusterNodeId: 'q-2' }), true);
    assert.equal(isValidPreImage({}), true);
  });

  it('returns false for null', () => {
    assert.equal(isValidPreImage(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isValidPreImage(undefined), false);
  });

  it('returns false for primitives', () => {
    assert.equal(isValidPreImage(42), false);
    assert.equal(isValidPreImage('string'), false);
    assert.equal(isValidPreImage(true), false);
  });

  it('returns false for arrays', () => {
    assert.equal(isValidPreImage([]), false);
    assert.equal(isValidPreImage([{ title: 'X' }]), false);
  });
});

describe('phraseJournalEntry (Phase 48-01, Task 3 — canonical reorg-prompt phrasing)', () => {
  // 2026-05-15 00:00:00 UTC = 1747353600000.
  const TS_2026_05_15 = Date.UTC(2026, 4, 15, 0, 0, 0); // month is 0-indexed

  it('rename: contains date, both titles, and "preserve this name"', () => {
    const line = phraseJournalEntry({
      id: 'x',
      ts: TS_2026_05_15,
      cmd: 'rename',
      targetIds: ['q-1'],
      before: { title: 'Photosyntheis' },
      after: { title: 'Photosynthesis' },
    });
    assert.match(line, /2026-05-15/, 'must contain UTC YYYY-MM-DD');
    assert.match(line, /Photosyntheis/);
    assert.match(line, /Photosynthesis/);
    assert.match(line, /preserve this name/);
  });

  it('merge: contains loser title and "do not re-create"', () => {
    const line = phraseJournalEntry({
      id: 'x',
      ts: TS_2026_05_15,
      cmd: 'merge',
      targetIds: ['l', 's'],
      before: { loser: { title: 'SRS' }, survivor: { title: 'Spaced Repetition' } },
      after: {},
    });
    assert.match(line, /SRS/);
    assert.match(line, /do not re-create/);
  });

  it('every supported cmd value returns a non-empty string (no crashes on missing optional fields)', () => {
    const cmds = ['rename', 'move', 'merge', 'detach', 'prune', 'delete'];
    for (const cmd of cmds) {
      const line = phraseJournalEntry({
        id: 'x',
        ts: TS_2026_05_15,
        cmd,
        targetIds: ['q-1'],
        before: {},
        after: {},
      });
      assert.equal(typeof line, 'string', `${cmd} must return a string`);
      assert.ok(line.length > 0, `${cmd} must return a non-empty string`);
      assert.match(line, /2026-05-15/, `${cmd} must include the date`);
    }
  });

  it('output is deterministic: same input bytes → same output bytes (D-20 byte-stability)', () => {
    const entry = {
      id: 'x',
      ts: TS_2026_05_15,
      cmd: 'rename',
      targetIds: ['q-1'],
      before: { title: 'A' },
      after: { title: 'B' },
    };
    const a = phraseJournalEntry(entry);
    const b = phraseJournalEntry(entry);
    assert.equal(a, b, 'phrasing must be deterministic for byte-stable prompt prefix');
  });

  it('date is UTC-derived via toISOString().slice(0,10) — timezone-independent', () => {
    // 2026-05-15 23:59:59 UTC → still "2026-05-15".
    const tsLateUTC = Date.UTC(2026, 4, 15, 23, 59, 59);
    const line = phraseJournalEntry({
      id: 'x',
      ts: tsLateUTC,
      cmd: 'rename',
      targetIds: ['q-1'],
      before: { title: 'A' },
      after: { title: 'B' },
    });
    assert.match(line, /2026-05-15/);
  });
});
