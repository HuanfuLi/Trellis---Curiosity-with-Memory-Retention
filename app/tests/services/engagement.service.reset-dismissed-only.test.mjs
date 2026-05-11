// Phase 43 Plan 43-13 — source-reading invariants for resetDismissedOnly().
//
// Asserts that engagement.service.ts:
//   (a) declares resetDismissedOnly(): void on the engagementService export
//   (b) the method body mutates state.dismissed = [] (the dismissed array
//       being explicitly wiped)
//   (c) the method body does NOT touch state.saved or state.liked (the
//       persistence-across-days invariant operator intent)
//   (d) the method is idempotent — early-return when dismissed.length === 0
//   (e) emits ENGAGEMENT_CHANGED with kind: 'undismiss' and sentinel id: '*'
//   (f) the original reset() method is preserved for Clear-All-Data /
//       settingsService.reset() paths
//
// Pattern: pure regex + indexOf against the live source — no React render,
// no jsdom. Follows the Phase 39/40/41/42/43 source-reading discipline.
//
// See .planning/debug/force-new-day-wipes-saved-liked.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/services/engagement.service.ts'), 'utf8');

// Scope assertions to the resetDismissedOnly method body to prevent
// cross-method false-positives. Anchor on the method declaration.
function methodBody() {
  const start = src.indexOf('resetDismissedOnly(): void');
  assert.ok(start > 0, 'engagementService must declare resetDismissedOnly(): void');
  // Method body ends at the first standalone closing brace `},` at the
  // method's outer level. We use a generous slice and then narrow.
  const closeIdx = src.indexOf('  },', start);
  assert.ok(closeIdx > start, 'resetDismissedOnly method body must terminate');
  return src.slice(start, closeIdx + 4);
}

test('43-13: engagementService declares resetDismissedOnly(): void', () => {
  assert.match(src, /resetDismissedOnly\(\):\s*void/, 'engagementService must expose resetDismissedOnly(): void');
});

test('43-13: resetDismissedOnly mutates state.dismissed = []', () => {
  const body = methodBody();
  assert.match(
    body,
    /state\.dismissed\s*=\s*\[\]/,
    'resetDismissedOnly must explicitly set state.dismissed = []',
  );
});

test('43-13: resetDismissedOnly does NOT mutate state.saved or state.liked (archives persistent)', () => {
  const body = methodBody();
  assert.doesNotMatch(
    body,
    /state\.saved\s*=/,
    'resetDismissedOnly must NOT mutate state.saved (saved archive is persistent across days)',
  );
  assert.doesNotMatch(
    body,
    /state\.liked\s*=/,
    'resetDismissedOnly must NOT mutate state.liked (liked archive is persistent across days)',
  );
});

test('43-13: resetDismissedOnly is idempotent (early-return when dismissed.length === 0)', () => {
  const body = methodBody();
  assert.match(
    body,
    /state\.dismissed\.length\s*===\s*0/,
    'resetDismissedOnly must check `state.dismissed.length === 0` for idempotence',
  );
  // The early-return must precede the mutation to actually skip work.
  const guardIdx = body.search(/state\.dismissed\.length\s*===\s*0/);
  const returnIdx = body.indexOf('return', guardIdx);
  const mutationIdx = body.search(/state\.dismissed\s*=\s*\[\]/);
  assert.ok(
    returnIdx > guardIdx && returnIdx < mutationIdx,
    'early-return must occur AFTER the length check and BEFORE the mutation',
  );
});

test('43-13: resetDismissedOnly emits ENGAGEMENT_CHANGED with kind: undismiss + id: *', () => {
  const body = methodBody();
  assert.match(
    body,
    /eventBus\.emit\(\s*\{[\s\S]*type:\s*['"]ENGAGEMENT_CHANGED['"]/,
    'resetDismissedOnly must emit an ENGAGEMENT_CHANGED event',
  );
  assert.match(
    body,
    /kind:\s*['"]undismiss['"]/,
    'emit payload must use kind: undismiss (same kind as per-id undismissAnchor)',
  );
  assert.match(
    body,
    /id:\s*['"]\*['"]/,
    'emit payload must use sentinel id: "*" to signal bulk reset to subscribers',
  );
});

test('43-13: engagementService.reset() (wholesale wipe) is preserved for Clear-All-Data paths', () => {
  // Regression guard — Clear-All-Data + settingsService.reset() still need
  // the wholesale reset() method. It must NOT be deleted alongside the
  // partial-reset introduction.
  assert.match(
    src,
    /\breset\(\):\s*void/,
    'engagementService.reset(): void must be preserved as the wholesale wipe for Clear-All-Data callers',
  );
  assert.match(
    src,
    /saveState\(freshState\(\)\)/,
    'reset() body must still call saveState(freshState()) — wholesale wipe shape preserved',
  );
});
