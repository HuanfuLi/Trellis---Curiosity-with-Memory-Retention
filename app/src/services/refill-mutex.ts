// Promise-based mutex helper (Phase 36-12 leaf extraction).
//
// This is a LEAF module: it has zero transitive deps on settings.service /
// llm-provider / locales bundles, so node --test can import it directly
// without hitting Node ESM's ERR_IMPORT_ATTRIBUTE_MISSING on en.json.
// (concept-feed.service.ts re-uses this helper so the runtime mutex path
// shares its semantics — this file gives tests a clean import surface.)
//
// See CLAUDE.md i18n section "Phase 27 locale tests avoid the JSON-import-
// attribute failure chain by importing i18next directly; follow the same
// pattern for any new pure-logic helpers."
//
// ─── Why a Promise mutex (not a boolean) ──────────────────────────────────
//
// The previous boolean mutex (`_queueRefillRunning`) made `await refillQueue()`
// callers in generateMorePosts silently no-op when a refill was already in
// flight. The bailing caller resolved with `undefined` immediately, then
// dequeued from an unchanged (still-empty) queue, then returned []. The user
// saw an empty swipe; only the SECOND swipe (after the original bg refill
// flipped the flag back) actually triggered a fresh refill.
//
// A Promise reference lets in-flight callers AWAIT the same Promise, see it
// resolve, then dequeue from the now-populated queue. Single body per cycle
// preserved.
//
// See .planning/phases/36-.../36-UAT.md round-3 sub-issue (e).

/**
 * A Promise-based mutex. Returns a `run(fn)` function that:
 *   1. If a body is in-flight: returns the same Promise (no-op fn).
 *   2. Else: invokes fn(), captures its Promise, returns it.
 *   3. In BOTH success and error paths, clears the in-flight reference in
 *      finally so a failed body does not permanently lock subsequent callers.
 *
 * The returned `getInFlight()` is for tests/diagnostics only.
 */
export interface PromiseMutex {
  /**
   * Run fn() under the mutex. If a body is already in flight, return the
   * existing Promise without invoking fn (the body is shared).
   */
  run: (fn: () => Promise<void>) => Promise<void>;
  /** Test/diagnostic: returns the current in-flight Promise (or null). */
  getInFlight: () => Promise<void> | null;
}

export function createPromiseMutex(): PromiseMutex {
  let inFlight: Promise<void> | null = null;
  return {
    run(fn) {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        try {
          await fn();
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    },
    getInFlight() {
      return inFlight;
    },
  };
}
