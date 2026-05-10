// Phase 42 UAT-6 (3B, 2026-05-09) — text-art tightener regression guard.
//
// `tightenTextArtContent` is private to concept-feed.service.ts. We test by
// reading the source and asserting:
//   - the helper exists with the expected name + signature
//   - the LLM prompt asserts "EXACTLY ONE sentence (≤ 80 characters)"
//   - the fallback path uses `teaser.hook` not `teaser.preview` (preview is
//     multi-sentence and was the primary cause of the long text-art tiles
//     reported in operator screenshot 2026-05-09)
//
// We don't import the function directly because the file imports many
// browser-only modules that don't load under bare node:test. Source-reading
// keeps this test fast and deterministic, matching the project's existing
// MasonryFeed.layout.test.mjs pattern.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CFS_PATH = resolve(__dirname, '../../src/services/concept-feed.service.ts');
const source = readFileSync(CFS_PATH, 'utf-8');

describe('text-art content tightener (Phase 42 UAT-6, 3B)', () => {
  it('declares the tightenTextArtContent helper', () => {
    assert.ok(
      /function\s+tightenTextArtContent\s*\(\s*raw\s*:\s*string\s*\)/.test(source),
      'concept-feed.service.ts must declare `function tightenTextArtContent(raw: string): string | null`. ' +
      'This is the post-LLM validator that strips trailing extra sentences and truncates ≤ 80 chars.',
    );
  });

  it('LLM prompt requires EXACTLY ONE sentence ≤ 80 characters', () => {
    assert.ok(
      /EXACTLY ONE sentence \(≤ 80 characters\)/.test(source),
      'concept-feed.service.ts text-art prompt must include the exact rule line ' +
      '"EXACTLY ONE sentence (≤ 80 characters)". Operator 2026-05-09: text-art was wrapping ' +
      '4+ lines in half-width masonry tiles ("Why the Smell of Safety Makes AI Unsafe").',
    );
  });

  it('fallback path uses teaser.hook (not teaser.preview which is multi-sentence)', () => {
    // Match the specific fallback-construction line. After 3B, the FIRST `const fallback`
    // assignment in the file must read from p.teaser.hook, not p.teaser.preview.
    // Other occurrences of teaser.preview elsewhere in concept-feed.service.ts (e.g.,
    // image-prompt building, news essay extraction) are legitimately different code paths.
    const fallbackMatch = source.match(/const fallback = p\.teaser\.[a-z]+/);
    assert.ok(fallbackMatch, 'concept-feed.service.ts text-art fallback must construct a `const fallback` from p.teaser.*');
    assert.ok(
      /p\.teaser\.hook/.test(fallbackMatch[0]),
      `text-art fallback must use p.teaser.hook (got: ${fallbackMatch[0]}). ` +
      `p.teaser.preview is the multi-sentence summary and produced the over-long text-art tiles ` +
      `reported in operator screenshot 2026-05-09.`,
    );
    assert.ok(
      !/p\.teaser\.preview/.test(fallbackMatch[0]),
      `text-art fallback must NOT reference p.teaser.preview (got: ${fallbackMatch[0]}). ` +
      `Use p.teaser.hook (single-sentence by construction).`,
    );
  });

  it('runs the tightener on both LLM responses AND the fallback path', () => {
    const callCount = (source.match(/tightenTextArtContent\(/g) || []).length;
    assert.ok(
      callCount >= 2,
      `tightenTextArtContent must be called at least twice (once on LLM response, once on the ` +
      `fallback construction; helper definition itself doesn't count). Found ${callCount} call(s). ` +
      `Without the fallback-side call, multi-sentence hook strings still bypass the contract.`,
    );
  });
});
