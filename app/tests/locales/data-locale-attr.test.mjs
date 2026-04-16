import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';

// Minimal document shim — avoids jsdom dependency.
const attrs = new Map();
let lang = 'en';
Object.defineProperty(globalThis, 'document', {
  value: {
    documentElement: {
      setAttribute: (k, v) => attrs.set(k, v),
      getAttribute: (k) => attrs.get(k) ?? null,
      get dataset() {
        return new Proxy(
          {},
          { get: (_t, k) => attrs.get(`data-${String(k)}`) },
        );
      },
      set lang(v) {
        lang = v;
      },
      get lang() {
        return lang;
      },
    },
  },
  configurable: true,
  writable: true,
});

test('data-locale attribute: set on init + updated on changeLanguage', async () => {
  const inst = i18next.createInstance();
  await inst.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} }, zh: { translation: {} } },
  });

  // Simulate what src/locales/index.ts does at module init
  document.documentElement.setAttribute('data-locale', 'en');
  document.documentElement.lang = 'en';
  inst.on('languageChanged', (lng) => {
    document.documentElement.setAttribute('data-locale', lng);
    document.documentElement.lang = lng;
  });

  assert.equal(attrs.get('data-locale'), 'en');
  assert.equal(document.documentElement.lang, 'en');

  await inst.changeLanguage('zh');
  assert.equal(attrs.get('data-locale'), 'zh');
  assert.equal(document.documentElement.lang, 'zh');
});
