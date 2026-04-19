/**
 * Tests for G4 (STARTER-PERSIST) — starter posts persist + decay contract.
 *
 * Per CONTEXT D-11: starter posts must persist to the daily cache on first cold-start so
 * subsequent /home visits return them from cache (regardless of questions.length).
 *
 * Per CONTEXT D-12: starter posts decay once the user has 3+ organic (non-starter) posts.
 * Threshold: cached.posts.filter(p => !STARTER_POST_IDS.has(p.id)).length >= 3.
 *
 * The persistence behavior in concept-feed.service.ts:getDailyPosts cannot be unit-tested
 * directly (i18next JSON-import-attribute chain — see starter-posts.test.mjs:7-15 for the
 * documented workaround). We validate the EXPORTED CONTRACT via a separate pure-helper
 * module: app/src/services/starter-posts-decay.ts.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// localStorage polyfill (mirrors concept-batch-filter.test.mjs:21-28)
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const decay = await import('../../src/services/starter-posts-decay.ts');

describe('Starter post IDs registry (G4 / D-11)', () => {
  it('STARTER_POST_IDS exports a Set with the 3 expected IDs', () => {
    assert.ok(decay.STARTER_POST_IDS instanceof Set, 'must be a Set');
    assert.equal(decay.STARTER_POST_IDS.size, 3);
    assert.ok(decay.STARTER_POST_IDS.has('starter-welcome'));
    assert.ok(decay.STARTER_POST_IDS.has('starter-knowledge-growth'));
    assert.ok(decay.STARTER_POST_IDS.has('starter-daily-feed'));
  });

  it('isStarterPostId distinguishes starter from organic IDs', () => {
    assert.equal(decay.isStarterPostId('starter-welcome'), true);
    assert.equal(decay.isStarterPostId('starter-knowledge-growth'), true);
    assert.equal(decay.isStarterPostId('starter-daily-feed'), true);
    assert.equal(decay.isStarterPostId('post-abc-123'), false);
    assert.equal(decay.isStarterPostId(''), false);
  });
});

describe('shouldDecayStarters predicate (G4 / D-12)', () => {
  const stub = (id) => ({ id });

  it('returns false when no organic posts exist', () => {
    assert.equal(decay.shouldDecayStarters([
      stub('starter-welcome'),
      stub('starter-knowledge-growth'),
      stub('starter-daily-feed'),
    ]), false);
  });

  it('returns false when fewer than 3 organic posts exist', () => {
    assert.equal(decay.shouldDecayStarters([
      stub('starter-welcome'),
      stub('post-1'),
      stub('post-2'),
    ]), false, '2 organic < 3 threshold');
  });

  it('returns true when exactly 3 organic posts exist', () => {
    assert.equal(decay.shouldDecayStarters([
      stub('starter-welcome'),
      stub('post-1'),
      stub('post-2'),
      stub('post-3'),
    ]), true);
  });

  it('returns true when more than 3 organic posts exist (no starters)', () => {
    assert.equal(decay.shouldDecayStarters([
      stub('post-1'), stub('post-2'), stub('post-3'), stub('post-4'),
    ]), true);
  });

  it('handles empty array', () => {
    assert.equal(decay.shouldDecayStarters([]), false);
  });
});

describe('filterDecayedStarters helper (G4 / D-12)', () => {
  const stub = (id) => ({ id });

  it('returns array unchanged when shouldDecayStarters is false', () => {
    const input = [stub('starter-welcome'), stub('post-1')];
    assert.deepEqual(decay.filterDecayedStarters(input).map(p => p.id), ['starter-welcome', 'post-1']);
  });

  it('drops starter posts when shouldDecayStarters is true', () => {
    const input = [stub('starter-welcome'), stub('post-1'), stub('post-2'), stub('post-3')];
    assert.deepEqual(decay.filterDecayedStarters(input).map(p => p.id), ['post-1', 'post-2', 'post-3']);
  });
});
