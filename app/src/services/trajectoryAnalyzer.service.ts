/**
 * Phase 10: Trajectory Analyzer Service
 * Aggregates learning signals from review/question/engagement data.
 * Signals are cached for 6 hours to avoid expensive recalculation.
 */

import type { TrajectorySignal } from '../types/planner';

// ─── Cache types ──────────────────────────────────────────────────────────

interface TrajectoryCache {
  signal: TrajectorySignal;
  timestamp: number;
}

// ─── Service ──────────────────────────────────────────────────────────────

export const trajectoryAnalyzer = {
  _cacheKey: 'echolearn_trajectory_signals',
  _cacheTTL: 6 * 3600 * 1000, // 6 hours in milliseconds

  /**
   * Aggregate learning signals from all data sources.
   * Returns cached signals if within TTL, otherwise recalculates.
   */
  aggregateSignals(): TrajectorySignal {
    // Stub — implemented in Task 1
    const cached = this._getCache();
    if (cached) return cached;

    const signal: TrajectorySignal = {
      reviewPerformance: 50,
      questionFrequency: 0,
      timeSinceLastReview: 30 * 86400000,
      feedEngagement: 0,
      conceptCoverage: 0,
      weakAreas: [],
      completedReviews: 0,
    };

    this._setCache(signal);
    return signal;
  },

  /** Retrieve cached signals if still within TTL. Returns null if stale or missing. */
  _getCache(): TrajectorySignal | null {
    try {
      const raw = localStorage.getItem(this._cacheKey);
      if (!raw) return null;
      const cached = JSON.parse(raw) as TrajectoryCache;
      if (Date.now() - cached.timestamp > this._cacheTTL) return null;
      return cached.signal;
    } catch {
      return null;
    }
  },

  /** Store signals with current timestamp. */
  _setCache(signal: TrajectorySignal): void {
    try {
      const entry: TrajectoryCache = { signal, timestamp: Date.now() };
      localStorage.setItem(this._cacheKey, JSON.stringify(entry));
    } catch { /* ignore storage errors */ }
  },

  /** Invalidate the signal cache (forces recalculation on next call). */
  invalidateCache(): void {
    try {
      localStorage.removeItem(this._cacheKey);
    } catch { /* ignore */ }
  },

  /** Placeholder for feed engagement tracking. Returns 0 until event system is extended. */
  _getFeedEngagement(): number {
    // Future: count POST_VIEWED events in last 7 days from eventBus history
    return 0;
  },
};
