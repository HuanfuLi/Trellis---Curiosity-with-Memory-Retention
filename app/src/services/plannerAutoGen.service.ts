/**
 * Phase 10: Planner Auto-Generation Service
 * Orchestrates trigger checking, signal aggregation, scoring, move generation, and persistence.
 * Enforces 24h cooldown to prevent suggestion thrashing.
 */

import type { PlannedMove } from '../types/planner';

// ─── Constants ────────────────────────────────────────────────────────────

const REFRESH_KEY = 'echolearn_suggestions_refresh';
const COOLDOWN_MS = 24 * 3600 * 1000; // 24 hours

// ─── Service ──────────────────────────────────────────────────────────────

export const plannerAutoGen = {
  /**
   * Check if auto-generation should run.
   * Conditions: 5+ questions AND empty planner AND 24h+ since last refresh.
   */
  shouldAutoGenerate(): boolean {
    // Stub — implemented in Task 4
    return false;
  },

  /**
   * Orchestrate full suggestion generation flow:
   * aggregate signals → score → generate moves → clear old → store new → emit event.
   * Returns empty array if shouldAutoGenerate() is false or on error.
   */
  async generateAndStoreSuggestions(): Promise<PlannedMove[]> {
    // Stub — implemented in Task 4
    return [];
  },

  /**
   * Return currently stored auto-generated suggestions from the planner.
   * Used by UI to render suggestions without triggering generation.
   */
  getCachedSuggestions(): PlannedMove[] {
    // Stub — implemented in Task 4
    return [];
  },

  /**
   * Remove all auto-generated suggestions from the planner.
   * Used for manual refresh reset or testing.
   */
  clearSuggestions(): void {
    // Stub — implemented in Task 4
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch { /* ignore */ }
  },

  /** Internal: get last refresh timestamp from localStorage. */
  _getLastRefresh(): number {
    try {
      const raw = localStorage.getItem(REFRESH_KEY);
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  },

  /** Internal: update last refresh timestamp. */
  _setLastRefresh(timestamp: number): void {
    try {
      localStorage.setItem(REFRESH_KEY, timestamp.toString());
    } catch { /* ignore */ }
  },

  /** Exposed cooldown constant for testing. */
  _cooldownMs: COOLDOWN_MS,
};
