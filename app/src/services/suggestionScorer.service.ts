/**
 * Phase 10: Suggestion Scorer Service
 * Deterministic weighted scoring (0.4 performance + 0.3 recency + 0.2 engagement + 0.1 coverage).
 * Cold-start equalization when user has < 5 completed reviews.
 */

import type { TrajectorySignal, ScoredConcept } from '../types/planner';

// ─── Service ──────────────────────────────────────────────────────────────

export const suggestionScorer = {
  /**
   * Score a single concept for suggestion relevance.
   * Returns a value in [0, 100].
   */
  scoreMove(_conceptId: string, _signals: TrajectorySignal): number {
    // Stub — implemented in Task 2
    return 50;
  },

  /**
   * Rank a list of concept IDs by relevance score.
   * Returns top N scored concepts sorted descending.
   * Defaults to top 8 suggestions.
   */
  rankMoves(_conceptIds: string[], _signals: TrajectorySignal, _limit = 8): ScoredConcept[] {
    // Stub — implemented in Task 2
    return [];
  },
};
