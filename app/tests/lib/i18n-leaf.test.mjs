// tests/lib/i18n-leaf.test.mjs (Phase 37)
import assert from 'node:assert/strict';
import test from 'node:test';

const { t, getCurrentLocale, bindI18nLeaf } = await import(
  '../../src/lib/i18n-leaf.ts'
);

test('default: t(key) returns the key (identity)', () => {
  assert.equal(t('common.toast.someKey'), 'common.toast.someKey');
});

test('default: getCurrentLocale() returns "en"', () => {
  assert.equal(getCurrentLocale(), 'en');
});

test('bindI18nLeaf rebinds t and locale', () => {
  bindI18nLeaf(
    (key) => `T:${key}`,
    () => 'zh',
  );
  assert.equal(t('hello'), 'T:hello');
  assert.equal(getCurrentLocale(), 'zh');

  // Reset to identity for subsequent tests in the same process.
  bindI18nLeaf((k) => k, () => 'en');
  assert.equal(t('hello'), 'hello');
  assert.equal(getCurrentLocale(), 'en');
});

test('t passes opts through to bound function', () => {
  let capturedOpts;
  bindI18nLeaf(
    (key, opts) => {
      capturedOpts = opts;
      return key;
    },
    () => 'en',
  );
  t('greet', { name: 'world' });
  assert.deepEqual(capturedOpts, { name: 'world' });

  bindI18nLeaf((k) => k, () => 'en');
});
