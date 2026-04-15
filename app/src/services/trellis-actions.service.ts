// Trellis node action service: encapsulates heal, re-plant, prune, unprune,
// and hard-delete logic for dying/dead/pruned anchors (D-11 through D-18).
//
// Heal (D-11, D-12):   dying node → add to today's podcast + navigate to review filtered to anchor's Q&As
// Re-plant (D-13, D-14): dead node → reset flashcard schedules + reset question schedules + generate post + navigate to review
// Prune (D-15, D-17):  dying/dead → soft-delete via flagged=true + emit ANCHOR_DELETED so trellis removes it
// Unprune:             restore pruned node → flagged=false + emit CLASSIFICATION_COMPLETED so trellis recomputes
// Hard-delete:         permanent removal via questionService.delete (already emits QUESTION_DELETED)
//
// Returns navigation intents rather than invoking navigate() directly — caller owns routing.

import type { Question, ReviewSchedule } from '../types';
import { flashcardService } from './flashcard.service';
import { podcastService } from './podcast.service';
import { questionService } from './question.service';
import { conceptFeedService } from './concept-feed.service';
import { eventBus } from '../lib/event-bus';
import { today } from '../lib/date';

export interface AnchorReviewNavState {
  anchorReview: {
    anchorId: string;
    qaIds: string[];
    title: string;
  };
}

export interface ActionNavigationResult {
  navigateTo: string;
  state: AnchorReviewNavState;
}

function freshSchedule(): ReviewSchedule {
  return { nextReviewDate: today(), reviewCount: 0, easeFactor: 2.5 };
}

export const trellisActionsService = {
  /**
   * D-11/D-12: Heal a dying anchor. Adds the anchor to today's podcast (non-fatal
   * if no podcast exists) and returns navigation state so the caller can route
   * to /review filtered to the anchor's Q&A children.
   */
  heal(anchorId: string, anchorName: string, qaChildIds: string[]): ActionNavigationResult {
    // Fire-and-forget podcast queue add — non-fatal if it returns false
    try {
      podcastService.addConceptToPodcast(today(), anchorId);
    } catch {
      /* swallow — podcast add failures are non-fatal */
    }

    return {
      navigateTo: '/review',
      state: {
        anchorReview: {
          anchorId,
          qaIds: qaChildIds,
          title: anchorName,
        },
      },
    };
  },

  /**
   * D-13/D-14: Re-plant a dead anchor. Resets SM-2 schedule on ALL flashcards
   * linked to this anchor (per RESEARCH Pitfall 2 — computeLeafState reads fcMap
   * as authoritative), resets the anchor's question schedule and each Q&A child's
   * schedule, and generates a new post for the anchor topic. Does NOT create new
   * flashcards (D-13) — uses existing ones. Returns review navigation state.
   */
  async replant(
    anchorId: string,
    anchorQuestion: Question,
    qaChildIds: string[],
  ): Promise<ActionNavigationResult> {
    // 1. Reset flashcards linked to this anchor (or any of its Q&A children)
    const linkedFlashcards = flashcardService.getAll().filter((c) => {
      const nid = c.nodeId ?? '';
      return c.nodeId === anchorId || qaChildIds.includes(nid);
    });
    for (const card of linkedFlashcards) {
      flashcardService.updateReviewSchedule(card.id, freshSchedule());
    }

    // 2. Reset anchor question schedule (clear lastReviewedAt so leaf state recomputes)
    questionService.patchQuestion(anchorId, {
      reviewSchedule: freshSchedule(),
      lastReviewedAt: undefined,
    });

    // 3. Reset each Q&A child question schedule as well
    for (const qaId of qaChildIds) {
      questionService.patchQuestion(qaId, {
        reviewSchedule: freshSchedule(),
        lastReviewedAt: undefined,
      });
    }

    // 4. Generate a post for the anchor topic — await so caller knows it landed
    try {
      await conceptFeedService.generateMorePosts([anchorQuestion]);
    } catch {
      /* non-fatal — navigation still proceeds */
    }

    const title = anchorQuestion.title ?? anchorQuestion.content ?? 'anchor';
    return {
      navigateTo: '/review',
      state: {
        anchorReview: {
          anchorId,
          qaIds: qaChildIds,
          title,
        },
      },
    };
  },

  /**
   * D-15/D-17: Prune (archive) an anchor. Flips flagged=true so getPrunedQuestions
   * surfaces it, and emits ANCHOR_DELETED so the trellis removes it from rendering
   * (per RESEARCH Open Question 4 — same visual effect as deletion, but reversible).
   */
  prune(anchorId: string): { pruned: true } {
    questionService.patchQuestion(anchorId, { flagged: true, prunedFromTrellis: true });
    eventBus.emit({ type: 'ANCHOR_DELETED', payload: { anchorId } });
    return { pruned: true };
  },

  /**
   * Restore a pruned anchor back to the trellis. Flips flagged=false and emits
   * CLASSIFICATION_COMPLETED to trigger useTrellisData recompute (pattern reuse —
   * the payload's anchorName is cosmetic for the trellis recompute subscriber).
   */
  unpruneQuestion(anchorId: string): void {
    questionService.patchQuestion(anchorId, { flagged: false, prunedFromTrellis: false });
    eventBus.emit({
      type: 'CLASSIFICATION_COMPLETED',
      payload: { anchorId, anchorName: '' },
    });
  },

  /**
   * Permanently remove a pruned anchor. questionService.delete already emits
   * QUESTION_DELETED so downstream subscribers handle cleanup.
   */
  async hardDelete(anchorId: string): Promise<void> {
    await questionService.delete(anchorId);
  },
};
