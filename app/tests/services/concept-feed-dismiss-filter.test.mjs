// Phase 43 Plan 43-14 — concept-feed dismiss filter at the READ BOUNDARY.
//
// Asserts that conceptFeedService.getCachedDailyPosts() and
// conceptFeedService.getDailyPosts() cache-hit + fingerprint-mismatch branches
// apply engagementService.getDismissedAnchorIds() to filter cached posts
// before returning. Walker dismiss-skip at post-queue.service.ts:389
// (Phase 39 D-07) is left UNCHANGED and is a sibling forward-looking filter
// for FUTURE refills; this test guards the READ-TIME filter for ALREADY-
// CACHED posts.
//
// IMPLEMENTATION NOTE: concept-feed.service.ts dynamic-import under
// `node --test` crashes via the i18n locales chain
// (locales/index.ts → en.json → ERR_IMPORT_ATTRIBUTE_MISSING — see
// `refill-mutex.test.mjs` and CLAUDE.md "Phase 27 locale tests"). All
// tests in this file therefore use the SOURCE-READING fallback documented
// in Plan 43-14 Task 2 action ("If dynamic import fails: all tests fall
// back to source-reading"). Each assertion targets the exact code shape
// that produces the dismiss filter at the read boundary; combined with
// Task 3's HomeScreen.dismiss-resync invariants, this proves the
// centralized read-boundary filter is wired correctly across all read
// sites HomeScreen consumes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

const feedSrc = readFileSync(path.join(appRoot, 'src/services/concept-feed.service.ts'), 'utf8');
const queueSrc = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');

// ─── Locate the helper body region once for downstream assertions. ───────────
const helperDeclMatch = feedSrc.match(/function\s+applyDismissedFilter\s*\(\s*posts\s*:\s*DailyPost\[\]\s*\)\s*:\s*DailyPost\[\]\s*\{[\s\S]*?\n\}/);

test('Test 1: empty-dismissed baseline — helper short-circuits and returns input unfiltered', () => {
  assert.ok(helperDeclMatch, 'applyDismissedFilter declaration must exist with the documented signature');
  const helperBody = helperDeclMatch[0];
  // Baseline short-circuit: when dismissed.size === 0 return the input array as-is.
  assert.match(
    helperBody,
    /if\s*\(\s*dismissed\.size\s*===\s*0\s*\)\s*return\s+posts\s*;?/,
    'helper must short-circuit when dismissed set is empty (Test 1 baseline)',
  );
});

test('Test 2: single-anchor dismiss — filter drops posts whose sourceQuestionIds[0] is dismissed', () => {
  assert.ok(helperDeclMatch, 'applyDismissedFilter declaration must exist');
  const helperBody = helperDeclMatch[0];
  // The predicate must look up anchorId from sourceQuestionIds[0] and check
  // Set membership of the dismissed set.
  assert.match(
    helperBody,
    /p\.sourceQuestionIds\??\.\??\[0\]/,
    'helper must read post.sourceQuestionIds[0] (the anchor id) for the dismiss check',
  );
  assert.match(
    helperBody,
    /dismissed\.has\(\s*anchorId\s*\)/,
    'helper must use Set.has(anchorId) for the dismiss test',
  );
  // The filter must DROP matching posts (i.e., return !dismissed.has(...)).
  assert.match(
    helperBody,
    /return\s+!dismissed\.has\(\s*anchorId\s*\)/,
    'helper must return !dismissed.has(anchorId) to drop dismissed-anchor posts',
  );
});

test('Test 3: multi-anchor dismiss — Set-based predicate handles N>=1 dismissed ids uniformly', () => {
  assert.ok(helperDeclMatch, 'applyDismissedFilter declaration must exist');
  const helperBody = helperDeclMatch[0];
  // Set construction from engagementService.getDismissedAnchorIds(): multi-
  // anchor correctness comes for free because Set.has covers every member.
  assert.match(
    helperBody,
    /new\s+Set\s*\(\s*engagementService\.getDismissedAnchorIds\(\)\s*\)/,
    'helper must construct a Set from engagementService.getDismissedAnchorIds() (multi-anchor correctness)',
  );
});

test('Test 4: orphan posts (empty sourceQuestionIds) are non-dismissable — edge case for legacy starters', () => {
  assert.ok(helperDeclMatch, 'applyDismissedFilter declaration must exist');
  const helperBody = helperDeclMatch[0];
  // The helper must early-return true when there is no anchor id, so orphan
  // posts (e.g., legacy starter posts) survive the filter.
  assert.match(
    helperBody,
    /if\s*\(\s*!anchorId\s*\)\s*return\s+true/,
    'helper must short-circuit return true when anchorId is falsy (orphan posts are non-dismissable)',
  );
});

test('Test 5: getDailyPosts() cache-hit branch — dismiss filter applied between sourceType filter and filterDecayedStarters', () => {
  // Locate the cache-hit guard and assert the helper is called inside the
  // branch, between the sourceType !== 'connection' filter and filterDecayedStarters.
  const cacheHitStart = feedSrc.indexOf("cached?.date === date && cached.fingerprint === fingerprint && cached.posts.length > 0");
  assert.ok(cacheHitStart > 0, 'cache-hit branch must exist in getDailyPosts');
  // Grab the entire branch body up to the closing brace of the if statement.
  const cacheHitRegion = feedSrc.slice(cacheHitStart, cacheHitStart + 1000);
  // Sequence: feedPosts (sourceType filter) → applyDismissedFilter → filterDecayedStarters
  const sourceTypeIdx = cacheHitRegion.indexOf("p.sourceType !== 'connection'");
  const helperCallIdx = cacheHitRegion.indexOf('applyDismissedFilter(');
  const decayCallIdx = cacheHitRegion.indexOf('filterDecayedStarters(');
  assert.ok(sourceTypeIdx >= 0, 'cache-hit branch must still filter sourceType !== connection');
  assert.ok(helperCallIdx > sourceTypeIdx, 'applyDismissedFilter must be called AFTER the sourceType filter inside the cache-hit branch');
  assert.ok(decayCallIdx > helperCallIdx, 'filterDecayedStarters must be called AFTER applyDismissedFilter (decay heuristic sees user-visible count)');

  // The fingerprint-mismatch same-day branch must ALSO call applyDismissedFilter.
  const fingerMismatchStart = feedSrc.indexOf('cached.fingerprint !== fingerprint');
  assert.ok(fingerMismatchStart > 0, 'fingerprint-mismatch same-day branch must exist');
  const fingerRegion = feedSrc.slice(fingerMismatchStart, fingerMismatchStart + 1000);
  assert.match(
    fingerRegion,
    /applyDismissedFilter\(/,
    'fingerprint-mismatch same-day branch must call applyDismissedFilter symmetrically with cache-hit branch',
  );
});

test('Test 6: drain branch unchanged — posts dequeued from postQueueService pass through verbatim (walker already filtered)', () => {
  // The drain branch takes from postQueueService.dequeue() and writes to the
  // daily cache. We assert via SOURCE-READING that the drain branch does
  // NOT call applyDismissedFilter — the walker (post-queue.service.ts:389)
  // already handled the forward-looking filter for queued items.
  const drainIdx = feedSrc.indexOf('saveCache({ date, fingerprint, posts: queuedPosts');
  assert.ok(drainIdx > 0, 'drain branch saveCache call must still exist (drain shape preserved)');
  const region = feedSrc.slice(Math.max(0, drainIdx - 400), drainIdx + 400);
  assert.doesNotMatch(
    region,
    /applyDismissedFilter\(/,
    'drain branch must NOT call applyDismissedFilter — walker dismiss-skip at post-queue.service.ts:389 owns that filter for queued items',
  );
});

test('Test 7: NEGATIVE INVARIANT — walker dismiss-skip at post-queue.service.ts:389 is unchanged (Phase 39 D-07 contract)', () => {
  // The exact predicate from line 389. If this regex stops matching, the
  // walker contract has been disturbed.
  assert.match(
    queueSrc,
    /!exploredIds\.has\(id\)\s*&&\s*!dismissedIds\.has\(id\)/,
    'walker dismiss-skip predicate at post-queue.service.ts:389 must be unchanged (Phase 39 D-07)',
  );
  // Walker still accepts dismissedIds as a required positional argument.
  assert.match(
    queueSrc,
    /walkDerivedList\(\s*count:\s*number,\s*exploredIds:\s*Set<string>,\s*dismissedIds:\s*Set<string>\s*\)/,
    'walkDerivedList signature must still take dismissedIds as a required positional argument',
  );
  // refillQueue still builds dismissedIds Set from engagementService and
  // passes it to walkDerivedList — read-boundary filter does NOT replace
  // the forward-looking walker filter.
  assert.match(
    feedSrc,
    /const\s+dismissedIds\s*=\s*new\s+Set\s*\(\s*engagementService\.getDismissedAnchorIds\(\)\s*\)/,
    'refillQueue must still build dismissedIds Set from engagementService (walker contract preserved)',
  );
});
