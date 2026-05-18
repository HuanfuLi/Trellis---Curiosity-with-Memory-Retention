// Phase 48-02 — Graph Command Service
//
// The single boundary for manual graph corrections (rename, move, merge,
// detach, prune, delete, undo). Every command:
//
//   1. Reads fresh from questionService.getAll() inside the body
//      (Pattern 1 / R10 risk 1 — no held snapshots across the mutex).
//   2. Patches via questionService.patchQuestion / .delete — the SINGLE
//      write path (R1, T-48-05). No direct localStorage.setItem.
//   3. On success: writes EXACTLY ONE GraphEditLogEntry via
//      graphEditJournal.append.
//   4. On success: emits EXACTLY ONE typed GRAPH_UPDATED with
//      payload.kind matching the verb (D-17). delete + merge produce an
//      ADDITIONAL untyped emit from questionService.delete; subscribers
//      are idempotent per CLAUDE.md §"Event bus — unified GRAPH_UPDATED".
//   5. On failure / no-op: ZERO journal writes, ZERO command-boundary
//      emits.
//
// Plan 48-02 ships rename + move + delete fully implemented. merge,
// detach, prune, undo are stubs returning NOT_IMPLEMENTED — Plans 48-03
// + 48-04 fill them in. Stubs land here so the file structure is locked
// before Wave 3 starts (no concurrent file-structure edits).
//
// Mutex (R10 risk 9): a single shared createPromiseMutex serializes
// commands at the service boundary. Two concurrent rename calls on the
// same id will run sequentially — the second one observes the first's
// mutation via the read-fresh discipline inside the body.

import type { Question, ServiceResult } from '../types/index.ts';
import { questionService } from './question.service.ts';
import { graphEditJournal } from './graph-edit-journal.service.ts';
import { eventBus } from '../lib/event-bus.ts';
import { settingsService } from './settings.service.ts';
import { embedText } from '../providers/embedding/index.ts';
import { createPromiseMutex } from './refill-mutex.ts';

// ─── Error codes ─────────────────────────────────────────────────────────
// String literals — Plans 03/04 tests + Phase 49 UI dispatch on these.

export type GraphCommandErrorCode =
  | 'VALIDATION_ERROR'   // empty title, length cap, same-source/target merge, cycle, no-op rename guarded earlier
  | 'NOT_FOUND'          // target id not in store
  | 'STORAGE_ERROR'      // questionService.delete returned { success: false }
  | 'NOT_IMPLEMENTED';   // Plans 03/04 stubs

// D-16 — rename hard validation (operator-trust; LLM-name normalizer bypassed).
const MAX_TITLE_LENGTH = 100;

// Shared per-process mutex (R10 risk 9). Wraps every public-method body so
// commands serialize at the boundary. Mirror of refill-mutex pattern.
const _mutex = createPromiseMutex();

function fail<T = void>(code: GraphCommandErrorCode, message: string, retryable = false): ServiceResult<T> {
  return { success: false, error: { code, message, retryable } };
}

export const graphCommandService = {
  /**
   * Rename an anchor or cluster Question. Bypasses the
   * LLM-output-cleanup normalizer per D-16 (operator typed exactly what
   * they want; that normalizer is for LLM-laziness defense, not human
   * input). Hard validation only: trim + non-empty + ≤100.
   *
   * Embedding strategy — Blocker #4 graceful degradation:
   *   - isConfigured=false  → patch title/content/summary only; OLD vector
   *                           preserved untouched (slightly stale label,
   *                           still searchable per D-11).
   *   - embed-failure       → same as above + console.warn for diagnostics.
   *   - embed-success       → patch title/content/summary/embeddingVector
   *                           atomically in a SINGLE patchQuestion call.
   *
   * Per Blocker #4 fix (revision 1): never overwrite a vector with undefined. Either the new vector replaces it atomically, or the old vector stays. Embedding-unconfigured and embed-failed paths both preserve the existing vector — retrieval identity degrades gracefully (slightly stale label) rather than silently breaking.
   */
  async rename(id: string, newTitle: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    // Validate OUTSIDE the mutex — validation is pure, no shared state.
    const trimmed = newTitle.trim();
    if (trimmed.length === 0) {
      return fail('VALIDATION_ERROR', 'Title cannot be empty.', false);
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      return fail('VALIDATION_ERROR', `Title cannot exceed ${MAX_TITLE_LENGTH} characters.`, false);
    }

    let result: ServiceResult<void> = { success: true };
    await _mutex.run(async () => {
      // Read fresh inside the mutex — Pattern 1 / R10 risk 1.
      const store = questionService.getAll({ includeFlagged: true });
      const target = store.find((q) => q.id === id);
      if (!target) {
        result = fail('NOT_FOUND', `Question ${id} not found.`, false);
        return;
      }

      // R10 risk 11 — no-op guard. Same title (post-trim) returns success
      // with NO journal entry, NO emit, NO embed call.
      const currentTitle = (target.title ?? '').trim();
      if (currentTitle === trimmed) {
        result = { success: true };
        return;
      }

      // Snapshot pre-image for the journal. embeddingVector is captured
      // REGARDLESS of whether re-embed succeeds later — undo always
      // restores to the literal pre-rename state.
      const before = {
        title: target.title,
        content: target.content,
        summary: target.summary,
        embeddingVector: target.embeddingVector,
      };

      // ─── Embedding strategy — Blocker #4 graceful degradation ─────────
      // Per Blocker #4 fix (revision 1): never overwrite a vector with undefined. Either the new vector replaces it atomically, or the old vector stays. Embedding-unconfigured and embed-failed paths both preserve the existing vector — retrieval identity degrades gracefully (slightly stale label) rather than silently breaking.
      const embCfg = settingsService.getSync().embedding;
      let newVec: number[] | undefined;
      if (embCfg?.isConfigured === true) {
        try {
          newVec = await embedText(trimmed, embCfg);
        } catch (err) {
          console.warn('[Trellis] rename re-embed failed:', err);
          newVec = undefined;
        }
      }
      // newVec is defined only when (a) embedding was configured AND
      // (b) the provider call succeeded. Otherwise it stays undefined
      // and we deliberately OMIT embeddingVector from the patch so the
      // old vector is preserved by the spread-merge inside
      // questionService.patchQuestion.
      const patch: Partial<Question> = {
        title: trimmed,
        content: trimmed,
        summary: trimmed,
      };
      if (newVec !== undefined) {
        patch.embeddingVector = newVec;
      }
      questionService.patchQuestion(id, patch);

      const after: Record<string, unknown> = {
        title: trimmed,
        content: trimmed,
        summary: trimmed,
        // Mirror what's actually stored — new vec on success, old vec on
        // either degraded path. Symmetric with `before` so undo can
        // distinguish "intentional preserve" from "intentional replace."
        embeddingVector: newVec !== undefined ? newVec : target.embeddingVector,
      };

      graphEditJournal.append({
        cmd: 'rename',
        targetIds: [id],
        before,
        after,
      });

      // D-17 — single typed emit from the command boundary.
      eventBus.emit({ type: 'GRAPH_UPDATED', payload: { kind: 'rename', anchorId: id } });

      result = { success: true };
    });
    return result;
  },

  /**
   * Move an anchor under a new cluster, or a QA under a new anchor.
   * Plan 48-02 Task 2 fills this in.
   */
  async move(_id: string, _newParentId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    return fail('NOT_IMPLEMENTED', 'move() is implemented in Plan 48-02 Task 2.', false);
  },

  /**
   * Hard-delete a Question. Cascades children to grandparent (anchor→cluster,
   * cluster→root). Plan 48-02 Task 3 fills this in.
   */
  async delete(_id: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<{ cascadedChildIds: string[] }>> {
    return fail<{ cascadedChildIds: string[] }>('NOT_IMPLEMENTED', 'delete() is implemented in Plan 48-02 Task 3.', false);
  },

  // ─── Plan 48-03 stubs ────────────────────────────────────────────────────

  async merge(_loserId: string, _survivorId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<{ reparentedCount: number; newSurvivorQaCount: number }>> {
    return fail<{ reparentedCount: number; newSurvivorQaCount: number }>('NOT_IMPLEMENTED', 'See Plan 48-03.', false);
  },

  async detach(_qaId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    return fail('NOT_IMPLEMENTED', 'See Plan 48-03.', false);
  },

  async prune(_anchorId: string, _opts?: { signal?: AbortSignal }): Promise<ServiceResult<void>> {
    return fail('NOT_IMPLEMENTED', 'See Plan 48-03.', false);
  },

  // ─── Plan 48-04 stub ─────────────────────────────────────────────────────

  async undo(): Promise<ServiceResult<{ undoneCmd: string; targetIds: string[]; summary: string }>> {
    return fail<{ undoneCmd: string; targetIds: string[]; summary: string }>('NOT_IMPLEMENTED', 'See Plan 48-04.', false);
  },
};
