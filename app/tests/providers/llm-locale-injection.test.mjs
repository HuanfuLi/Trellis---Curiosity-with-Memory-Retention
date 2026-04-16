import assert from 'node:assert/strict';
import test from 'node:test';
import i18next from 'i18next';

// Initialize the i18next global singleton once for the whole test file.
// applyLocaleDirective reads i18next.language (the global default instance).
await i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: {} },
    zh: { translation: {} },
    es: { translation: {} },
    ja: { translation: {} },
  },
});

// applyLocaleDirective is exported from providers/llm/locale-directive.ts (JSON-free;
// safe to import under Node 25 `node --test` which rejects JSON imports without
// `with { type: 'json' }`). providers/llm/index.ts re-exports it for production use.
const { applyLocaleDirective } = await import('../../src/providers/llm/locale-directive.ts');

test('prepends system directive when none exists (zh)', async () => {
  await i18next.changeLanguage('zh');
  const out = applyLocaleDirective([{ role: 'user', content: 'hi' }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].role, 'system');
  assert.ok(
    out[0].content.includes('Respond in Simplified Chinese.'),
    `expected 'Respond in Simplified Chinese.' in system content, got: ${out[0].content}`,
  );
  assert.equal(out[1].role, 'user');
  assert.equal(out[1].content, 'hi');
});

test('appends to existing system message (ja)', async () => {
  await i18next.changeLanguage('ja');
  const out = applyLocaleDirective([
    { role: 'system', content: 'You are X.' },
    { role: 'user', content: 'hi' },
  ]);
  assert.equal(out.length, 2);
  assert.ok(out[0].content.startsWith('You are X.'));
  assert.ok(
    out[0].content.includes('Respond in Japanese.'),
    `expected 'Respond in Japanese.' in merged system content, got: ${out[0].content}`,
  );
  assert.equal(out[1].content, 'hi');
});

test('is idempotent (no double-inject)', async () => {
  await i18next.changeLanguage('es');
  const once = applyLocaleDirective([{ role: 'user', content: 'hi' }]);
  const twice = applyLocaleDirective(once);
  assert.equal(twice.length, once.length);
  assert.deepEqual(twice, once);
});

test('unknown locale falls back to English', async () => {
  // force-set an unsupported code; i18next accepts it even when not in resources.
  await i18next.changeLanguage('ko');
  const out = applyLocaleDirective([{ role: 'user', content: 'hi' }]);
  assert.ok(
    out[0].content.includes('Respond in English.'),
    `expected EN fallback, got: ${out[0].content}`,
  );
});

test('uses "Simplified Chinese" (not "Chinese")', async () => {
  await i18next.changeLanguage('zh');
  const out = applyLocaleDirective([{ role: 'user', content: 'hi' }]);
  assert.ok(out[0].content.includes('Simplified Chinese'));
  assert.ok(
    !/Respond in Chinese\./.test(out[0].content),
    `must not say plain "Chinese"; got: ${out[0].content}`,
  );
});
