import type { Question, ServiceResult } from '../types';
import { questionService } from './question.service';
import { dbExecute, dbQuery } from './db.service';

// ─── Similarity helpers ───────────────────────────────────────────────────────

/**
 * Jaccard-style keyword overlap score in [0, 1].
 */
function keywordSimilarity(a: Question, b: Question): number {
  if (a.keywords.length === 0 || b.keywords.length === 0) return 0;
  const setA = new Set(a.keywords);
  const setB = new Set(b.keywords);
  let intersection = 0;
  for (const k of setA) if (setB.has(k)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

function similarity(a: Question, b: Question): number {
  return keywordSimilarity(a, b);
}

// ─── Edge key (canonical order) ──────────────────────────────────────────────

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

// ─── Edge weight persistence (SQLite / localStorage via db.service) ───────────
// DDL lives in db.service.ts (_runMigrations / init). These helpers only do DML.

async function loadEdgeWeights(): Promise<Record<string, number>> {
  try {
    const rows = await dbQuery<{ edge_key: string; weight: number }>('SELECT * FROM edge_weights');
    const map: Record<string, number> = {};
    for (const row of rows) map[row.edge_key] = row.weight;
    return map;
  } catch {
    // SQLite unavailable (e.g. plugin not ready on Android) — proceed without weights
    return {};
  }
}

async function incrementEdgeWeight(key: string): Promise<number> {
  const existing = await dbQuery<{ edge_key: string; weight: number }>(
    'SELECT * FROM edge_weights WHERE edge_key = ?',
    [key],
  );
  const newWeight = (existing[0]?.weight ?? 0) + 1;
  await dbExecute(
    'INSERT OR REPLACE INTO edge_weights (edge_key, weight) VALUES (?, ?)',
    [key, newWeight],
  );
  return newWeight;
}

// ─── Graph Service ────────────────────────────────────────────────────────────

export const graphService = {
  /** Questions that have no outbound related links yet. */
  getUnlinkedNodes(): Question[] {
    return questionService.getAll().filter((q) => q.relatedQuestionIds.length === 0);
  },

  /**
   * Find questions most similar to the given source by keyword Jaccard overlap.
   * Excludes the source and already-linked nodes.
   */
  getSimilarNodes(sourceId: string, limit = 4): Question[] {
    const all = questionService.getAll();
    const source = all.find((q) => q.id === sourceId);
    if (!source) return [];

    const alreadyLinked = new Set([sourceId, ...source.relatedQuestionIds]);

    return all
      .filter((q) => !alreadyLinked.has(q.id))
      .map((q) => ({ q, score: similarity(source, q) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ q }) => q);
  },

  /** Create a bidirectional edge between two nodes. */
  async linkNodes(sourceId: string, targetId: string): Promise<ServiceResult<void>> {
    const all = questionService.getAll();
    const sourceNode = all.find((q) => q.id === sourceId);
    const targetNode = all.find((q) => q.id === targetId);

    if (!sourceNode || !targetNode) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Node not found', retryable: false } };
    }

    if (!sourceNode.relatedQuestionIds.includes(targetId)) {
      questionService.updateRelatedIds(sourceId, [...sourceNode.relatedQuestionIds, targetId]);
    }
    if (!targetNode.relatedQuestionIds.includes(sourceId)) {
      questionService.updateRelatedIds(targetId, [...targetNode.relatedQuestionIds, sourceId]);
    }
    return { success: true };
  },

  /**
   * Increment the "aha!" reinforcement weight for the edge between two nodes.
   * Persisted via SQLite (native) or the localStorage-backed DB shim (web).
   */
  async reinforceEdge(idA: string, idB: string): Promise<number> {
    return incrementEdgeWeight(edgeKey(idA, idB));
  },

  async getEdgeWeight(idA: string, idB: string): Promise<number> {
    const weights = await loadEdgeWeights();
    return weights[edgeKey(idA, idB)] ?? 0;
  },

  /**
   * Return direct children of a node in the hierarchy.
   * Pass `null` to get top-level nodes (parentId === undefined).
   */
  getChildren(parentId: string | null): Question[] {
    return questionService.getAll().filter((q) =>
      parentId === null ? !q.parentId : q.parentId === parentId,
    );
  },

  /** Move a node to a new parent in the hierarchy. Pass `null` to make it a root node. */
  moveToParent(nodeId: string, newParentId: string | null): void {
    questionService.patchQuestion(nodeId, { parentId: newParentId ?? undefined });
  },

  /** Get all nodes and edges for the graph canvas. */
  async getGraph(): Promise<{ nodes: Question[]; edges: Array<{ source: string; target: string; weight: number }> }> {
    const nodes = questionService.getAll();
    const weights = await loadEdgeWeights();
    const edgeSet = new Set<string>();
    const edges: Array<{ source: string; target: string; weight: number }> = [];

    for (const node of nodes) {
      for (const targetId of node.relatedQuestionIds) {
        const key = edgeKey(node.id, targetId);
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: node.id, target: targetId, weight: weights[key] ?? 0 });
        }
      }
    }

    return { nodes, edges };
  },
};
