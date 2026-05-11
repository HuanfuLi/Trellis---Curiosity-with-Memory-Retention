// Phase 43 Plan 43-05 — DD-04 source-reading invariants for the Standard | Deep
// segmented toggle on PostDetailScreen.
//
// What this guards (dedicated file per VALIDATION.md line 53):
//   - Segmented control only renders when post.bodyMarkdownDeep is non-empty
//     (post-Deep-dive completion OR post-cache hydration)
//   - Tapping either segment is purely client-side state — no re-stream,
//     no generatePostEssay call, no handleStartDeepDive call
//   - Active-segment visual matches UI-SPEC §9: var(--primary-40) bg + #FFFFFF text
//   - role="tablist" + aria-selected + minHeight 44px (WCAG 2.5.8 floor)
//   - Both i18n keys posts.detail.deepDive.toggleStandard + toggleDeep referenced
//     once each inside the segmented-control render branch
//
// DD-01..DD-03 live in deep-dive-trigger.test.mjs; DD-05 in abort-contract.test.mjs.
// Failure attribution: a DD-04 regression breaks THIS file only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');
const src = readFileSync(path.join(appRoot, 'src/screens/PostDetailScreen.tsx'), 'utf8');

test('DD-04: segmented control gated on post.bodyMarkdownDeep length > 0 (only renders post-Deep-dive completion)', () => {
  // The renderDeepDiveControls `deepCached` branch must check both that
  // bodyMarkdownDeep is a string AND that its length is > 0.
  assert.match(
    src,
    /typeof\s+post\.bodyMarkdownDeep\s*===\s*['"]string['"][^}]*post\.bodyMarkdownDeep[^}]*length\s*>\s*0/s,
    'Segmented control gate must check typeof string + length > 0 (DD-04 post-completion gate)',
  );
  // The container element must declare role="tablist" per UI-SPEC §9.
  assert.match(src, /role=["']tablist["']/);
});

test('DD-04: tapping Standard segment sets activeVariant to "standard" without re-streaming', () => {
  // The onClick handler must be a pure setActiveVariant call. The component
  // uses a (['standard', 'deep']).map(variant => ...) loop, so both segments
  // share a `onClick={() => setActiveVariant(variant)}` handler.
  assert.match(src, /onClick=\{\(\)\s*=>\s*setActiveVariant\(variant\)\}/);
  assert.match(src, /posts\.detail\.deepDive\.toggleStandard/);
});

test('DD-04: tapping Deep segment displays cached bodyMarkdownDeep without re-streaming', () => {
  assert.match(src, /posts\.detail\.deepDive\.toggleDeep/);
  // Body-slot conditional renders post.bodyMarkdownDeep when activeVariant === 'deep' AND post.bodyMarkdownDeep present.
  assert.match(src, /activeVariant\s*===\s*['"]deep['"]\s*&&\s*post\.bodyMarkdownDeep/);
});

test('DD-04: segmented control onClick handlers do NOT invoke handleStartDeepDive or generatePostEssay', () => {
  // Locate the segmented-control render branch and confirm it does NOT call
  // handleStartDeepDive or generatePostEssay anywhere within. The branch is
  // bounded by `role="tablist"` (start) and the next `};` followed by the
  // default DeepDiveButton branch.
  const tablistIdx = src.indexOf('role="tablist"');
  assert.ok(tablistIdx > 0, 'role="tablist" must exist in the segmented-control branch');
  // Walk forward until we hit the closing of the .map() / fragment. The
  // DeepDiveButton CTA branch starts with `// DD-02 default` per the source
  // comment block; use it as a stable end anchor.
  const dd02Idx = src.indexOf('// DD-02 default', tablistIdx);
  assert.ok(dd02Idx > tablistIdx, 'DD-02 default branch must follow the tablist branch');
  const region = src.slice(tablistIdx, dd02Idx);
  assert.doesNotMatch(
    region,
    /handleStartDeepDive\(/,
    'Segmented-control onChange must NOT call handleStartDeepDive (DD-04: toggle is purely client-side state)',
  );
  assert.doesNotMatch(
    region,
    /generatePostEssay\(/,
    'Segmented-control onChange must NOT invoke generatePostEssay (DD-04: no re-stream on toggle)',
  );
});

test('DD-04: active-segment indicator matches UI-SPEC §9 (var(--primary-40) bg + #FFFFFF text + aria-selected)', () => {
  // UI-SPEC §9: active segment has backgroundColor: var(--primary-40) and color: #FFFFFF.
  assert.match(src, /backgroundColor:\s*isActive\s*\?\s*['"]var\(--primary-40\)['"]\s*:\s*['"]transparent['"]/);
  assert.match(src, /color:\s*isActive\s*\?\s*['"]#FFFFFF['"]/);
  assert.match(src, /aria-selected=\{isActive\}/);
});

test('DD-04: both segmented-toggle i18n keys referenced exactly once each in source', () => {
  const stdRefs = (src.match(/posts\.detail\.deepDive\.toggleStandard/g) || []).length;
  const deepRefs = (src.match(/posts\.detail\.deepDive\.toggleDeep/g) || []).length;
  assert.strictEqual(
    stdRefs,
    1,
    'posts.detail.deepDive.toggleStandard must be referenced exactly once (Standard segment label)',
  );
  assert.strictEqual(
    deepRefs,
    1,
    'posts.detail.deepDive.toggleDeep must be referenced exactly once (Deep segment label)',
  );
});

test('DD-04: each segment has minHeight 44px (WCAG 2.5.8 touch-target floor)', () => {
  // The segment button declares minHeight: '44px'. The surrounding map() means
  // both Standard and Deep inherit this via the same style object.
  const tablistIdx = src.indexOf('role="tablist"');
  assert.ok(tablistIdx > 0);
  const dd02Idx = src.indexOf('// DD-02 default', tablistIdx);
  const region = src.slice(tablistIdx, dd02Idx);
  assert.match(region, /minHeight:\s*['"]44px['"]/, 'segment buttons must declare minHeight: 44px');
});
