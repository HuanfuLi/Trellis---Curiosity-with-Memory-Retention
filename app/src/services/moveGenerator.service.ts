/**
 * Phase 10: Move Generator Service
 * Converts scored concepts to PlannedMove objects with appropriate move types and linked resources.
 */

import type { TrajectorySignal, PlannedMove } from '../types/planner';

// ─── Service ──────────────────────────────────────────────────────────────

export const moveGenerator = {
  /**
   * Generate PlannedMove objects from a list of scored concept IDs.
   * Each move has a type, goal, linked resource, and relevance score.
   */
  generateMoves(_conceptIds: string[], _signals: TrajectorySignal): PlannedMove[] {
    // Stub — implemented in Task 3
    return [];
  },

  /** Return emoji icon for a move type. */
  _getMoveIcon(moveType: string): string {
    // Stub — implemented in Task 3
    const icons: Record<string, string> = {
      review: '📚',
      deepdive: '🔗',
      connection: '🎯',
      podcast: '🎙️',
    };
    return icons[moveType] ?? '📝';
  },

  /** Find the flashcard ID for a given concept ID. Returns null if not found. */
  _findReviewCardFor(_conceptId: string): string | null {
    // Stub — implemented in Task 3
    return null;
  },

  /** Find a related post ID for a given concept ID via conceptFeedService. Returns null if not found. */
  _findRelatedPost(_conceptId: string): string | null {
    // Stub — implemented in Task 3
    return null;
  },
};
