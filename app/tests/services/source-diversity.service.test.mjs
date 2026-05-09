// Phase 40 — source-diversity.service.ts behavioral test suite.
//
// Mirrors engagement.service.test.mjs shape MINUS the localStorage shim
// (this leaf uses a pure in-memory Map). Covers CONTENT-02 SC-1, SC-2, SC-3.
//
// 15 behavioral cases:
//   1-7  filterForDiversity  (D-05 strict bucket split, D-06 best-of-bad
//                              fallback, D-07 stable sort, D-10 malformed
//                              exclusion, valid-but-seen surfaces via Pass B)
//   8-10 scoreSource          (top tier, unknown=UNKNOWN_DOMAIN_SCORE, blocked=0.0)
//   11-13 extractDomain       (subdomain collapse, multi-segment TLDs, malformed)
//   14-15 record/get/reset   (round-trip + idempotence)

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

const {
  sourceDiversityService,
  filterForDiversity,
  recordServedDomain,
  getUsedDomains,
  scoreSource,
  reset,
  extractDomain,
  normalizeHost,
  MULTI_SEGMENT_TLDS,
  DOMAIN_TIERS,
  UNKNOWN_DOMAIN_SCORE,
} = await import('../../src/services/source-diversity.service.ts');

// Helper to construct a WebSearchResult fixture (matches src/types/index.ts shape)
function mkResult(url, score = 0.5, title = 'T', content = 'C') {
  return { title, url, content, score };
}

describe('sourceDiversityService — Phase 40', () => {
  beforeEach(() => {
    // Clear the session Map between tests so anchor bookkeeping is isolated.
    reset();
  });

  // ─── filterForDiversity (cases 1-7) ─────────────────────────────────────

  it('filterForDiversity — unseen domain beats seen domain regardless of score order (D-05)', () => {
    const results = [
      mkResult('https://low.example.com/a'),
      mkResult('https://nature.com/b'),
    ];
    const out = filterForDiversity(results, new Set(['nature.com']));
    assert.equal(out.length, 2);
    assert.equal(out[0].url, 'https://low.example.com/a',
      'unseen low-quality must win position 0 over seen top-quality');
    assert.equal(out[1].url, 'https://nature.com/b');
  });

  it('filterForDiversity — within unseen tier, higher score wins (D-05)', () => {
    const results = [
      mkResult('https://medium.com/x'),
      mkResult('https://nature.com/y'),
    ];
    const out = filterForDiversity(results, new Set());
    assert.equal(out[0].url, 'https://nature.com/y',
      'nature.com (0.95) must outrank medium.com (0.30)');
    assert.equal(out[1].url, 'https://medium.com/x');
  });

  it('filterForDiversity — stable sort preserves Tavily order for ties (D-07)', () => {
    // Both domains are unknown so both score UNKNOWN_DOMAIN_SCORE (0.5).
    // V8 stable sort must preserve Tavily-original ordering on ties.
    const results = [
      mkResult('https://unknown-a.com/1'),
      mkResult('https://unknown-b.com/2'),
    ];
    const out = filterForDiversity(results, new Set());
    assert.equal(out[0].url, 'https://unknown-a.com/1',
      'Tavily-original position 0 preserved on tie');
    assert.equal(out[1].url, 'https://unknown-b.com/2');
  });

  it('filterForDiversity — D-06 best-of-bad fallback fires when ALL inputs are malformed URLs', () => {
    const results = [
      mkResult('not-a-url-1'),
      mkResult('not-a-url-2'),
    ];
    const out = filterForDiversity(results, new Set());
    assert.equal(out.length, 1, 'fallback returns a single-element array');
    // Both malformed → both score UNKNOWN_DOMAIN_SCORE via extractDomain(url) ?? '',
    // so stable sort keeps the first input on top.
    assert.equal(out[0].url, 'not-a-url-1',
      'fallback returns the highest-scored (or first via stable sort) raw input');
  });

  it('filterForDiversity — D-10 malformed URL silently excluded when valid results exist (D-06 NOT triggered)', () => {
    const results = [
      mkResult('https://nature.com/a'),
      mkResult('not-a-url'),
    ];
    const out = filterForDiversity(results, new Set());
    assert.equal(out.length, 1, 'malformed dropped, valid result surfaces');
    assert.equal(out[0].url, 'https://nature.com/a');
  });

  it('filterForDiversity — empty input returns empty array (D-06 NOT triggered)', () => {
    const out = filterForDiversity([], new Set());
    assert.deepEqual(out, []);
  });

  it('filterForDiversity — all-seen results still surface via Pass B (D-06 NOT triggered when valid-but-seen)', () => {
    // Load-bearing UX semantics per CONTEXT.md "Specific Ideas" — the fallback
    // is for malformed-URL-only inputs, not for "all already-served".
    const results = [
      mkResult('https://nature.com/a'),
      mkResult('https://bbc.com/b'),
    ];
    const out = filterForDiversity(results, new Set(['nature.com', 'bbc.com']));
    assert.equal(out.length, 2, 'both surface via Pass B');
    assert.equal(out[0].url, 'https://nature.com/a',
      'within Pass B, higher score (nature 0.95) outranks bbc 0.88');
    assert.equal(out[1].url, 'https://bbc.com/b');
  });

  // ─── scoreSource (cases 8-10) ───────────────────────────────────────────

  it('scoreSource — known top-tier domain returns expected score', () => {
    assert.equal(scoreSource('nature.com'), 0.95);
    assert.equal(scoreSource('reuters.com'), 0.88);
  });

  it('scoreSource — unknown domain returns UNKNOWN_DOMAIN_SCORE (0.5)', () => {
    assert.equal(scoreSource('unknown-niche-site-xyz-12345.com'), 0.5);
    assert.equal(
      scoreSource('unknown-niche-site-xyz-12345.com'),
      UNKNOWN_DOMAIN_SCORE,
      'unknown-domain default must equal the exported UNKNOWN_DOMAIN_SCORE const',
    );
  });

  it('scoreSource — blocked-tier domain returns 0.0', () => {
    assert.equal(scoreSource('ezinearticles.com'), 0.0);
    assert.equal(scoreSource('articleforge.com'), 0.0);
  });

  // ─── extractDomain (cases 11-13) ────────────────────────────────────────

  it('extractDomain — collapses subdomain to registrable root (D-09)', () => {
    assert.equal(extractDomain('https://science.nature.com/article/abc'), 'nature.com');
    assert.equal(extractDomain('https://www.bbc.com/news'), 'bbc.com');
    assert.equal(extractDomain('https://m.wikipedia.org/wiki/x'), 'wikipedia.org');
  });

  it('extractDomain — handles multi-segment TLDs via PSL slice (D-11)', () => {
    assert.equal(extractDomain('https://www.bbc.co.uk/news/x'), 'bbc.co.uk');
    assert.equal(extractDomain('https://news.ox.ac.uk/research'), 'ox.ac.uk');
    // RESEARCH § 2 addition — gob.mx covers Mexican federal government domains.
    assert.equal(extractDomain('https://gobierno.gob.mx/page'), 'gobierno.gob.mx');
    // Sanity check: MULTI_SEGMENT_TLDS export is the const we expect.
    assert.ok(MULTI_SEGMENT_TLDS.has('gob.mx'),
      'MULTI_SEGMENT_TLDS must include gob.mx (RESEARCH § 2 addition)');
    assert.ok(MULTI_SEGMENT_TLDS.has('ac.nz'),
      'MULTI_SEGMENT_TLDS must include ac.nz (RESEARCH § 2 addition)');
  });

  it('extractDomain — malformed URL returns undefined (D-10)', () => {
    assert.equal(extractDomain('not-a-url'), undefined);
    assert.equal(extractDomain(''), undefined);
    assert.equal(extractDomain('://broken'), undefined);
  });

  // ─── recordServedDomain + getUsedDomains + reset (cases 14-15) ──────────

  it('recordServedDomain + getUsedDomains round-trip; reset() clears all', () => {
    recordServedDomain('anchor-1', 'nature.com');
    recordServedDomain('anchor-1', 'bbc.com');
    recordServedDomain('anchor-2', 'wikipedia.org');

    const a1 = getUsedDomains('anchor-1');
    assert.equal(a1.size, 2);
    assert.ok(a1.has('nature.com'));
    assert.ok(a1.has('bbc.com'));

    const a2 = getUsedDomains('anchor-2');
    assert.equal(a2.size, 1);
    assert.ok(a2.has('wikipedia.org'));

    // Unknown anchorId returns a fresh empty Set (no throw).
    const unknown = getUsedDomains('unknown-anchor');
    assert.equal(unknown.size, 0);

    // reset() wipes the entire Map.
    reset();
    assert.equal(getUsedDomains('anchor-1').size, 0);
    assert.equal(getUsedDomains('anchor-2').size, 0);
  });

  it('recordServedDomain — duplicate (anchor, domain) is a Set no-op', () => {
    recordServedDomain('anchor-1', 'nature.com');
    recordServedDomain('anchor-1', 'nature.com');
    const set = getUsedDomains('anchor-1');
    assert.equal(set.size, 1, 'Set semantics: duplicate add is a no-op');
    assert.ok(set.has('nature.com'));
  });

  // ─── Singleton-shape sanity (proves the export contract Phase 41 will use) ─

  it('sourceDiversityService singleton exposes the 5-function API contract', () => {
    assert.equal(typeof sourceDiversityService.filterForDiversity, 'function');
    assert.equal(typeof sourceDiversityService.recordServedDomain, 'function');
    assert.equal(typeof sourceDiversityService.getUsedDomains, 'function');
    assert.equal(typeof sourceDiversityService.scoreSource, 'function');
    assert.equal(typeof sourceDiversityService.reset, 'function');
    // normalizeHost is exported as a named function (D-15) but NOT a singleton method
    // (Phase 41 imports it as a named export when needed). Confirm the named export.
    assert.equal(typeof normalizeHost, 'function');
    // DOMAIN_TIERS exposes the bundled quality table for inspection (D-15).
    assert.ok(typeof DOMAIN_TIERS === 'object' && DOMAIN_TIERS !== null);
    assert.equal(DOMAIN_TIERS['nature.com'], 0.95);
  });
});
