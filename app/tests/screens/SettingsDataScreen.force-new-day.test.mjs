// Phase 36 GAP-D Fix B regression guard: ensures SettingsDataScreen.tsx exposes
// the dev-only "Force new day" affordance, gated behind import.meta.env.DEV,
// and that the handler wires up the three required moving parts:
//   (1) postQueueService.loadQueue() reload after mutating localStorage
//   (2) navigate('/home') so the cold-start warm-start path runs on next mount
//   (3) the import.meta.env.DEV gate so production builds tree-shake it away
//
// Source-reading test (no React render harness needed) — same pattern as
// HomeScreen.warm-start-guard.test.mjs and ChatInput.flex-shrink.test.mjs.
//
// See .planning/debug/cold-start-warm-start-fragile.md for the full rationale:
// without this dev affordance, every retest of GAP-A / GAP-D fixes requires
// waiting for an actual midnight rollover, which is not a workable dev loop.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = resolve(__dirname, '../../src/screens/settings/SettingsDataScreen.tsx');
const source = readFileSync(SETTINGS_PATH, 'utf-8');

describe('SettingsDataScreen force-new-day dev affordance (Phase 36 GAP-D Fix B)', () => {
  it('gates the affordance behind import.meta.env.DEV so production builds tree-shake it', () => {
    assert.ok(
      source.includes('import.meta.env.DEV &&'),
      'SettingsDataScreen.tsx must wrap the Force-new-day SettingRow in `{import.meta.env.DEV && (...)}` — Vite tree-shakes the dead branch in production builds, ensuring this dev tool never ships to end users. See CLAUDE.md i18n workflow exemption rationale.',
    );
  });

  it('declares the handleForceNewDay handler', () => {
    assert.ok(
      source.includes('const handleForceNewDay'),
      'SettingsDataScreen.tsx must declare a `const handleForceNewDay` handler (alongside other handlers like handleClearAllData). The handler is the entry point the gated SettingRow button calls onClick.',
    );
  });

  it('handler calls postQueueService.loadQueue() to reload in-memory queue state', () => {
    // Region check: the loadQueue() call must appear inside the handler body,
    // not somewhere else in the file. Match handler open through its closing brace.
    assert.match(
      source,
      /handleForceNewDay[\s\S]*?postQueueService\.loadQueue\(\)[\s\S]*?\}/,
      'handleForceNewDay must call `postQueueService.loadQueue()` after mutating localStorage so the in-memory _state reloads from the now-stale payload. Without this, the next /home mount reads localStorage but the in-memory snapshot still holds today-state and the cold-start path never engages. See .planning/debug/cold-start-warm-start-fragile.md.',
    );
  });

  it('handler navigates to /home so the cold-start warm-start path runs', () => {
    assert.match(
      source,
      /handleForceNewDay[\s\S]*?navigate\(['"]\/home['"]\)[\s\S]*?\}/,
      'handleForceNewDay must call `navigate(\'/home\')` after mutating localStorage and reloading the queue. Without this, the user stays on the Settings screen and the cold-start path never runs — defeating the whole point of the affordance.',
    );
  });

  it('handler resets daily-read state so vine progress chip clears on Force New Day', () => {
    // On a real midnight, dailyReadService.loadState() self-resets via the
    // parsed.date !== today() check. The dev button cannot advance today(),
    // so it must explicitly call dailyReadService.reset() to mimic the
    // natural midnight reset — otherwise the vine progress chip on /home
    // shows yesterday's exploration count after the rollover. See round-3
    // sub-issue (a).
    assert.match(
      source,
      /handleForceNewDay[\s\S]*?dailyReadService\.reset\(\)[\s\S]*?\}/,
      'handleForceNewDay must call `dailyReadService.reset()` after mutating localStorage so the vine progress chip clears. Without this the chip shows yesterday\'s exploration count after the rollover.',
    );
  });

  it('handler mutates echolearn_daily_posts.date so loadCache rejection fires symmetrically with queue rehydration', () => {
    // Phase 36-15 inverts the negative regression assertion that Plan 36-13
    // added (and that round-4 UAT proved wrong). Plan 36-11's loadCache
    // date-rejection only fires on REAL midnight (where today() advances).
    // The dev button cannot advance the wall clock, so today() returns the
    // SAME value before and after this handler runs. If echolearn_daily_posts
    // is left untouched, its stored .date still equals today(), loadCache()
    // returns truthy, getDailyPosts() hits its cache-hit branch and returns
    // yesterday's served posts — the rehydrated _state.posts from
    // post-queue.service.ts (Plan 36-11) is never reached.
    //
    // Mirror the wall-clock-asymmetry pattern that the dailyReadService.reset()
    // call already establishes: services that gate self-reset on today()
    // comparisons cannot fire when the dev button doesn't (and shouldn't)
    // advance the clock — so the handler must explicitly mutate every
    // date-stamped cache key that natural midnight rollover would have
    // tripped. echolearn_post_queue and echolearn_daily_posts are SYMMETRIC,
    // not redundant.
    //
    // The runtime consequence (feed auto-populating from yesterday's queue
    // when getCachedDailyPosts returns []) is owned by Plan 36-14's
    // warm-start re-fallback effect in HomeScreen.tsx — see
    // tests/screens/HomeScreen.warm-start-refallback.test.mjs.
    //
    // DO NOT FLIP THIS BACK to assert.doesNotMatch. The "redundant dual-cache
    // hack" framing in Plan 36-13 was incorrect; round-4 UAT regressed
    // sub-issue (b) because of it. See .planning/debug/feed-not-auto-
    // populating-after-force-new-day.md and 36-15-SUMMARY.md.
    const start = source.indexOf('const handleForceNewDay');
    const next = source.indexOf('const refreshTokenUsage');
    assert.ok(
      start !== -1 && next !== -1 && next > start,
      'Could not locate handleForceNewDay anchor pair (handleForceNewDay → refreshTokenUsage)',
    );
    const handlerBody = source.slice(start, next);
    assert.match(
      handlerBody,
      /localStorage\.setItem\(['"]echolearn_daily_posts['"]/,
      'handleForceNewDay must call localStorage.setItem(\'echolearn_daily_posts\', ...) to mutate the served-posts cache date to yesterday. Without this, loadCache()\'s parsed.date !== today() rejection (Plan 36-11) does not fire under the dev button (today() does not advance), and getDailyPosts() returns yesterday\'s served posts instead of dequeueing the rehydrated _state.posts. See round-4 sub-issue (b).',
    );
  });
});
