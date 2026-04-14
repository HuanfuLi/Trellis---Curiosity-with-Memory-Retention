import assert from 'node:assert/strict';
import test from 'node:test';

// Minimal localStorage shim for node:test environment
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

test('getBlossomDates returns empty object when key absent', async () => {
  storage.clear();
  const svc = await import('../../src/services/trellis-blossom-dates.service.ts');
  assert.deepEqual(svc.getBlossomDates(), {});
});

test('setBlossomDate persists and getBlossomDates reflects it', async () => {
  storage.clear();
  const svc = await import('../../src/services/trellis-blossom-dates.service.ts');
  svc.setBlossomDate('anchor-1', '2026-04-10');
  assert.deepEqual(svc.getBlossomDates(), { 'anchor-1': '2026-04-10' });
});

test('clearBlossomDate removes only that key', async () => {
  storage.clear();
  const svc = await import('../../src/services/trellis-blossom-dates.service.ts');
  svc.setBlossomDate('a', '2026-04-10');
  svc.setBlossomDate('b', '2026-04-11');
  svc.clearBlossomDate('a');
  assert.deepEqual(svc.getBlossomDates(), { b: '2026-04-11' });
});

test('getBlossomDates survives malformed JSON', async () => {
  storage.clear();
  storage.set('trellis_blossom_dates', '{not json');
  const svc = await import('../../src/services/trellis-blossom-dates.service.ts');
  assert.deepEqual(svc.getBlossomDates(), {});
});
