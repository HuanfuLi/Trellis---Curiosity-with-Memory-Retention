// TS-01 (Phase 43-02) — source-reading invariant for the trim-presentation-
// style-tag operator-bounded simplification.
//
// CONTEXT: Folded operator scope (2026-05-11) — "tiles already too rich; we
// should simplify". The "NEWS" pill rendered in InfoFlow.tsx's news-card
// bottom-tags flex row was the ONLY presentation-style chip in the feed
// (image, text-art, video, connection, milestone tiles have no equivalent
// tag). This test locks the absence in BOTH the code and the locale bundles
// so a future tile-richness regression can't silently re-add it.
//
// Pattern follows tests/components/InfoFlow.video-tap-emit.test.mjs
// (readFileSync + grep-style negative + positive assertions).
//
// See:
//   .planning/phases/43-engagement-ui/43-CONTEXT.md §TS-01
//   .planning/phases/43-engagement-ui/43-UI-SPEC.md §10
//   .planning/phases/43-engagement-ui/43-RESEARCH.md §10
//   .planning/phases/43-engagement-ui/43-VALIDATION.md (TS-01 row)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

function readSource(rel) {
  return readFileSync(path.join(appRoot, rel), 'utf8');
}

test('TS-01: infoFlow.newsTag is removed from InfoFlow.tsx', () => {
  const src = readSource('src/components/InfoFlow.tsx');
  const newsTagRefs = (src.match(/infoFlow\.newsTag/g) || []).length;
  assert.strictEqual(
    newsTagRefs,
    0,
    'InfoFlow.tsx must not reference infoFlow.newsTag (TS-01 — operator-bounded simplification)',
  );

  const bareNewsTagRefs = (src.match(/\bnewsTag\b/g) || []).length;
  assert.strictEqual(
    bareNewsTagRefs,
    0,
    'InfoFlow.tsx must not contain the string "newsTag" anywhere',
  );
});

test('TS-01: surrounding "Bottom tags" flex container preserved', () => {
  const src = readSource('src/components/InfoFlow.tsx');
  // The flex container that previously held the news chip + sourceQuestionTitles
  // chip must STILL exist. Without this, we deleted too much.
  assert.match(
    src,
    /display:\s*['"]flex['"][^}]*flexWrap:\s*['"]wrap['"]/,
    'Flex container that held the news-tag (and still holds sourceQuestionTitles chip) must survive TS-01',
  );
});

test('TS-01: sourceQuestionTitles chip rendering preserved', () => {
  const src = readSource('src/components/InfoFlow.tsx');
  assert.match(
    src,
    /sourceQuestionTitles\?\.slice/,
    'sourceQuestionTitles chip code path must remain (TS-01 only removes the NEWS pill, not adjacent chips)',
  );
});

test('TS-01: newsTag key removed from all 4 locale bundles', () => {
  for (const locale of ['en', 'zh', 'es', 'ja']) {
    const src = readSource(`src/locales/${locale}.json`);
    const refs = (src.match(/"newsTag"/g) || []).length;
    assert.strictEqual(
      refs,
      0,
      `${locale}.json must not contain "newsTag" key (TS-01)`,
    );
  }
});
