import assert from 'node:assert/strict';
import test from 'node:test';

// TODO: Plan 27-02 — replace with assertion that synthesize() passes a
// locale-appropriate voice ID to the TTS provider (mock fetch, switch
// i18n.language, assert body.voice matches LOCALE_VOICE_FALLBACK mapping).
test('placeholder — replaced by Plan 27-02', () => {
  assert.ok(true, 'skeleton only');
});
