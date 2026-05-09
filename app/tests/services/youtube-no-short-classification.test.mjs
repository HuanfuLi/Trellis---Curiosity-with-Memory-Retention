// Phase 38 (TECHDEBT-06) regression guard: ensures the YouTube short post type
// and its classifier (the portrait-probe helper + sourceType 'short') stay deleted.
//
// Why this exists: per .planning/phases/38-v1-4-carry-over-cleanup/38-CONTEXT.md
// D-02, the short/video classification was DROPPED entirely (not improved). The
// honest reasoning: thumbnail aspect ratio is uncorrelated with video orientation,
// and YouTube API quota is too tight for videos.list?part=contentDetails calls.
// The "landscape video listed as short" bug (TECHDEBT-06) was eliminated by
// removing the classifier — there is no classifier to be wrong.
//
// Future agents may be tempted to re-introduce a classifier (image-probe heuristic,
// shorts-tag query, or any other detection mechanism). This test fires if any of
// them do.
//
// See also:
//   - .planning/phases/38-v1-4-carry-over-cleanup/38-RESEARCH.md § INV-1
//   - CLAUDE.md "Video post completion signals (Phase 36 GAP-C, generalized in Phase 38)" section.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YOUTUBE_PATH = resolve(__dirname, '../../src/services/youtube.service.ts');
const CONCEPT_FEED_PATH = resolve(__dirname, '../../src/services/concept-feed.service.ts');
const STYLE_ASSIGNMENT_PATH = resolve(__dirname, '../../src/services/style-assignment.ts');

const youtubeSource = readFileSync(YOUTUBE_PATH, 'utf-8');
const conceptFeedSource = readFileSync(CONCEPT_FEED_PATH, 'utf-8');
const styleAssignmentSource = readFileSync(STYLE_ASSIGNMENT_PATH, 'utf-8');

describe('YouTube no-short classification invariant (Phase 38 / TECHDEBT-06)', () => {
  it('the portrait-probe helper is deleted from youtube.service.ts (no classifier)', () => {
    assert.ok(
      !youtubeSource.includes('probePortrait'),
      `youtube.service.ts must NOT contain probePortrait — the short classifier was removed in Phase 38 (TECHDEBT-06). ` +
      `If you need to detect portrait videos, that decision was explicitly rejected in 38-CONTEXT.md D-02 ` +
      `(YouTube API quota too tight; thumbnail aspect ratio uncorrelated with video orientation).`
    );
  });

  it("sourceType: 'short' literal is absent from concept-feed.service.ts (no short post construction)", () => {
    // Match the shape: `sourceType: 'short'` with optional whitespace; also matches `sourceType: "short"`.
    const matches = conceptFeedSource.match(/sourceType:\s*['"]short['"]/g) || [];
    assert.equal(
      matches.length,
      0,
      `concept-feed.service.ts must NOT assign sourceType: 'short' anywhere — the short post type was removed in Phase 38. ` +
      `Found ${matches.length} occurrences. All YouTube content uses sourceType: 'video'.`
    );
  });

  it("presentationStyle: 'short' literal is absent from concept-feed.service.ts (no short presentation style)", () => {
    const matches = conceptFeedSource.match(/presentationStyle:\s*['"]short['"]/g) || [];
    assert.equal(
      matches.length,
      0,
      `concept-feed.service.ts must NOT assign presentationStyle: 'short' anywhere — the short presentation style was removed in Phase 38. ` +
      `Found ${matches.length} occurrences.`
    );
  });

  it("STYLE_WEIGHTS in style-assignment.ts has no 'short' key AND values sum to 1.0", () => {
    // Match a key like:    'short': 0.10    or    short: 0.10
    // (inside the STYLE_WEIGHTS object literal — best-effort regex; broad enough to catch reintroduction)
    const shortKeyMatches = styleAssignmentSource.match(/['"]?short['"]?\s*:\s*\d+(\.\d+)?/g) || [];
    assert.equal(
      shortKeyMatches.length,
      0,
      `style-assignment.ts must NOT contain a 'short' key in STYLE_WEIGHTS or anywhere with a numeric value. ` +
      `Found ${shortKeyMatches.length} occurrences. Phase 38 removed short and absorbed its 0.10 weight into video (now video: 0.20).`
    );

    // Sum check — find the STYLE_WEIGHTS object literal body and extract per-line key:value pairs.
    // The previous attempt scanned every numeric literal in the block (including in comments),
    // which double-counted documentation values like "absorbed short's 0.10". Anchor on the
    // `key: 0.NN` pattern instead so doc comments are ignored.
    const blockMatch = styleAssignmentSource.match(/STYLE_WEIGHTS[^{]*\{([\s\S]*?)\}/);
    assert.ok(blockMatch, 'STYLE_WEIGHTS object literal must be findable in style-assignment.ts.');
    const blockBody = blockMatch[1];
    // Strip line comments so any "// 0.10" trailers don't get counted.
    const cleaned = blockBody.replace(/\/\/.*$/gm, '');
    // Match `key: value` pairs where key is a quoted or bare identifier and value is a decimal.
    const pairMatches = cleaned.match(/['"]?[\w-]+['"]?\s*:\s*(\d+(?:\.\d+)?)/g) || [];
    const numbers = pairMatches.map((pair) => Number(pair.split(':')[1].trim()));
    const sum = numbers.reduce((a, b) => a + b, 0);
    assert.ok(
      Math.abs(sum - 1.0) < 1e-9,
      `STYLE_WEIGHTS values must sum to 1.0 (within 1e-9 float tolerance). Found sum = ${sum}. ` +
      `If you removed or added a weight, redistribute to keep sum=1.0 (per CLAUDE.md "Concept Feed Generation Pipeline" stratification math).`
    );
  });
});
