import assert from 'node:assert/strict';
import test from 'node:test';

// TODO: Plan 27-02 — replace with assertions on applyLocaleDirective:
//   - Prepends system message when none exists
//   - Appends to existing system message
//   - Idempotent (no double-inject)
//   - Locale name is exactly "Simplified Chinese" (not "Chinese") for zh
test('placeholder — replaced by Plan 27-02', () => {
  assert.ok(true, 'skeleton only');
});
