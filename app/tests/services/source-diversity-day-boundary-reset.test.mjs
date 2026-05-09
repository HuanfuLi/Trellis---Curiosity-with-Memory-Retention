/**
 * Phase 41 Plan 41-01 Task 3 — sourceDiversityService.reset() at loadCache day-boundary.
 *
 * Covers SC-2(d): loadCache()'s date-mismatch branch fires sourceDiversityService.reset()
 * (Pitfall 3 Option A — idempotent placement).
 *
 * Test approach (Pitfall 8 — outcome-based, NOT call-count):
 *   - Source-reading: assert sourceDiversityService.reset() appears inside the
 *     `if (parsed.date !== today())` branch and BEFORE `return null`.
 *   - Behavioral: directly exercise sourceDiversityService.recordServedDomain →
 *     reset() → getUsedDomains and assert wholesale-wipe semantics + idempotence.
 *
 * The test does NOT assert that reset() fires exactly N times per loadCache()
 * invocation — by Pitfall 8 design, the function is idempotent and may legitimately
 * be called multiple times across stale-cache scenarios. End-state assertion only.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
  new URL('../../src/services/concept-feed.service.ts', import.meta.url),
  'utf8',
);

const { sourceDiversityService } = await import('../../src/services/source-diversity.service.ts');

// ─── Source-reading: reset() lives inside the date-mismatch branch ───────────

test('loadCache date-mismatch branch calls sourceDiversityService.reset() before return null', () => {
  // Window-based — find the `if (parsed.date !== today())` line and confirm
  // sourceDiversityService.reset() appears before `return null` in that block.
  const idx = SRC.indexOf('if (parsed.date !== today())');
  assert.ok(idx >= 0, 'loadCache date-mismatch branch must exist in concept-feed.service.ts');

  // 600-char window covers the early-return block including the reset() call
  // and the closing brace of the if. Won't spill into the next function.
  const window = SRC.slice(idx, idx + 600);
  assert.match(
    window,
    /sourceDiversityService\.reset\(\)/,
    'sourceDiversityService.reset() must be called inside the date-mismatch branch',
  );
  assert.match(
    window,
    /return null/,
    'date-mismatch branch must early-return null',
  );

  // Order check — reset() must come BEFORE return null per Pitfall 3 Option A
  // (cleanup happens, THEN the function bails so callers see "no cache" semantics).
  assert.ok(
    window.indexOf('sourceDiversityService.reset()') < window.indexOf('return null'),
    'reset() must precede return null in the date-mismatch branch',
  );
});

// ─── Behavioral (Pitfall 8 — outcome-based) ───────────────────────────────────

test('reset() is wholesale wipe — getUsedDomains returns empty Set after reset', () => {
  sourceDiversityService.reset();  // clean slate

  sourceDiversityService.recordServedDomain('test-anchor-a', 'nature.com');
  sourceDiversityService.recordServedDomain('test-anchor-b', 'sciencedirect.com');
  assert.equal(
    sourceDiversityService.getUsedDomains('test-anchor-a').size,
    1,
    'pre-reset: anchor-a has nature.com',
  );
  assert.equal(
    sourceDiversityService.getUsedDomains('test-anchor-b').size,
    1,
    'pre-reset: anchor-b has sciencedirect.com',
  );

  sourceDiversityService.reset();

  assert.equal(
    sourceDiversityService.getUsedDomains('test-anchor-a').size,
    0,
    'post-reset: anchor-a usedDomains must be empty',
  );
  assert.equal(
    sourceDiversityService.getUsedDomains('test-anchor-b').size,
    0,
    'post-reset: anchor-b usedDomains must be empty',
  );
});

test('reset() is idempotent — calling twice still results in empty state', () => {
  sourceDiversityService.reset();  // clean slate

  sourceDiversityService.recordServedDomain('test-anchor-c', 'nytimes.com');
  sourceDiversityService.reset();
  sourceDiversityService.reset();  // second call — must not throw

  assert.equal(
    sourceDiversityService.getUsedDomains('test-anchor-c').size,
    0,
    'second consecutive reset() must leave state empty (idempotent)',
  );
});

test('reset() does not throw when usedByAnchor Map is already empty', () => {
  sourceDiversityService.reset();  // ensure empty
  // Calling reset on an already-empty map must not throw — Pitfall 8 expectation
  // for stale-cache scenarios where loadCache() is called multiple times across
  // a day before a fresh saveCache(today) writes a new entry.
  assert.doesNotThrow(() => {
    sourceDiversityService.reset();
    sourceDiversityService.reset();
    sourceDiversityService.reset();
  });
});
