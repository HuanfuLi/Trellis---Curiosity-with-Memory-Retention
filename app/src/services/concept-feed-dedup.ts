// Cross-cycle YouTube videoId dedup helper (Phase 32.1-02 / UAT-31-2 fix).
// Promotes the per-call seenVideoIds Set (originally added in Phase 31-08 inside
// generatePostBatch at concept-feed.service.ts:685) to module scope so duplicates
// are blocked across multiple refillQueue invocations within a session.
//
// Module scope (not localStorage) was chosen per CONTEXT D-02: simpler, and a fresh
// browser session is allowed to re-show videos that were rate-limited the prior day.
// Reset semantics:
//   - Cleared on page reload (natural module re-init).
//   - Cleared on day boundary (maybeResetForNewDay() — mirrors postQueueService.resetForNewDay).
//
// This module has zero transitive deps on i18n / locales bundles, so it can be
// imported directly from `node --test` without the JSON-import-attribute chain.

let _seenVideoIds = new Set<string>();
let _trackedDay: string = currentDay();

// Inline today() to avoid i18next dependency chain from lib/date.ts
// (mirrors post-queue.service.ts:18-25 pattern).
function currentDay(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * If the day has rolled over since we started tracking, clear the dedup set.
 * Without this, yesterday's videoIds would block today's generation forever.
 * Called implicitly from hasSeenVideoId / addSeenVideoId so consumers don't
 * need to remember to call it.
 */
function maybeResetForNewDay(): void {
  const today = currentDay();
  if (today !== _trackedDay) {
    _seenVideoIds = new Set<string>();
    _trackedDay = today;
  }
}

export function hasSeenVideoId(videoId: string): boolean {
  maybeResetForNewDay();
  return _seenVideoIds.has(videoId);
}

export function addSeenVideoId(videoId: string): void {
  maybeResetForNewDay();
  _seenVideoIds.add(videoId);
}

/** Test-only reset. Do NOT call from production code. */
export function __resetSeenVideoIdsForTesting(): void {
  _seenVideoIds = new Set<string>();
  _trackedDay = currentDay();
}
