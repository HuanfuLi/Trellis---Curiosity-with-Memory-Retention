import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateLegacyKeys } from '../../src/services/legacy-migration.service.ts';

// Minimal localStorage stub for node test runtime
function makeLocalStorageStub(initial = {}) {
  const store = new Map(Object.entries(initial));
  const stub = {
    get length() { return store.size; },
    key(i) { return Array.from(store.keys())[i] ?? null; },
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
  };
  return { stub, store };
}

test('migrateLegacyKeys copies echolearn_* values to trellis_* and removes the originals', () => {
  const { stub, store } = makeLocalStorageStub({
    echolearn_settings: '{"theme":"dark"}',
    echolearn_post_queue: '[1,2,3]',
    unrelated_key: 'leave-me-alone',
  });
  // @ts-ignore — inject stub for the duration of this test
  globalThis.localStorage = stub;

  const result = migrateLegacyKeys();

  assert.equal(result.copied, 2);
  assert.equal(store.get('trellis_settings'), '{"theme":"dark"}');
  assert.equal(store.get('trellis_post_queue'), '[1,2,3]');
  assert.equal(store.has('echolearn_settings'), false);
  assert.equal(store.has('echolearn_post_queue'), false);
  assert.equal(store.get('unrelated_key'), 'leave-me-alone');
});

test('migrateLegacyKeys skips when trellis_* is already populated and drops the legacy copy', () => {
  const { stub, store } = makeLocalStorageStub({
    echolearn_settings: '{"old":true}',
    trellis_settings: '{"new":true}',
  });
  // @ts-ignore
  globalThis.localStorage = stub;

  const result = migrateLegacyKeys();

  assert.equal(result.copied, 0);
  assert.equal(result.skipped, 1);
  assert.equal(store.get('trellis_settings'), '{"new":true}'); // not clobbered
  assert.equal(store.has('echolearn_settings'), false);         // legacy dropped
});

test('migrateLegacyKeys is idempotent — second call is a no-op', () => {
  const { stub, store } = makeLocalStorageStub({
    echolearn_settings: '{"theme":"light"}',
  });
  // @ts-ignore
  globalThis.localStorage = stub;

  const first = migrateLegacyKeys();
  const second = migrateLegacyKeys();

  assert.equal(first.copied, 1);
  assert.equal(second.copied, 0);
  assert.equal(second.skipped, 0);
  assert.equal(store.get('trellis_settings'), '{"theme":"light"}');
});

test('migrateLegacyKeys is a no-op when localStorage is undefined (SSR-safe)', () => {
  // @ts-ignore
  globalThis.localStorage = undefined;
  const result = migrateLegacyKeys();
  assert.equal(result.copied, 0);
  assert.equal(result.skipped, 0);
});
