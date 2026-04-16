import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';

test('missingKeyHandler fires; fallback returns EN text (never raw key path in prod)', async () => {
  let missingFired = false;
  const inst = i18next.createInstance();
  await inst.init({
    lng: 'zh',
    fallbackLng: 'en',
    resources: {
      en: { translation: { greet: 'Hello' } },
      zh: { translation: {} },
    },
    saveMissing: true,
    missingKeyHandler: () => {
      missingFired = true;
    },
  });
  assert.equal(inst.t('greet'), 'Hello', 'fallback EN should render');
  inst.t('nonexistent.key');
  assert.ok(missingFired, 'missingKeyHandler must fire for truly missing key');
});
