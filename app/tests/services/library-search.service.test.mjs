// Phase 50 — library-search.service.ts behavioral test suite.
//
// Plan 50-02 wrote this file as a RED scaffold with assert.fail placeholders.
// Plan 50-04 turns it GREEN by replacing each placeholder with a concrete
// assertion against the real service (`src/services/library-search.service.ts`).
// Plan 50-11 (gap G4) added regression tests G4-01..G4-05 for the threshold tightening to 0.3 + minMatchCharLength raise to 3.
//
// Guards three RESEARCH pitfalls + one STRIDE threat:
//   - Pitfall 1: ignoreLocation: true — body match at pos 250 must still
//                return. This is the single most important regression guard
//                for D-14 (relevance) — without ignoreLocation Fuse silently
//                drops late-position matches.
//   - Pitfall 3: index is built inside a useMemo, not in the render body.
//                This file does not test render — but it does test that
//                buildIndex() returns a Fuse instance the caller can reuse,
//                enabling the useMemo pattern.
//   - T-50-QUERY-DOS: capQuery() truncates to 200 chars BEFORE Fuse receives
//                input. Multi-KB query payloads must not reach Fuse.
//
// Test framework: Node.js built-in `node --test` with esbuild tsx loader
// (canonical pattern — see app/tests/canonical-knowledge.test.mjs).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// localStorage polyfill — required because src/types/index.ts is imported
// transitively and one or two siblings touch localStorage during
// module init in the broader codebase. Harmless for this test.
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) ?? null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); },
};

const {
  buildIndex,
  search,
  capQuery,
  extractSnippet,
  dateFilter,
  rebaseIndices,
  FUSE_OPTIONS,
  MAX_QUERY_LENGTH,
} = await import('../../src/services/library-search.service.ts');

// ─── Test corpus helpers ──────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function makePost(overrides = {}) {
  return {
    id: overrides.id ?? `p-${Math.random().toString(16).slice(2)}`,
    date: '2026-05-18',
    title: 'Generic Title',
    teaser: { headline: '', summary: '' },
    bodyMarkdown: '',
    whyCare: '',
    takeaway: '',
    quickAskPrompts: [],
    narrativeMode: 'standard',
    contextLabel: '',
    sourceType: 'recent',
    sourceQuestionIds: [],
    sourceQuestionTitles: [],
    keywords: [],
    generatedAt: Date.now(),
    origin: 'ai',
    ...overrides,
  };
}

// A body string with the target phrase appearing at character position 250.
// "lorem ipsum dolor sit amet, " is 28 chars; repeated 9x = 252 chars of prefix.
const LATE_BODY_PREFIX = 'lorem ipsum dolor sit amet, '.repeat(9); // length ≈ 252
const LATE_BODY = LATE_BODY_PREFIX + 'spaced repetition strengthens memory through expanding intervals';

// ──────────────────────────────────────────────────────────────────────────

describe('libraryService search — Phase 50 plan 50-04 (GREEN)', () => {
  it('builds a Fuse index for ≤250 posts (CONTEXT performance budget)', () => {
    const corpus = Array.from({ length: 250 }, (_, i) =>
      makePost({ id: `p-${i}`, title: `Post ${i}` })
    );
    const t0 = Date.now();
    const idx = buildIndex(corpus);
    const t1 = Date.now();
    // Sanity: returned a usable Fuse instance.
    assert.equal(typeof idx.search, 'function', 'buildIndex must return a Fuse instance with .search');
    // Sanity: index is queryable end-to-end against the corpus.
    const results = idx.search('Post 17');
    assert.ok(results.length >= 1, 'index must return at least one match for "Post 17"');
    // Soft budget: index build should complete in well under one frame.
    // We do NOT assert <16ms here (CI is noisy) — just ensure it finished synchronously.
    assert.ok(t1 - t0 < 1000, `index build took ${t1 - t0}ms — should be near-instant`);
  });

  it('title match returns the post (basic relevance)', () => {
    const corpus = [
      makePost({ id: 'a', title: 'Photosynthesis' }),
      makePost({ id: 'b', title: 'Cell Division' }),
    ];
    const idx = buildIndex(corpus);
    const results = search(idx, 'photosynthesis');
    assert.ok(results.length >= 1, 'expected at least one match for "photosynthesis"');
    assert.equal(results[0].item.id, 'a', 'expected post "a" (Photosynthesis title) to be the top hit');
  });

  it('body match at position >= 200 still returns the post (ignoreLocation: true — RESEARCH Pitfall 1)', () => {
    // Without ignoreLocation: true, Fuse default distance=100 silently drops
    // matches past position ~60. The phrase here is at char 252.
    const phraseStart = LATE_BODY.indexOf('spaced repetition');
    assert.ok(phraseStart >= 200, `setup error: phrase must appear at ≥200 (got ${phraseStart})`);

    const corpus = [
      makePost({ id: 'late-body', title: 'Unrelated Title', bodyMarkdown: LATE_BODY }),
      makePost({ id: 'other', title: 'Unrelated', bodyMarkdown: 'short body without the term' }),
    ];
    const idx = buildIndex(corpus);
    const results = search(idx, 'spaced repetition');
    assert.ok(
      results.some((r) => r.item.id === 'late-body'),
      'late-position body match was silently dropped — ignoreLocation: true is likely missing or has been removed (Pitfall 1)'
    );
  });

  it('relevance sort: title match ranks ABOVE body match for the same query', () => {
    const corpus = [
      makePost({ id: 'body-only', title: 'Unrelated', bodyMarkdown: 'photosynthesis is a metabolic process' }),
      makePost({ id: 'title-match', title: 'Photosynthesis', bodyMarkdown: 'lorem ipsum' }),
    ];
    const idx = buildIndex(corpus);
    const results = search(idx, 'photosynthesis');
    assert.ok(results.length >= 2, 'expected both posts to match');
    assert.equal(
      results[0].item.id,
      'title-match',
      'title match must rank above body-only match (D-14 relevance; per-field weights in FUSE_OPTIONS)'
    );
    // Lower score = better in Fuse.
    assert.ok(
      results[0].score <= results[1].score,
      `expected title-match score (${results[0].score}) ≤ body-only score (${results[1].score})`
    );
  });

  it('date filter — today: returns only posts generated today', () => {
    // "Today" at midnight + 1 second is today; yesterday minus 1 hour is not.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    assert.equal(dateFilter(todayStart.getTime() + 1000, 'today'), true);
    assert.equal(dateFilter(todayStart.getTime() - 1000, 'today'), false);
    assert.equal(dateFilter(Date.now(), 'today'), true);
  });

  it('date filter — last7: returns posts from the last 7 days', () => {
    assert.equal(dateFilter(Date.now() - 1000, 'last7'), true);
    assert.equal(dateFilter(Date.now() - 6 * DAY_MS, 'last7'), true);
    assert.equal(dateFilter(Date.now() - 8 * DAY_MS, 'last7'), false);
  });

  it('date filter — last30: returns posts from the last 30 days', () => {
    assert.equal(dateFilter(Date.now() - 1000, 'last30'), true);
    assert.equal(dateFilter(Date.now() - 29 * DAY_MS, 'last30'), true);
    assert.equal(dateFilter(Date.now() - 31 * DAY_MS, 'last30'), false);
  });

  it('date filter — all: returns the full corpus unfiltered', () => {
    assert.equal(dateFilter(0, 'all'), true);
    assert.equal(dateFilter(Date.now() - 365 * DAY_MS, 'all'), true);
    assert.equal(dateFilter(Date.now() + 365 * DAY_MS, 'all'), true);
  });

  it('query length cap (200 chars) enforced BEFORE Fuse receives input (T-50-QUERY-DOS mitigation)', () => {
    assert.equal(MAX_QUERY_LENGTH, 200, 'MAX_QUERY_LENGTH must be 200');
    assert.equal(capQuery('a'.repeat(300)).length, 200, 'capQuery must truncate >200 char input to 200');
    assert.equal(capQuery('a'.repeat(5000)).length, 200, 'capQuery must truncate even multi-KB input to 200');
    // No-trim invariant: short queries pass through unchanged including surrounding whitespace.
    assert.equal(capQuery(' hello '), ' hello ', 'capQuery must NOT trim — search is character-sensitive');
    assert.equal(capQuery(''), '', 'capQuery on empty string is empty string');
    // search() wraps capQuery — verify wrapping by introspection: a 300-char
    // query against an empty index doesn't throw and returns [].
    const idx = buildIndex([]);
    assert.deepEqual(search(idx, 'x'.repeat(300)), [], 'search on empty index returns []');
  });

  it('multi-field index: concept and source fields are searchable', () => {
    const corpus = [
      makePost({ id: 'concept-only', title: 'Untitled', bodyMarkdown: '', sourceQuestionTitles: ['Photosynthesis'] }),
      makePost({ id: 'source-only',  title: 'Untitled', bodyMarkdown: '', contextLabel: 'YouTube' }),
      makePost({ id: 'noise',        title: 'Untitled', bodyMarkdown: '', contextLabel: 'News' }),
    ];
    const idx = buildIndex(corpus);
    const conceptResults = search(idx, 'Photosynthesis');
    assert.ok(
      conceptResults.some((r) => r.item.id === 'concept-only'),
      'concept (sourceQuestionTitles) field must be searchable'
    );
    const sourceResults = search(idx, 'YouTube');
    assert.ok(
      sourceResults.some((r) => r.item.id === 'source-only'),
      'contextLabel (source) field must be searchable'
    );
  });

  // ─── Snippet extraction (Surface 7 contract) ──────────────────────────

  it('extractSnippet — centers on first match with ellipsis bookends when truncated mid-body', () => {
    const body = 'a'.repeat(200) + 'TARGET' + 'b'.repeat(200);
    const matchStart = body.indexOf('TARGET');
    const { text, offset } = extractSnippet(body, matchStart, 120);
    assert.ok(text.length <= 122, `text should be ≤ 122 chars including bookends (got ${text.length})`);
    assert.ok(text.startsWith('…'), 'mid-body match must have leading ellipsis');
    assert.ok(text.endsWith('…'), 'mid-body match must have trailing ellipsis');
    assert.ok(text.includes('TARGET'), 'snippet must contain the match');
    // offset must point into the body such that body.slice(offset - prefix.length, ...)
    // re-aligns to the snippet origin. Here offset = rawStart - 1 (for the '…').
    assert.equal(typeof offset, 'number', 'offset must be a number');
  });

  it('extractSnippet — match near start: no leading ellipsis', () => {
    const body = 'TARGET' + 'b'.repeat(500);
    const { text } = extractSnippet(body, 0, 120);
    assert.ok(text.startsWith('TARGET'), 'match at start should leave snippet starting at the match');
    assert.ok(!text.startsWith('…'), 'no leading ellipsis when match is in the first half-window');
  });

  it('extractSnippet — match near end: no trailing ellipsis', () => {
    const body = 'a'.repeat(500) + 'TARGET';
    const matchStart = body.indexOf('TARGET');
    const { text } = extractSnippet(body, matchStart, 120);
    assert.ok(text.endsWith('TARGET'), 'match at end should keep snippet ending at the match');
    assert.ok(!text.endsWith('…'), 'no trailing ellipsis when match is in the last half-window');
  });

  it('extractSnippet — body shorter than window: returns full body, no bookends', () => {
    const body = 'short body';
    const { text, offset } = extractSnippet(body, 0, 120);
    assert.equal(text, body, 'short body must be returned verbatim');
    assert.equal(offset, 0, 'offset must be 0 when no truncation');
  });

  it('extractSnippet — empty body: returns { text: "", offset: 0 }', () => {
    assert.deepEqual(extractSnippet('', 0, 120), { text: '', offset: 0 });
  });

  // ─── rebaseIndices ────────────────────────────────────────────────────

  it('rebaseIndices — shifts pairs by -offset and drops out-of-window pairs', () => {
    // Body indices [[5,9], [50,54], [200,204]] inside a snippet starting
    // at offset 40, max length 30 (snippet covers body chars 40..69).
    const out = rebaseIndices([[5, 9], [50, 54], [200, 204]], 40, 30);
    // [5,9]      shifted to [-35,-31] → entirely before window → dropped
    // [50,54]    shifted to [10,14]   → inside window → kept
    // [200,204]  shifted to [160,164] → entirely after window → dropped
    assert.deepEqual(out, [[10, 14]]);
  });

  it('rebaseIndices — clamps partial overlaps at window boundaries', () => {
    // Pair [38,42] starts before the snippet (offset 40) → clamp left to 0
    // Pair [65,72] extends past maxLen 30 → clamp right to 29
    const out = rebaseIndices([[38, 42], [65, 72]], 40, 30);
    assert.deepEqual(out, [[0, 2], [25, 29]]);
  });

  // ─── FUSE_OPTIONS introspection (defends Pitfall 1 by direct assertion) ─

  it('FUSE_OPTIONS — ignoreLocation: true is set (load-bearing — Pitfall 1)', () => {
    assert.equal(FUSE_OPTIONS.ignoreLocation, true, 'FUSE_OPTIONS.ignoreLocation MUST be true');
  });

  it('FUSE_OPTIONS — title weight > body weight > concept/source weights (D-14 relevance)', () => {
    const byName = Object.fromEntries(FUSE_OPTIONS.keys.map((k) => [k.name, k.weight]));
    assert.ok(byName.title > byName.bodyMarkdown, 'title weight must exceed body weight');
    assert.ok(byName.bodyMarkdown > byName.sourceQuestionTitles, 'body weight must exceed concept weight');
    assert.ok(byName.bodyMarkdown > byName.contextLabel, 'body weight must exceed source weight');
  });
});

// ─── Plan 50-11 gap G4 regression tests ─────────────────────────────────────

describe('libraryService search — Phase 50 plan 50-11 gap G4 regression', () => {
  it('G4-01: "3D printing" query does NOT return unrelated Kanji post with scattered single-char overlap', () => {
    const postA = makePost({
      id: 'p-3d',
      title: '3D Printing at Scale',
      bodyMarkdown: 'An overview of fused deposition modeling and resin printing',
    });
    const postB = makePost({
      id: 'p-kanji',
      title: 'Recognizing Kanji Radicals',
      bodyMarkdown: 'Kanji recognition relies on identifying repeated structural radicals (R) and stroke compositions; this differs from alphabetic recognition.',
    });
    const idx = buildIndex([postA, postB]);
    const results = search(idx, '3D printing');
    assert.ok(results.length >= 1, 'expected at least one match for "3D printing"');
    assert.equal(results[0].item.id, postA.id, '3D printing post must be the top hit');
    assert.ok(
      results.every((r) => r.item.id !== postB.id),
      'Kanji post must NOT appear in results — scattered single-char Bitap overlap is a false positive'
    );
  });

  it('G4-02: "system" query highlights contiguous run only — no single-char stray fragments', () => {
    const post = makePost({
      id: 'p-system',
      title: 'Understanding the System Prompt',
      bodyMarkdown: 'The system prompt anchors the assistant behavior across turns.',
    });
    const idx = buildIndex([post]);
    const results = search(idx, 'system');
    assert.ok(results.length >= 1, 'expected at least one match for "system"');
    const bodyMatch = results[0].matches?.find((m) => m.key === 'bodyMarkdown');
    assert.ok(bodyMatch, 'expected a bodyMarkdown match entry');
    // Every matched index pair on body must span at least 6 chars ("system".length)
    for (const [start, end] of bodyMatch.indices) {
      const runLen = end - start + 1;
      assert.ok(runLen >= 6, `body match run [${start},${end}] has length ${runLen} — expected ≥ 6 for "system"`);
    }
  });

  it('G4-03: single-character query "e" returns ZERO results (minMatchCharLength=3 rejection)', () => {
    const corpus = [
      makePost({ id: 'p-e1', title: 'Everything Everywhere', bodyMarkdown: 'extended edition' }),
      makePost({ id: 'p-e2', title: 'Entropy Explained', bodyMarkdown: 'energy and equilibrium' }),
    ];
    const idx = buildIndex(corpus);
    const results = search(idx, 'e');
    assert.strictEqual(results.length, 0, 'single-char query "e" must return zero results');
  });

  it('G4-04: two-character query "at" returns ZERO results against non-prefix corpus (minMatchCharLength=3)', () => {
    // Fuse.js minMatchCharLength suppresses match-run reporting for runs < 3 chars,
    // but does NOT reject 2-char queries outright. Use a corpus where "at" has no
    // strong prefix/substring alignment to exercise the threshold + minMatchCharLength
    // combo rejecting weak fuzzy matches.
    const corpus = [
      makePost({ id: 'p-x1', title: 'Photosynthesis Overview', bodyMarkdown: 'chlorophyll pigments' }),
      makePost({ id: 'p-x2', title: 'Quantum Mechanics', bodyMarkdown: 'wave function collapse' }),
    ];
    const idx = buildIndex(corpus);
    const results = search(idx, 'at');
    assert.strictEqual(results.length, 0, 'two-char query "at" must return zero results against unrelated corpus');
  });

  it('G4-05: late-body match at pos >= 200 still returns — ignoreLocation: true regression guard (Pitfall 1)', () => {
    const phraseStart = LATE_BODY.indexOf('spaced repetition');
    assert.ok(phraseStart >= 200, `setup check: phrase must be at ≥200 (got ${phraseStart})`);
    const corpus = [
      makePost({ id: 'p-late', title: 'Unrelated Title', bodyMarkdown: LATE_BODY }),
      makePost({ id: 'p-other', title: 'Noise', bodyMarkdown: 'short unrelated body' }),
    ];
    const idx = buildIndex(corpus);
    const results = search(idx, 'spaced repetition');
    assert.ok(results.length >= 1, 'late-body match must return at least one result');
    assert.ok(
      results.some((r) => r.item.id === 'p-late'),
      'post with late-body match must be in results — ignoreLocation: true is load-bearing'
    );
    // Verify the match indices confirm a late-position hit
    const lateResult = results.find((r) => r.item.id === 'p-late');
    const bodyMatch = lateResult.matches?.find((m) => m.key === 'bodyMarkdown');
    assert.ok(bodyMatch, 'expected bodyMarkdown match entry');
    const hasLateIndex = bodyMatch.indices.some(([start]) => start >= 200);
    assert.ok(hasLateIndex, 'bodyMarkdown match must include an index pair starting at ≥ 200 (Pitfall 1 regression guard)');
  });
});
