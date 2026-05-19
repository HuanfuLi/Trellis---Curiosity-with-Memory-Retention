// Trellis node action service: encapsulates heal, re-plant, prune, unprune,
// and hard-delete logic for dying/dead/pruned anchors (D-11 through D-18).
//
// Heal (D-11, D-12):   dying node → add to today's podcast + navigate to review filtered to anchor's Q&As
// Re-plant (D-13, D-14): dead node → reset flashcard schedules + reset question schedules + generate post + navigate to review
// Prune (D-15, D-17):  dying/dead → soft-delete via flagged=true + emit ANCHOR_DELETED so trellis removes it
// Unprune:             restore pruned node → flagged=false + emit GRAPH_UPDATED so trellis recomputes
// Hard-delete:         permanent removal via questionService.delete (already emits QUESTION_DELETED)
//
// Returns navigation intents rather than invoking navigate() directly — caller owns routing.

import type { Question, ReviewSchedule } from '../types';
import { podcastService } from './podcast.service';
import { questionService } from './question.service';
import { eventBus } from '../lib/event-bus';
import { today, addDays } from '../lib/date';

export interface AnchorReviewNavState {
  anchorReview: {
    anchorId: string;
    qaIds: string[];
    title: string;
  };
}

export interface DiscoverPostNavState {
  discoverMeta: {
    concept: string;
    title: string;
  };
}

export interface ActionNavigationResult {
  navigateTo: string;
  state: AnchorReviewNavState | DiscoverPostNavState;
}

// Bump a schedule to the "dying" zone (1 day overdue → yellow per computeLeafState).
// Preserves reviewCount >= 1 so the node isn't treated as an unreviewed "bud".
function dyingSchedule(prev?: ReviewSchedule): ReviewSchedule {
  return {
    nextReviewDate: addDays(today(), -1),
    reviewCount: Math.max(1, prev?.reviewCount ?? 0),
    easeFactor: prev?.easeFactor ?? 2.5,
  };
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
   * D-13/D-14 (simplified): Re-plant a dead anchor by re-exposing the user to a
   * freshly generated post (reusing AnchorDetailScreen's "Learn as Post" flow —
   * navigates to `/posts/anchor-post-{id}` with discoverMeta; PostDetailScreen
   * streams the essay on mount).
   *
   * The anchor + its children are bumped to "dying" (1 day overdue, reviewCount
   * preserved >= 1) so leaf state becomes yellow — the user must still complete
   * a real review cycle to graduate the node back to green. Flashcards are
   * intentionally NOT reset; their own schedules age naturally.
   *
   * Returns synchronously — no post-generation await. PostDetailScreen owns
   * the streaming UX.
   */
  replant(
    anchorId: string,
    anchorQuestion: Question,
    qaChildIds: string[],
  ): ActionNavigationResult {
    questionService.patchQuestion(anchorId, {
      reviewSchedule: dyingSchedule(anchorQuestion.reviewSchedule),
    });

    const all = questionService.getAll({ includeFlagged: true });
    for (const qaId of qaChildIds) {
      const qa = all.find((q) => q.id === qaId);
      questionService.patchQuestion(qaId, {
        reviewSchedule: dyingSchedule(qa?.reviewSchedule),
      });
    }

    // Emit so useTrellisData recomputes — the dead anchor immediately demotes
    // to dying and the Suggested Moves list refreshes.
    eventBus.emit({ type: 'GRAPH_UPDATED' });

    const title = anchorQuestion.title ?? anchorQuestion.content ?? 'anchor';
    return {
      navigateTo: `/posts/anchor-post-${anchorId}`,
      state: {
        discoverMeta: {
          concept: title,
          title: `Understanding ${title}: A Complete Guide`,
        },
      },
    };
  },

  /**
   * D-15/D-17: Prune (archive) an anchor AND its Q&A leaves. Flips flagged=true
   * + prunedFromTrellis=true on the anchor so getPrunedQuestions surfaces it,
   * AND on each of its un-flagged QA children so the 4-layer hierarchy stays
   * intact (Knowledge → Branch → Cluster → Anchor → QAs). Without the
   * cascade, leaf QAs whose parent is flagged still render — UAT 2026-05-19
   * surfaced this as "promoting leaves to anchors". Emits ANCHOR_DELETED so
   * the trellis removes the anchor from rendering (RESEARCH Open Question 4).
   *
   * Returns the list of QA IDs that were cascaded so the caller's journal
   * (graphCommandService.prune) can record EXACTLY which children were
   * flagged — undo via unpruneQuestion(id, { cascadedQaIds }) restores
   * precisely without touching QAs that were already flagged for unrelated
   * reasons (e.g. off-topic ingest).
   */
  prune(anchorId: string): { pruned: true; cascadedQaIds: string[] } {
    const store = questionService.getAll({ includeFlagged: true });
    const cascadedQaIds: string[] = [];
    for (const q of store) {
      if (q.parentId !== anchorId) continue;
      if (q.flagged === true) continue;
      questionService.patchQuestion(q.id, { flagged: true, prunedFromTrellis: true });
      cascadedQaIds.push(q.id);
    }
    questionService.patchQuestion(anchorId, { flagged: true, prunedFromTrellis: true });
    eventBus.emit({ type: 'ANCHOR_DELETED', payload: { anchorId } });
    return { pruned: true, cascadedQaIds };
  },

  /**
   * Restore a pruned anchor back to the trellis along with its QA leaves.
   * Symmetric counterpart to prune.
   *
   * - If `opts.cascadedQaIds` is provided (graphCommandService.undo path),
   *   un-flag PRECISELY those IDs. This avoids accidentally un-flagging a
   *   QA that was already flagged before the prune ran.
   * - Otherwise (PrunedSection unprune button), blanket-cascade: un-flag
   *   every QA with parentId === anchorId AND prunedFromTrellis === true.
   *   The `prunedFromTrellis === true` filter keeps off-topic-flagged
   *   QAs (flagged=true but prunedFromTrellis=false) untouched.
   *
   * Single GRAPH_UPDATED emit per unprune command (R7 / D-17).
   */
  unpruneQuestion(anchorId: string, opts?: { cascadedQaIds?: string[] }): void {
    if (opts?.cascadedQaIds && opts.cascadedQaIds.length > 0) {
      for (const id of opts.cascadedQaIds) {
        questionService.patchQuestion(id, { flagged: false, prunedFromTrellis: false });
      }
    } else {
      const store = questionService.getAll({ includeFlagged: true });
      for (const q of store) {
        if (q.parentId !== anchorId) continue;
        if (q.flagged !== true || q.prunedFromTrellis !== true) continue;
        questionService.patchQuestion(q.id, { flagged: false, prunedFromTrellis: false });
      }
    }
    questionService.patchQuestion(anchorId, { flagged: false, prunedFromTrellis: false });
    eventBus.emit({ type: 'GRAPH_UPDATED' });
  },

  /**
   * Permanently remove a pruned anchor. questionService.delete already emits
   * QUESTION_DELETED so downstream subscribers handle cleanup.
   */
  async hardDelete(anchorId: string): Promise<void> {
    await questionService.delete(anchorId);
  },
};
