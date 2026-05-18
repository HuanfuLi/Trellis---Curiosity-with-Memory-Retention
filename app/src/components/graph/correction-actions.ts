// correction-actions.ts — Phase 49-02
//
// Pure-function helpers for the per-node-type action matrix. Lives in a .ts
// file (not .tsx) so node --test can import it directly without a TSX loader
// — see CLAUDE.md test-framework note ("import .ts modules via the
// extension-aware native ESM resolver").
//
// The .tsx component re-exports these for ergonomic single-import in app
// code; matrix tests import directly from this file.

import type { Question } from '../../types/index.ts';

export type CorrectionAction =
  | { kind: 'rename' }
  | { kind: 'move' }
  | { kind: 'merge' }
  | { kind: 'detach' }
  | { kind: 'prune' }
  | { kind: 'delete' };

/**
 * Per-node-type action matrix (D-15 + B-6 fix).
 *
 *   - Synthetic root/branch IDs    → [] (caller short-circuits; defensive guard).
 *   - Cluster (isClusterNode=true) → 4 actions: rename, move, merge, delete.
 *   - Anchor (isAnchorNode=true)   → 5 actions: rename, move, merge, prune, delete.
 *   - QA leaf (parentId AND !flagged) → 2 actions: detach, delete.
 *   - Orphan QA (no parentId)      → [].
 *   - Flagged QA                   → [].
 */
export function getActionsForNode(node: Question): CorrectionAction[] {
  // Defensive guards for synthetic IDs.
  if (node.id === 'root-knowledge') return [];
  if (node.id.startsWith('branch-')) return [];

  if (node.isClusterNode) {
    return [
      { kind: 'rename' },
      { kind: 'move' },
      { kind: 'merge' },
      { kind: 'delete' },
    ];
  }
  if (node.isAnchorNode) {
    return [
      { kind: 'rename' },
      { kind: 'move' },
      { kind: 'merge' },
      { kind: 'prune' },
      { kind: 'delete' },
    ];
  }

  // QA leaf gate: must have a parentId AND not be flagged.
  const isQaLeaf =
    !node.isClusterNode && !node.isAnchorNode && !!node.parentId && node.flagged !== true;
  if (isQaLeaf) {
    return [{ kind: 'detach' }, { kind: 'delete' }];
  }

  // Orphan, flagged-out, or malformed → empty (GraphScreen handles silently).
  return [];
}
