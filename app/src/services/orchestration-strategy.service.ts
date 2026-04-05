/**
 * Orchestration Strategy Service
 *
 * Translates TrajectorySignal into StrategyHints for downstream services.
 * Per D-01: light orchestration — pure-function interface, no central controller.
 */

import type { TrajectorySignal, CheckInSignals } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────

export type LearningMode = 'retrieval' | 'discovery' | 'reinforcement' | 'balanced';

export interface StrategyHints {
  mode: LearningMode;
  weakAreaBias: number;        // 0-1
  discoveryWeight: number;     // 0-1
  priorityConceptIds: string[];
  curiosityTopics: string[];
}

export interface OrchestrationStrategy {
  computeHints(signals: TrajectorySignal, checkInSignals?: CheckInSignals): StrategyHints;
}

// ── Thresholds ────────────────────────────────────────────────────────────

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// ── Default Strategy Implementation ───────────────────────────────────────

export const defaultStrategy: OrchestrationStrategy = {
  computeHints(signals: TrajectorySignal, checkInSignals?: CheckInSignals): StrategyHints {
    const priorityConceptIds = [...signals.weakAreas];
    const curiosityTopics = checkInSignals?.curiosity ?? [];

    // Determine learning mode based on signal thresholds
    if (signals.weakAreas.length > 3 || signals.reviewPerformance < 40) {
      return {
        mode: 'retrieval',
        weakAreaBias: 0.7,
        discoveryWeight: 0.3,
        priorityConceptIds,
        curiosityTopics,
      };
    }

    if (signals.conceptCoverage > 70 && signals.feedEngagement > 10) {
      return {
        mode: 'discovery',
        weakAreaBias: 0.3,
        discoveryWeight: 0.6,
        priorityConceptIds,
        curiosityTopics,
      };
    }

    if (signals.timeSinceLastReview > THREE_DAYS_MS) {
      return {
        mode: 'reinforcement',
        weakAreaBias: 0.5,
        discoveryWeight: 0.3,
        priorityConceptIds,
        curiosityTopics,
      };
    }

    return {
      mode: 'balanced',
      weakAreaBias: 0.5,
      discoveryWeight: 0.5,
      priorityConceptIds,
      curiosityTopics,
    };
  },
};
