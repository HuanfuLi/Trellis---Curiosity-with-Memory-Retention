import assert from 'node:assert/strict';
import test from 'node:test';

// TODO: Plan 27-04 — replace with integration test that stubs chatStream
// as a controllable async iterator, fires LOCALE_CHANGED mid-stream, and
// asserts that accumulated text does not grow past the abort point AND
// questionService.buildAndSave is NOT called. Validates D-22.
test('placeholder — replaced by Plan 27-04', () => {
  assert.ok(true, 'skeleton only');
});
