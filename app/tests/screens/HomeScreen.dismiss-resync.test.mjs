// Phase 43 Plan 43-14 — source-reading invariants for HomeScreen + concept-feed
// dismiss filter centralization at the READ BOUNDARY.
//
// Asserts:
//   (1) Effect A (live ANCHOR_DISMISSED setDailyPosts(prev => prev.filter(...)))
//       is still present in HomeScreen.tsx for the LP-05 fade-out animation.
//   (2) The HomeScreen write paths (warm-start initializer, main effect
//       getDailyPosts, [location.pathname] re-fallback effect) read from
//       conceptFeedService and DO NOT call
//       engagementService.getDismissedAnchorIds() themselves — the filter is
//       centralized at the cache-read boundary.
//   (3) Effect B at [location.pathname] still references
//       engagementService.getDismissedAnchorIds() — defense-in-depth preserved.
//   (4) NEGATIVE — concept-feed walker invocation (refillQueue's
//       walkDerivedList call) is UNCHANGED. Walker dismiss-skip at
//       post-queue.service.ts:389 is the FORWARD-LOOKING filter; this plan
//       only adds the READ-TIME filter.
//   (5) COUNTERWEIGHT — concept-feed.service.ts now declares
//       applyDismissedFilter and calls it from getCachedDailyPosts +
//       getDailyPosts cache-hit branch.
//
// Pattern: readFileSync + regex; no React render; no jsdom. Mirrors
// app/tests/screens/HomeScreen.engagement-resync.test.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const homeSrc = readFileSync(path.join(appRoot, 'src/screens/HomeScreen.tsx'), 'utf8');
const feedSrc = readFileSync(path.join(appRoot, 'src/services/concept-feed.service.ts'), 'utf8');
const queueSrc = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');

test('43-14 Test 1: Effect A live ANCHOR_DISMISSED filter is still present (LP-05 fast-path preserved)', () => {
  // The Effect A pattern from Phase 43-06: subscribe('ANCHOR_DISMISSED') →
  // setDailyPosts(prev => prev.filter(p => p.sourceQuestionIds?.[0] !== anchorId))
  assert.match(homeSrc, /eventBus\.subscribe\(\s*['"]ANCHOR_DISMISSED['"]/);
  assert.match(homeSrc, /setDailyPosts\(\s*prev\s*=>\s*prev\.filter/);
  assert.match(homeSrc, /sourceQuestionIds\??\.\??\[0\]\s*!==\s*anchorId/);
});

test('43-14 Test 2: HomeScreen write paths do NOT call engagementService.getDismissedAnchorIds() inline (filter is centralized at concept-feed read boundary)', () => {
  // The write paths' bodies should rely on conceptFeedService methods,
  // not on inline engagement lookups. We assert via region scoping.
  //
  // Path 1: useState warm-start initializer
  const initStart = homeSrc.indexOf('useState<DailyPost[]>(() => {');
  assert.ok(initStart > 0, 'warm-start initializer must exist');
  // Find the matching '});' that closes the useState initializer (first one after).
  const initEnd = homeSrc.indexOf('});', initStart);
  assert.ok(initEnd > initStart, 'warm-start initializer must terminate');
  const initBody = homeSrc.slice(initStart, initEnd);
  assert.doesNotMatch(
    initBody,
    /engagementService\.getDismissedAnchorIds/,
    'warm-start initializer must NOT call getDismissedAnchorIds inline — filter is centralized at conceptFeedService.getCachedDailyPosts',
  );
  // Confirm warm-start initializer uses getCachedDailyPosts (read-boundary path).
  assert.match(
    initBody,
    /conceptFeedService\.getCachedDailyPosts/,
    'warm-start initializer must read through conceptFeedService.getCachedDailyPosts',
  );

  // Path 2: main effect — locate the getDailyPosts(questions).then(setDailyPosts) site
  const mainEffectIdx = homeSrc.indexOf('conceptFeedService.getDailyPosts(questions)');
  assert.ok(mainEffectIdx > 0, 'main effect getDailyPosts call must exist');
  // Slice ~500 chars around it — should NOT contain a local dismiss lookup
  const mainRegion = homeSrc.slice(Math.max(0, mainEffectIdx - 300), mainEffectIdx + 500);
  assert.doesNotMatch(
    mainRegion,
    /engagementService\.getDismissedAnchorIds/,
    'main effect must NOT inline a dismiss lookup — filter is centralized at conceptFeedService',
  );

  // Path 3: [location.pathname] re-fallback effect — the Phase 36-14 warm-start
  // re-fallback effect (NOT Effect B). Both effects use [location.pathname]; the
  // re-fallback reads conceptFeedService.getCachedDailyPosts. We assert it is
  // still there AND does NOT inline a dismiss lookup.
  const reSyncIdx = homeSrc.indexOf("if (location.pathname !== '/home') return;");
  assert.ok(reSyncIdx > 0, 'location.pathname re-sync effect must exist');
  const reSyncEnd = homeSrc.indexOf('}, [location.pathname]', reSyncIdx);
  assert.ok(reSyncEnd > reSyncIdx, 'location.pathname re-sync must terminate');
  const reSyncBody = homeSrc.slice(reSyncIdx, reSyncEnd);
  // The Phase 36-14 effect uses getCachedDailyPosts (no inline dismiss lookup
  // needed because getCachedDailyPosts now filters at the read boundary).
  assert.match(
    reSyncBody,
    /conceptFeedService\.getCachedDailyPosts/,
    'Phase 36-14 re-sync effect must call getCachedDailyPosts (post-43-14 it filters dismissed inline)',
  );
});

test('43-14 Test 3: Effect B at [location.pathname] still references engagementService.getDismissedAnchorIds (defense-in-depth)', () => {
  // Effect B from Phase 43-06 — re-reads dismissedAnchorIds on every nav to /home.
  // Kept as defense-in-depth even though the read boundary now also filters.
  assert.match(homeSrc, /engagementService\.getDismissedAnchorIds\(\)/);
  const dismissCallIdx = homeSrc.indexOf('engagementService.getDismissedAnchorIds()');
  const trailing = homeSrc.slice(dismissCallIdx, dismissCallIdx + 800);
  assert.match(
    trailing,
    /\}\s*,\s*\[location\.pathname\]\s*\)/,
    'Effect B at [location.pathname] must still reference getDismissedAnchorIds (defense-in-depth)',
  );
});

test('43-14 Test 4: NEGATIVE — concept-feed walker invocation in refillQueue is UNCHANGED', () => {
  // refillQueue still passes engagementService.getDismissedAnchorIds() into
  // postQueueService.walkDerivedList (Phase 39 D-07 — the forward-looking
  // filter for FUTURE refills).
  assert.match(
    feedSrc,
    /const\s+dismissedIds\s*=\s*new\s+Set\s*\(\s*engagementService\.getDismissedAnchorIds\(\)\s*\)/,
    'refillQueue must still build dismissedIds Set from engagementService — walker contract preserved',
  );
  assert.match(
    feedSrc,
    /walkDerivedList\([^)]*dismissedIds[^)]*\)/,
    'refillQueue must still pass dismissedIds to walkDerivedList',
  );
  // And the walker predicate at post-queue.service.ts:389 is unchanged
  assert.match(
    queueSrc,
    /!exploredIds\.has\(id\)\s*&&\s*!dismissedIds\.has\(id\)/,
    'walker dismiss-skip predicate must be unchanged (Phase 39 D-07 contract)',
  );
});

test('43-14 Test 5: COUNTERWEIGHT — concept-feed.service.ts declares applyDismissedFilter and calls it from cache-read sites', () => {
  // Helper exists
  assert.match(
    feedSrc,
    /function\s+applyDismissedFilter\s*\(\s*posts\s*:\s*DailyPost\[\]\s*\)\s*:\s*DailyPost\[\]/,
    'concept-feed.service.ts must declare function applyDismissedFilter(posts: DailyPost[]): DailyPost[]',
  );
  // Helper body uses engagementService.getDismissedAnchorIds and filters sourceQuestionIds[0]
  const helperStart = feedSrc.indexOf('function applyDismissedFilter');
  // Match the helper's body up to the next top-level `\n}` closer.
  const helperEnd = feedSrc.indexOf('\n}', helperStart);
  assert.ok(helperEnd > helperStart, 'applyDismissedFilter body must terminate');
  const helperBody = feedSrc.slice(helperStart, helperEnd);
  assert.match(helperBody, /engagementService\.getDismissedAnchorIds\(\)/);
  assert.match(helperBody, /p\.sourceQuestionIds\??\.\??\[0\]/);

  // getCachedDailyPosts calls it
  const getCachedStart = feedSrc.indexOf('getCachedDailyPosts():');
  assert.ok(getCachedStart > 0, 'getCachedDailyPosts must exist');
  const getCachedEnd = feedSrc.indexOf('  },', getCachedStart);
  const getCachedBody = feedSrc.slice(getCachedStart, getCachedEnd);
  assert.match(
    getCachedBody,
    /applyDismissedFilter\(/,
    'getCachedDailyPosts() must call applyDismissedFilter',
  );

  // getDailyPosts cache-hit branch calls it. Locate the cache-hit guard and
  // assert the helper is called inside it.
  const cacheHitStart = feedSrc.indexOf('cached?.date === date && cached.fingerprint === fingerprint && cached.posts.length > 0');
  assert.ok(cacheHitStart > 0, 'cache-hit branch must exist');
  const cacheHitRegion = feedSrc.slice(cacheHitStart, cacheHitStart + 1000);
  assert.match(
    cacheHitRegion,
    /applyDismissedFilter\(/,
    'getDailyPosts cache-hit branch must call applyDismissedFilter',
  );
});
