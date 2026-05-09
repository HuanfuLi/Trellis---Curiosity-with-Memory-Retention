// Phase 41 Plan 41-02 — post-essay-depth source-reading + behavioral assertions.
//
// Covers SC-3 (depth: 'deep' produces 350-600w; standard bands preserved per generator),
// SC-4 (generateNewsEssay consumes sources.slice(0, 3) for multi-snippet grounding),
// SC-5(a) (LLM news prompt contains footnote instruction with [^1] / [^2] / [^3] markers
// + footnote section emission), SC-6 (generateEssayMeta body slice cap raised 2000→4000),
// AND a behavioral merge test for patchPostEssayInCache (Task 3 — bodyMarkdownDeep
// merge does not clobber existing standard bodyMarkdown).
//
// Strategy per RESEARCH § Pitfall 5: dual-test (source-reading + behavioral). Source-reading
// locks the contract; the merge behavioral test exercises the localStorage round-trip.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../../src/services/post-essay.service.ts', import.meta.url), 'utf8');

// ─── SC-3 source-reading ────────────────────────────────────────────────────

test('SC-3: all 4 generators present in post-essay.service.ts', () => {
  for (const name of ['generateStandardEssay', 'generateVideoEssay', 'generateNewsEssay', 'generateTextArtEssay']) {
    assert.ok(SRC.includes(name), `generator ${name} must exist`);
  }
});

test("SC-3: depth knob branched in each generator (options?.depth ?? 'standard' pattern)", () => {
  // 4 generators × `options?.depth ?? 'standard'` pattern → ≥4 occurrences
  const matches = [...SRC.matchAll(/options\?\.depth \?\? 'standard'/g)];
  assert.ok(matches.length >= 4, `expected ≥4 depth branches, got ${matches.length}`);
});

test('SC-3: deep band 350-600 referenced in all 4 generators', () => {
  // Each generator's deep branch contains the "350-600" word-count band.
  const matches = [...SRC.matchAll(/350-600/g)];
  assert.ok(matches.length >= 4, `expected ≥4 occurrences of 350-600 (one per generator deep branch), got ${matches.length}`);
});

test('SC-3: standard bands preserved per generator', () => {
  assert.match(SRC, /200-350/, 'standard band preserved');
  assert.match(SRC, /200-400/, 'video band preserved');
  assert.match(SRC, /150-250/, 'news band preserved');
  assert.match(SRC, /80-120/, 'text-art band preserved');
});

// ─── SC-4 source-reading ────────────────────────────────────────────────────

test('SC-4: generateNewsEssay consumes sources.slice(0, 3)', () => {
  const newsStart = SRC.indexOf('async function* generateNewsEssay');
  const textArtStart = SRC.indexOf('async function* generateTextArtEssay');
  assert.ok(newsStart >= 0, 'generateNewsEssay must exist');
  assert.ok(textArtStart > newsStart, 'generateTextArtEssay must come after generateNewsEssay');
  const newsBlock = SRC.slice(newsStart, textArtStart);
  assert.match(newsBlock, /sources\.slice\(0, 3\)/, 'news essay must consume sources.slice(0, 3) for multi-snippet grounding');
});

// ─── SC-5(a) source-reading ─────────────────────────────────────────────────

test('SC-5(a): generateNewsEssay system prompt contains footnote instruction with [^1]/[^2]/[^3] markers', () => {
  const newsStart = SRC.indexOf('async function* generateNewsEssay');
  const textArtStart = SRC.indexOf('async function* generateTextArtEssay');
  const newsBlock = SRC.slice(newsStart, textArtStart);
  assert.match(newsBlock, /\[\^1\]/, 'news prompt must reference [^1] footnote marker');
  assert.match(newsBlock, /\[\^2\]/, 'news prompt must reference [^2] footnote marker');
  assert.match(newsBlock, /\[\^3\]/, 'news prompt must reference [^3] footnote marker');
  assert.match(newsBlock, /footnotes section/i, 'news prompt must instruct emission of a footnotes section');
});

// ─── SC-6 source-reading ────────────────────────────────────────────────────

test('SC-6: generateEssayMeta body slice cap raised to 4000', () => {
  assert.match(SRC, /bodyMarkdown\.slice\(0, 4000\)/, 'meta cap must be 4000');
  // Counterweight: old cap 2000 must be gone.
  assert.ok(!SRC.includes('bodyMarkdown.slice(0, 2000)'), 'old 2000 cap must be removed');
});

// ─── Counterweight: signal threading preserved on each generator ────────────

test('counterweight: each generator threads options?.signal into chatStream', () => {
  // The Phase 35 signal-threading discipline must remain intact even after the
  // depth knob lands. Count 'signal: options?.signal' occurrences — at least 5
  // (4 generators + generateEssayMeta).
  const matches = [...SRC.matchAll(/signal: options\?\.signal/g)];
  assert.ok(matches.length >= 5, `expected ≥5 signal-threaded chatStream calls, got ${matches.length}`);
});

// NOTE: Task 3 (patchPostEssayInCache selective-merge behavioral tests) is appended
// to this file in the next task commit — see plan task 3 acceptance criteria.
