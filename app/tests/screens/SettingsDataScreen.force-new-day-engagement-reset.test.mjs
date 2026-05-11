// Phase 43 Plan 43-07 — source-reading invariants for SC-6.
//
// Asserts that SettingsDataScreen.handleForceNewDay wires engagementService.reset()
// into the Force-New-Day dev affordance:
//   (a) engagementService is imported at the module top
//   (b) the reset() call lives INSIDE handleForceNewDay's function body
//   (c) ordering: dailyReadService.reset() → engagementService.reset() → success toast
//   (d) the call appears exactly once (no duplicate accumulation across edits)
//
// Per CLAUDE.md "when a dev affordance simulates a wall-clock event the service
// can't observe (e.g., Force-New-Day), the dev handler must call every service
// reset() AND mutate every date-stamped storage key the natural event would have
// triggered" — engagementService.reset() joins dailyReadService.reset() + the two
// date mutations as the canonical Force-New-Day mimic set.
//
// Pattern follows Phase 39/40/41/42/43-04/43-05/43-06 source-reading invariant
// test discipline: pure regex + indexOf comparisons against the live source file,
// no React render, no jsdom, no node_modules side effects.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/screens/settings/SettingsDataScreen.tsx'), 'utf8');

test('SC-6: engagementService imported at module top', () => {
  assert.match(src, /import\s+\{\s*engagementService\s*\}\s+from\s+['"][^'"]*engagement\.service['"]/);
});

test('SC-6: engagementService.reset() called inside handleForceNewDay', () => {
  const fnStart = src.indexOf('const handleForceNewDay');
  assert.ok(fnStart > 0, 'handleForceNewDay function must exist');
  const fnEnd = src.indexOf('  };', fnStart);
  assert.ok(fnEnd > fnStart, 'handleForceNewDay function body must terminate with closing brace');
  const fnBody = src.slice(fnStart, fnEnd);
  assert.match(fnBody, /engagementService\.reset\(\)/, 'engagementService.reset() must be called inside handleForceNewDay');
});

test('SC-6: engagementService.reset() ordering — after dailyReadService.reset(), before success toast', () => {
  const fnStart = src.indexOf('const handleForceNewDay');
  const fnEnd = src.indexOf('  };', fnStart);
  const fnBody = src.slice(fnStart, fnEnd);

  const dailyResetIdx = fnBody.indexOf('dailyReadService.reset()');
  const engagementResetIdx = fnBody.indexOf('engagementService.reset()');
  const successToastIdx = fnBody.indexOf("toast('Queue + daily-posts");

  assert.ok(dailyResetIdx > 0, 'dailyReadService.reset() must exist in handleForceNewDay');
  assert.ok(engagementResetIdx > 0, 'engagementService.reset() must exist in handleForceNewDay');
  assert.ok(successToastIdx > 0, 'success toast must exist in handleForceNewDay');

  assert.ok(engagementResetIdx > dailyResetIdx, 'engagementService.reset() must come AFTER dailyReadService.reset()');
  assert.ok(engagementResetIdx < successToastIdx, 'engagementService.reset() must come BEFORE the success toast');
});

test('SC-6: engagementService.reset() called exactly once (no duplicate accumulation)', () => {
  const calls = (src.match(/engagementService\.reset\(\)/g) || []).length;
  assert.strictEqual(calls, 1);
});
