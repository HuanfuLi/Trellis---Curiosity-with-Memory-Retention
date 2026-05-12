// Phase 43 Plan 43-15 — source-reading invariants for HomeScreen
// warm-start dedup AND defensive concat dedup AND Phase 36-11 / 36-14 /
// numeric-defaults non-regression.
//
// Asserts:
//   (1) warm-start initializer captures tier + seededIds in warmStartTierRef
//   (2) mount-once useEffect calls removeByIds + seedSeen on yesterday tier
//   (3) [location.pathname] re-sync calls removeByIds + seedSeen in
//       yesterday-queue branch
//   (4) handleLoad concat uses id-based dedup
//   (5) loadCache Phase 36-11 stale-cache rejection PRESERVED
//   (6) Phase 36-14 tier-2 warm-start re-fallback structure PRESERVED
//   (7) Numeric defaults preserved
//   (8) removeByIds + seedSeen exist as service singleton methods
//
// Pattern: readFileSync + regex. No React render, no jsdom. Mirrors
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
const queueSrc = readFileSync(path.join(appRoot, 'src/services/post-queue.service.ts'), 'utf8');
const infScrollSrc = readFileSync(path.join(appRoot, 'src/services/infiniteScroll.service.ts'), 'utf8');
const feedSrc = readFileSync(path.join(appRoot, 'src/services/concept-feed.service.ts'), 'utf8');

test('43-15 Test 1: warm-start initializer captures tier + seededIds in warmStartTierRef', () => {
  // Ref declaration
  assert.match(
    homeSrc,
    /warmStartTierRef\s*=\s*useRef</,
    'warmStartTierRef declaration must exist',
  );
  // The yesterday branch assigns tier: 'yesterday' with seededIds populated
  assert.match(
    homeSrc,
    /tier:\s*['"]yesterday['"]/,
    'yesterday tier discriminator must be set',
  );
  assert.match(
    homeSrc,
    /seededIds:\s*\w+\.map\(p\s*=>\s*p\.id\)/,
    'seededIds must be derived from slice.map(p => p.id) (or similar)',
  );
});

test('43-15 Test 2: mount-once useEffect dispatches on yesterday tier and calls removeByIds + seedSeen', () => {
  // Locate the mount-once useEffect that READS warmStartTierRef.current.
  // The FIRST 3 occurrences are assignments in the useState initializer
  // (cache / yesterday / history tier branches); the read inside the
  // companion useEffect destructures `{ tier, seededIds }`.
  const destructureMatch = homeSrc.match(/const\s*\{\s*tier\s*,\s*seededIds\s*\}\s*=\s*warmStartTierRef\.current\s*;/);
  assert.ok(destructureMatch, 'companion useEffect must destructure { tier, seededIds } from warmStartTierRef.current');
  const refReadIdx = homeSrc.indexOf(destructureMatch[0]);
  assert.ok(refReadIdx > 0, 'destructure site must be found');
  // The reading site should be inside a useEffect with empty deps
  const region = homeSrc.slice(refReadIdx, refReadIdx + 800);
  assert.match(region, /tier\s*===\s*['"]yesterday['"]/, 'must branch on tier === yesterday');
  assert.match(region, /postQueueService\.removeByIds\(/);
  assert.match(region, /infiniteScrollService\.seedSeen\(/);
  // The effect deps array must be empty (mount-once)
  // Search for the closing `}, [])` near the end of the region
  assert.match(region, /\},\s*\[\]\)/);
});

test('43-15 Test 3: [location.pathname] re-sync calls removeByIds + seedSeen in yesterday-queue branch', () => {
  const reSyncStart = homeSrc.indexOf("if (location.pathname !== '/home') return;");
  assert.ok(reSyncStart > 0, '[location.pathname] re-sync must exist');
  const reSyncEnd = homeSrc.indexOf('}, [location.pathname]', reSyncStart);
  const reSyncBody = homeSrc.slice(reSyncStart, reSyncEnd);
  assert.match(reSyncBody, /postQueueService\.getYesterdayQueue\(\)/);
  assert.match(reSyncBody, /postQueueService\.removeByIds\(/);
  assert.match(reSyncBody, /infiniteScrollService\.seedSeen\(/);
});

test('43-15 Test 4: handleLoad concat uses id-based dedup', () => {
  // The setDailyPosts((prev) => {...}) form with new Set(prev.map(p => p.id))
  assert.match(
    homeSrc,
    /setDailyPosts\(\s*\(\s*prev\s*\)\s*=>\s*\{[\s\S]*?new\s+Set\s*\(\s*prev\.map\(/,
    'handleLoad concat must use Set-based id dedup',
  );
  assert.match(
    homeSrc,
    /newPosts\.filter\(\s*p\s*=>\s*!\s*seen\.has\(p\.id\)/,
    'newPosts must be filtered against the prev id Set',
  );
});

test('43-15 Test 5: NEGATIVE — Phase 36-11 stale-cache rejection at loadCache() is unchanged', () => {
  // loadCache returns null when parsed.date !== today() — this is the
  // gate that fires after Force-New-Day (today's cache.date set to
  // yesterday by SettingsDataScreen.handleForceNewDay).
  assert.match(
    feedSrc,
    /if\s*\(\s*parsed\.date\s*!==\s*today\(\)\s*\)\s*\{[\s\S]*?return\s+null/,
    'Phase 36-11 stale-cache rejection in loadCache() must be preserved',
  );
});

test('43-15 Test 6: NEGATIVE — Phase 36-14 tier-2 warm-start re-fallback structure is preserved', () => {
  // The [location.pathname] re-sync effect must still:
  //   1. Read conceptFeedService.getCachedDailyPosts()
  //   2. Fall through to postQueueService.getYesterdayQueue() if cached is empty
  const reSyncStart = homeSrc.indexOf("if (location.pathname !== '/home') return;");
  const reSyncEnd = homeSrc.indexOf('}, [location.pathname]', reSyncStart);
  const reSyncBody = homeSrc.slice(reSyncStart, reSyncEnd);

  const cacheCallIdx = reSyncBody.indexOf('conceptFeedService.getCachedDailyPosts');
  const queueCallIdx = reSyncBody.indexOf('postQueueService.getYesterdayQueue');
  assert.ok(cacheCallIdx > 0, 'getCachedDailyPosts must still be read first');
  assert.ok(queueCallIdx > 0, 'getYesterdayQueue fallback must still be present');
  assert.ok(queueCallIdx > cacheCallIdx, 'queue fallback must come AFTER cache check');
});

test('43-15 Test 7: NEGATIVE — numeric defaults preserved (MAX_QUEUE_SIZE=32, REFILL_THRESHOLD=24, loadNextBatch limit=8)', () => {
  assert.match(queueSrc, /MAX_QUEUE_SIZE\s*=\s*32\b/);
  assert.match(queueSrc, /REFILL_THRESHOLD\s*=\s*24\b/);
  assert.match(infScrollSrc, /loadNextBatch\([^)]*limit\s*=\s*8\b/);
});

test('43-15 Test 8: COUNTERWEIGHT — removeByIds + seedSeen exist as service singleton methods', () => {
  assert.match(queueSrc, /removeByIds\(\s*ids:\s*string\[\]\s*\)\s*:\s*number/);
  assert.match(infScrollSrc, /seedSeen\(\s*ids:\s*string\[\]\s*\)\s*:\s*void/);
});
