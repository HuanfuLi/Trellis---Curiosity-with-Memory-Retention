// Phase 42 UAT-7+8 (2026-05-09) — inline-play removed from feed cards.
//
// Was: Phase 36 GAP-C regression guard ensuring InfoFlow.tsx fires CONCEPT_EXPLORED
// on video thumbnail tap-to-play (inline play). Phase 38 (TECHDEBT-06) generalized
// the emit to all video posts after dropping the 'short' type.
//
// Now: Phase 42 UAT-7 (operator: "Remove the inline play feature") + UAT-8
// (operator: play icon center-blocking). Inline iframe rendering, the videoPlaying
// state, the close button, the play-icon overlay, and the thumbnail-tap emit have
// all been deleted from InfoFlow.tsx ConceptCard. Video tiles are navigation-only;
// PostDetailScreen owns the iframe AND Detector D (postMessage CONCEPT_EXPLORED on
// play ≥ 80%) for engagement signaling.
//
// This test now LOCKS the absence of all inline-play infrastructure to prevent
// re-introduction. CLAUDE.md "Video post completion signals" section was rephrased
// in the same commit to drop the thumbnail-tap row and reword rule #3.
//
// See .planning/phases/42-masonry-feed-layout/42-HUMAN-UAT.md (UAT-7, UAT-8).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFOFLOW_PATH = resolve(__dirname, '../../src/components/InfoFlow.tsx');
const source = readFileSync(INFOFLOW_PATH, 'utf-8');

describe('InfoFlow video card — inline-play removed (Phase 42 UAT-7+8)', () => {
  it('does NOT call dailyReadService.markExplored from feed cards', () => {
    const matches = source.match(/dailyReadService\.markExplored/g) || [];
    assert.equal(
      matches.length,
      0,
      `InfoFlow.tsx must NOT call dailyReadService.markExplored — Phase 42 UAT-7 removed inline-play. ` +
      `Found ${matches.length} occurrence(s). PostDetailScreen's Detector D (postMessage on play ≥ 80%) ` +
      `is now the SOLE feed-level video engagement signal. Re-introducing the emit here means inline-play ` +
      `is back — which the operator explicitly rejected ("play icon in center, blocking view").`,
    );
  });

  it('does NOT emit CONCEPT_EXPLORED from feed cards', () => {
    const matches = source.match(/type:\s*['"]CONCEPT_EXPLORED['"]/g) || [];
    assert.equal(
      matches.length,
      0,
      `InfoFlow.tsx must NOT emit CONCEPT_EXPLORED — Phase 42 UAT-7 removed inline-play. ` +
      `Found ${matches.length} occurrence(s). Detector D in PostDetailScreen is the sole engagement signal.`,
    );
  });

  it('does NOT render an inline YouTube iframe in the video card', () => {
    assert.ok(
      !/youtube\.com\/embed\//.test(source),
      'InfoFlow.tsx must NOT render an inline YouTube iframe — Phase 42 UAT-7 removed inline-play. ' +
      'The iframe lives exclusively in PostDetailScreen (via YouTubeEmbed.tsx).',
    );
  });

  it('does NOT manage a videoPlaying state in feed cards', () => {
    assert.ok(
      !/videoPlaying/.test(source),
      'InfoFlow.tsx must NOT contain `videoPlaying` state or props — Phase 42 UAT-7 removed inline-play. ' +
      'Re-introducing this state means inline-play is back. Use the parent app router to navigate to ' +
      'PostDetailScreen instead.',
    );
  });

  it('video card thumbnail uses paddingTop hack + transform: scale to crop baked-in YouTube letterbox (UAT-8 round 4)', () => {
    // Round 4 (2026-05-10): the black bars the operator kept seeing are BAKED
    // INTO YouTube's hqdefault.jpg thumbnail (4:3 image with 16:9 video letterboxed
    // → ~12.5% black bars top + bottom). CSS object-fit: cover only crops ~3% L+R
    // for a 4:3 source in a 5:4 container — the vertical bars survive. We zoom
    // into the source with transform: scale(1.34) to crop 16.7% off each top/bottom
    // edge — comfortably past the 12.5% bars with a small safety margin.
    assert.ok(
      /paddingTop:\s*['"]80%['"]/.test(source),
      'InfoFlow.tsx video card must use `paddingTop: "80%"` (4/5 of width = 5:4 visual aspect).',
    );
    assert.ok(
      /position:\s*['"]absolute['"]/.test(source),
      'InfoFlow.tsx video card img must be position: absolute (without it the img collapses ' +
      'inside the padding-only container).',
    );
    assert.ok(
      /objectFit:\s*['"]cover['"]/.test(source),
      'InfoFlow.tsx video card img must use objectFit: cover to crop the source horizontally.',
    );
    assert.ok(
      /transform:\s*['"]scale\(1\.34\)['"]/.test(source),
      'InfoFlow.tsx video card img must use `transform: "scale(1.34)"` to zoom past YouTube\'s ' +
      'baked-in 12.5% letterbox bars on hqdefault.jpg. Without this, operator sees black bars ' +
      'top + bottom (UAT-8 round 4 retest 2026-05-10). 1.34x crops ~16.7% each edge — past the ' +
      '12.5% bars with safety margin. Operator instruction explicitly forbids switching to a ' +
      'different YouTube thumbnail variant (e.g., mqdefault.jpg).',
    );
  });
});
