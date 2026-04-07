/**
 * concept-feed-strategy.test.mjs
 * Unit tests for applyStrategyBias behavior in concept-feed.service.ts
 * Phase 20: Orchestration Strategy — ORCH-02
 *
 * applyStrategyBias is not exported, so we test the pure sorting logic inline
 * (same pattern as suggestionScorer.test.mjs). The algorithm is:
 *   - Given posts[] and hints.priorityConceptIds[]
 *   - Sort so posts whose sourceQuestionIds overlap priorityConceptIds appear first
 *   - When priorityConceptIds is empty, posts are returned unchanged
 *   - Wrapped in try-catch so any error returns posts unmodified
 */

import { describe, it } from 'node:test';
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ─── Inline applyStrategyBias algorithm ──────────────────────────────────────
// Mirrors the implementation in concept-feed.service.ts lines 776-791.
// The logic is extracted here to enable pure unit testing without DOM/Capacitor deps.

function applyStrategyBiasInline(posts, hints) {
  // Matches the impl: only sort when priorityConceptIds is non-empty
  if (hints.priorityConceptIds.length > 0) {
    posts.sort((a, b) => {
      const aMatch = hints.priorityConceptIds.some((id) => a.sourceQuestionIds?.includes(id)) ? 1 : 0;
      const bMatch = hints.priorityConceptIds.some((id) => b.sourceQuestionIds?.includes(id)) ? 1 : 0;
      return bMatch - aMatch;
    });
  }
  return posts;
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makePost(id, sourceQuestionIds = []) {
  return {
    id,
    date: '2026-04-07',
    title: `Post ${id}`,
    teaser: { hook: 'hook', preview: 'preview' },
    narrativeMode: 'starter',
    contextLabel: 'Test',
    sourceType: 'concept',
    sourceQuestionIds,
    sourceQuestionTitles: [],
    keywords: [],
    generatedAt: Date.now(),
    origin: 'ai',
  };
}

function makeHints(priorityConceptIds = [], mode = 'balanced') {
  return {
    mode,
    weakAreaBias: 0.5,
    discoveryWeight: 0.5,
    priorityConceptIds,
    curiosityTopics: [],
  };
}

// ─── Path for structural checks ───────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMPL_PATH = join(__dirname, '../../src/services/concept-feed.service.ts');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('applyStrategyBias — priority concept posts are sorted to front', () => {
  it('posts matching priorityConceptIds are placed before non-matching posts', () => {
    const posts = [
      makePost('p1', ['q-other']),
      makePost('p2', ['q-priority']),
      makePost('p3', ['q-other-2']),
    ];
    const hints = makeHints(['q-priority']);

    const result = applyStrategyBiasInline(posts, hints);

    assert.strictEqual(result[0].id, 'p2', 'priority-matching post should be first');
  });

  it('multiple posts matching priorityConceptIds all appear before non-matching ones', () => {
    const posts = [
      makePost('p1', ['q-other']),
      makePost('p2', ['q-priority-1']),
      makePost('p3', ['q-other-2']),
      makePost('p4', ['q-priority-2']),
    ];
    const hints = makeHints(['q-priority-1', 'q-priority-2']);

    const result = applyStrategyBiasInline(posts, hints);

    const matchingIds = result
      .filter((p) => p.sourceQuestionIds.some((id) => ['q-priority-1', 'q-priority-2'].includes(id)))
      .map((p) => p.id);
    const nonMatchingIds = result
      .filter((p) => !p.sourceQuestionIds.some((id) => ['q-priority-1', 'q-priority-2'].includes(id)))
      .map((p) => p.id);

    // All matching posts must appear before all non-matching posts
    const lastMatchIndex = result.findIndex((p) => nonMatchingIds.includes(p.id));
    const firstNonMatchIndex = result.findIndex((p) => matchingIds.includes(p.id));

    assert.ok(
      matchingIds.length === 2,
      `expected 2 matching posts, got ${matchingIds.length}`,
    );
    // The first non-match must come after all matches — i.e., after index >= matchingIds.length - 1
    const matchIndices = result
      .map((p, i) => (matchingIds.includes(p.id) ? i : -1))
      .filter((i) => i >= 0);
    const nonMatchIndices = result
      .map((p, i) => (nonMatchingIds.includes(p.id) ? i : -1))
      .filter((i) => i >= 0);

    assert.ok(
      Math.max(...matchIndices) < Math.min(...nonMatchIndices),
      `all matching posts should precede all non-matching posts. Result order: ${result.map((p) => p.id).join(', ')}`,
    );
  });

  it('post with overlapping sourceQuestionIds (partial match) counts as priority', () => {
    const posts = [
      makePost('p1', ['q-other']),
      makePost('p2', ['q-abc', 'q-priority']),  // has one priority + one non-priority
    ];
    const hints = makeHints(['q-priority']);

    const result = applyStrategyBiasInline(posts, hints);

    assert.strictEqual(result[0].id, 'p2', 'partial match on sourceQuestionIds should still count as priority');
  });
});

describe('applyStrategyBias — no-op when priorityConceptIds is empty', () => {
  it('returns posts in original order when priorityConceptIds is empty', () => {
    const posts = [
      makePost('p1', ['q-1']),
      makePost('p2', ['q-2']),
      makePost('p3', ['q-3']),
    ];
    const originalOrder = posts.map((p) => p.id);
    const hints = makeHints([]);  // empty priority list

    const result = applyStrategyBiasInline(posts, hints);

    assert.deepStrictEqual(
      result.map((p) => p.id),
      originalOrder,
      'posts should remain in original order when no priority concepts specified',
    );
  });

  it('returns all posts (no filtering) regardless of priority match', () => {
    const posts = [
      makePost('p1', ['q-priority']),
      makePost('p2', ['q-other']),
      makePost('p3', []),
    ];
    const hints = makeHints(['q-priority']);

    const result = applyStrategyBiasInline(posts, hints);

    assert.strictEqual(result.length, 3, 'all posts must be returned — bias is sorting-only, not filtering');
  });
});

describe('applyStrategyBias — posts with empty sourceQuestionIds are not matched', () => {
  it('post with no sourceQuestionIds does not count as priority match', () => {
    const posts = [
      makePost('p1', []),         // empty — cannot match any priority
      makePost('p2', ['q-priority']),
    ];
    const hints = makeHints(['q-priority']);

    const result = applyStrategyBiasInline(posts, hints);

    assert.strictEqual(result[0].id, 'p2', 'post with empty sourceQuestionIds should not match');
    assert.strictEqual(result[1].id, 'p1', 'post with empty sourceQuestionIds should remain last');
  });
});

// ─── Structural verification: impl uses applyStrategyBias at all return paths ─

describe('applyStrategyBias — structural presence in concept-feed.service.ts', () => {
  const implSource = readFileSync(IMPL_PATH, 'utf8');

  it('applyStrategyBias function is defined in concept-feed.service.ts', () => {
    assert.ok(
      implSource.includes('function applyStrategyBias'),
      'applyStrategyBias function must be defined in concept-feed.service.ts',
    );
  });

  it('applyStrategyBias sorts by priorityConceptIds overlap', () => {
    assert.ok(
      implSource.includes('priorityConceptIds'),
      'impl must reference priorityConceptIds for the bias sort',
    );
    assert.ok(
      implSource.includes('sourceQuestionIds'),
      'impl must reference sourceQuestionIds to match posts to priority concepts',
    );
  });

  it('applyStrategyBias is called at getDailyPosts return paths', () => {
    // Count occurrences of applyStrategyBias( in the source
    const callCount = (implSource.match(/applyStrategyBias\(/g) || []).length;
    assert.ok(
      callCount >= 4,
      `applyStrategyBias should be called at 4+ return paths (getDailyPosts x3 + getCachedDailyPosts x1), found ${callCount} calls`,
    );
  });

  it('applyStrategyBias is wrapped in try-catch to protect feed from signal errors', () => {
    // The impl has a try-catch inside applyStrategyBias
    const fnStart = implSource.indexOf('function applyStrategyBias');
    const fnEnd = implSource.indexOf('\n}', fnStart) + 2;
    const fnBody = implSource.slice(fnStart, fnEnd);
    assert.ok(
      fnBody.includes('try {') && fnBody.includes('catch'),
      'applyStrategyBias must have try-catch to prevent feed breakage when signals unavailable',
    );
  });

  it('defaultStrategy.computeHints is called inside applyStrategyBias', () => {
    const fnStart = implSource.indexOf('function applyStrategyBias');
    const fnEnd = implSource.indexOf('\n}', fnStart) + 2;
    const fnBody = implSource.slice(fnStart, fnEnd);
    assert.ok(
      fnBody.includes('computeHints'),
      'applyStrategyBias must call computeHints to derive hints from current trajectory signals',
    );
  });
});
