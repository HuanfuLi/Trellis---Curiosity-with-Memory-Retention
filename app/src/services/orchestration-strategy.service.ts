/**
 * Orchestration Strategy Service
 *
 * Pure-function interface that translates TrajectorySignal (+ optional
 * CheckInSignals) into StrategyHints consumed by downstream services.
 * Per D-01: light orchestration — no central controller, just a strategy
 * that services pull from independently.
 */

import type { TrajectorySignal, CheckInSignals } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LearningMode = 'retrieval' | 'discovery' | 'reinforcement' | 'balanced';

export interface StrategyHints {
  mode: LearningMode;
  weakAreaBias: number;
  discoveryWeight: number;
  priorityConceptIds: string[];
  curiosityTopics: string[];
}

export interface OrchestrationStrategy {
  computeHints(signals: TrajectorySignal, checkInSignals?: CheckInSignals): StrategyHints;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// ── Default Strategy ──────────────────────────────────────────────────────────

export const defaultStrategy: OrchestrationStrategy = {
  computeHints(signals: TrajectorySignal, checkInSignals?: CheckInSignals): StrategyHints {
    const priorityConceptIds = [...signals.weakAreas];
    const curiosityTopics = checkInSignals?.curiosity ?? [];

    // Retrieval: too many weak areas or poor review performance
    if (signals.weakAreas.length > 3 || signals.reviewPerformance < 40) {
      return {
        mode: 'retrieval',
        weakAreaBias: 0.7,
        discoveryWeight: 0.3,
        priorityConceptIds,
        curiosityTopics,
      };
    }

    // Discovery: high coverage and active engagement
    if (signals.conceptCoverage > 70 && signals.feedEngagement > 10) {
      return {
        mode: 'discovery',
        weakAreaBias: 0.3,
        discoveryWeight: 0.6,
        priorityConceptIds,
        curiosityTopics,
      };
    }

    // Reinforcement: long gap since last review
    if (signals.timeSinceLastReview > THREE_DAYS_MS) {
      return {
        mode: 'reinforcement',
        weakAreaBias: 0.5,
        discoveryWeight: 0.3,
        priorityConceptIds,
        curiosityTopics,
      };
    }

    // Balanced: default fallback
    return {
      mode: 'balanced',
      weakAreaBias: 0.5,
      discoveryWeight: 0.5,
      priorityConceptIds,
      curiosityTopics,
    };
  },
};
