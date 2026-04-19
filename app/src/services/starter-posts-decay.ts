// Starter post persistence + decay helpers (Phase 32.1-04 / G4 / STARTER-PERSIST).
//
// Per CONTEXT D-11: starter posts (defined in concept-feed.service.ts:54-79) must persist
// to the daily cache on first cold-start so subsequent /home revisits read them from cache
// (the empty-state path at line 1030 is no longer reliably reached once any state mutates).
//
// Per CONTEXT D-12: once the user has 3+ organic (non-starter) posts in cache, the cold-start
// fallback is no longer needed and starters should be filtered out on the next cache load.
//
// Threshold: cached.posts.filter(p => !STARTER_POST_IDS.has(p.id)).length >= 3 → drop starters.
//
// Extracted into a separate pure-helper module so contract tests can import it without
// pulling in the i18next JSON-import-attribute chain (graph.service → planner.service →
// locales/en.json) that blocks importing concept-feed.service.ts under plain `node --test`.
// Same pattern as concept-feed-dedup.ts (Phase 32.1-02).

/** All known starter post IDs (kept in lockstep with STARTER_POSTS in concept-feed.service.ts:54-79). */
export const STARTER_POST_IDS = new Set<string>([
  'starter-welcome',
  'starter-knowledge-growth',
  'starter-daily-feed',
]);

export function isStarterPostId(id: string): boolean {
  return STARTER_POST_IDS.has(id);
}

/**
 * Returns true when the cache contains 3+ organic (non-starter) posts and starters
 * should be filtered out on the next cache load.
 */
export function shouldDecayStarters(posts: Array<{ id: string }>): boolean {
  const organicCount = posts.filter(p => !STARTER_POST_IDS.has(p.id)).length;
  return organicCount >= 3;
}

/** Convenience: returns posts with starters filtered out IFF shouldDecayStarters is true. */
export function filterDecayedStarters<T extends { id: string }>(posts: T[]): T[] {
  if (!shouldDecayStarters(posts)) return posts;
  return posts.filter(p => !STARTER_POST_IDS.has(p.id));
}
