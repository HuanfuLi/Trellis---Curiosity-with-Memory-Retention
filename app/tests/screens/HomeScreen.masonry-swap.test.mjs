// Phase 42 MASONRY-01 + MASONRY-02 (Plan 42-02) source-reading guard:
// asserts that HomeScreen.tsx wires <MasonryFeed> instead of <InlineInfoFlow>
// at the feed slot, deletes the noMorePosts toast (D-11), and computes
// `allExplored` locally for the celebration card (RESEARCH.md Pitfall 2).
//
// Source-reading test (no React render harness needed) — same pattern as
// app/tests/screens/HomeScreen.warm-start-guard.test.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_SCREEN_PATH = resolve(__dirname, '../../src/screens/HomeScreen.tsx');
const source = readFileSync(HOME_SCREEN_PATH, 'utf-8');

describe('HomeScreen MasonryFeed swap (Phase 42 Plan 42-02)', () => {
  it('does NOT import InlineInfoFlow anymore', () => {
    // The InlineInfoFlow named import must be removed from any import statement
    // sourced from '../components/InfoFlow'. Type-only `InfoFlowItem` import stays.
    const importLine = /import\s*\{[^}]*\bInlineInfoFlow\b[^}]*\}\s*from\s*['"][^'"]*InfoFlow['"]/;
    assert.ok(
      !importLine.test(source),
      'HomeScreen.tsx must NOT import `InlineInfoFlow` from ../components/InfoFlow. Plan 42-02 swaps the feed slot to <MasonryFeed>; InlineInfoFlow remains EXPORTED from InfoFlow.tsx (D-01) but is no longer wired at /home.',
    );
  });

  it('imports MasonryFeed from ../components/MasonryFeed', () => {
    const importLine = /import\s*\{[^}]*\bMasonryFeed\b[^}]*\}\s*from\s*['"]\.\.\/components\/MasonryFeed['"]/;
    assert.ok(
      importLine.test(source),
      'HomeScreen.tsx must import `MasonryFeed` from ../components/MasonryFeed (per plan 42-02 EDIT 1).',
    );
  });

  it('preserves the type-only InfoFlowItem import (still needed for infoFlowItems typing)', () => {
    assert.ok(
      /\btype\s+InfoFlowItem\b/.test(source),
      'HomeScreen.tsx must still import `type InfoFlowItem` from ../components/InfoFlow — the infoFlowItems useMemo declares its return type as InfoFlowItem[].',
    );
  });

  it('does NOT use <InlineInfoFlow ... /> in JSX', () => {
    assert.ok(
      !source.includes('<InlineInfoFlow'),
      'HomeScreen.tsx must not render <InlineInfoFlow>. Plan 42-02 swaps the JSX site to <MasonryFeed>.',
    );
  });

  it('renders <MasonryFeed ... /> in JSX', () => {
    assert.ok(
      source.includes('<MasonryFeed'),
      'HomeScreen.tsx must render <MasonryFeed> at the feed slot (plan 42-02 EDIT 4).',
    );
  });

  it('passes allExplored prop to <MasonryFeed>', () => {
    // The MasonryFeed JSX block must include `allExplored={allExplored}` (or any
    // expression form referencing the variable). We assert at minimum the literal
    // `allExplored=` appears within ~600 chars after the opening MasonryFeed tag.
    const idx = source.indexOf('<MasonryFeed');
    assert.ok(idx >= 0, 'MasonryFeed JSX must exist (precondition for prop check).');
    const window = source.slice(idx, idx + 600);
    assert.ok(
      /allExplored\s*=/.test(window),
      'HomeScreen.tsx must pass `allExplored={...}` to <MasonryFeed> so the placeholder VineBloomCard (plan 42-04) can gate its render on the locally-computed flag.',
    );
  });

  it('declares an `allExplored` binding (computed locally per RESEARCH.md Pitfall 2)', () => {
    // Either `const allExplored = ...` or `const allExplored = useMemo(...)` form.
    assert.ok(
      /\bconst\s+allExplored\b/.test(source),
      'HomeScreen.tsx must declare a local `const allExplored` binding (RESEARCH.md Pitfall 2 — service does NOT expose allExplored; HomeScreen must compute it from `dailyReadService.getExploredAnchors()` + `questions.filter(q => q.isAnchorNode)`).',
    );
  });

  it('computes allExplored from anchors + exploredAnchors (RESEARCH.md Pitfall 2 verbatim shape)', () => {
    // Acceptable shapes: anchors.every(a => exploredAnchors.includes(a.id))
    // OR an inline filter on q.isAnchorNode + .every / .includes pattern.
    // Loosen: assert both `isAnchorNode` and `.every(` appear within 400 chars
    // of the allExplored declaration.
    const idx = source.indexOf('const allExplored');
    assert.ok(idx >= 0, 'allExplored binding must exist (precondition).');
    const window = source.slice(idx, idx + 400);
    assert.ok(
      window.includes('isAnchorNode'),
      'allExplored computation must reference `q.isAnchorNode` (RESEARCH.md Pitfall 2 verbatim — anchors = questions.filter(q => q.isAnchorNode)).',
    );
    assert.ok(
      window.includes('.every('),
      'allExplored computation must use `.every(` over the anchors array (RESEARCH.md Pitfall 2 verbatim — anchors.length > 0 && anchors.every(a => exploredAnchors.includes(a.id))).',
    );
    assert.ok(
      window.includes('exploredAnchors'),
      'allExplored computation must read from the existing `exploredAnchors` state (no duplicate state introduced — reuses lines 467 + 514 pattern).',
    );
  });

  it('deletes the noMorePosts toast call (D-11)', () => {
    // The literal `home.toast.noMorePosts` translation key must NOT appear.
    assert.ok(
      !source.includes('home.toast.noMorePosts'),
      'HomeScreen.tsx must NOT call `toast(t(\'home.toast.noMorePosts\'), \'info\')` anymore (D-11). The vine-bloom celebration card (plan 42-04) replaces this surface.',
    );
    assert.ok(
      !source.includes('noMorePosts'),
      'HomeScreen.tsx must NOT contain any `noMorePosts` reference at all — the toast deletion must be complete.',
    );
  });

  it('preserves the other toast calls in HomeScreen (only noMorePosts was deleted)', () => {
    // toast(t('home.feed.creditToast'), 'success') in the celebration useEffect
    // must still exist — sanity check that we didn't accidentally delete every toast.
    assert.ok(
      source.includes("toast(t('home.feed.creditToast')"),
      'HomeScreen.tsx must still contain the celebration `toast(t(\'home.feed.creditToast\'), \'success\')` — only `home.toast.noMorePosts` was scoped for deletion.',
    );
  });
});
