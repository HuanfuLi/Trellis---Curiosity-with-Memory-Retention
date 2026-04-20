/**
 * Guards the Phase 33 UAT-4 fix (2026-04-20) for the Ask keyboard-deform
 * bug. The true root cause was that the SwipeTabContainer strip is
 * 500vw wide (5 slots × 100vw) but the document had NO `overflow-x:
 * hidden`. When Android WebView's keyboard opened on a focused input
 * inside an off-center slot, Chromium's scrollIntoView shifted
 * document.scrollLeft — the whole app visibly drifted left. On close,
 * scrollLeft was not reset, so the drift persisted until a route change
 * re-layouted.
 *
 * Three layers of defense. This test pins all three:
 *   1. index.css: html, body { overflow-x: hidden } — primary structural fix
 *   2. App.tsx root div: overflowX: 'hidden' — React-layer belt-and-suspenders
 *   3. SwipeTabContainer onFocusOut: document.scrollingElement.scrollLeft = 0 — recovery path
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexCss = fs.readFileSync(
  new URL('../../src/index.css', import.meta.url),
  'utf-8',
);
const appTsx = fs.readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf-8',
);
const swipeTab = fs.readFileSync(
  new URL('../../src/components/SwipeTabContainer.tsx', import.meta.url),
  'utf-8',
);

describe('root horizontal overflow clip', () => {
  it('index.css clips horizontal overflow on html + body', () => {
    assert.ok(
      /html,\s*body\s*\{\s*overflow-x:\s*hidden/.test(indexCss),
      'index.css must declare `html, body { overflow-x: hidden }` — the strip is 500vw wide and would otherwise make the document horizontally scrollable, allowing keyboard-triggered scrollIntoView to shift the whole app left',
    );
  });

  it('App.tsx root div has overflowX: "hidden" as React-layer belt-and-suspenders', () => {
    // The outermost wrapper directly around SwipeTabContainer.
    assert.ok(
      /minHeight:\s*['"]100vh['"][^}]*overflowX:\s*['"]hidden['"]/.test(appTsx)
      || /overflowX:\s*['"]hidden['"][^}]*minHeight:\s*['"]100vh['"]/.test(appTsx),
      'App.tsx root div must set overflowX: "hidden" alongside minHeight: "100vh" — defense-in-depth if index.css rule is lost',
    );
  });

  it('SwipeTabContainer onFocusOut resets document.scrollLeft as recovery path', () => {
    const idx = swipeTab.indexOf('const onFocusOut');
    assert.ok(idx !== -1, 'SwipeTabContainer.tsx should contain const onFocusOut');
    const body = swipeTab.slice(idx, idx + 1200);

    assert.ok(
      /document\.scrollingElement/.test(body),
      'onFocusOut must reference document.scrollingElement for scrollLeft reset — the keyboard-scroll-into-view recovery path',
    );
    assert.ok(
      /scrollLeft\s*=\s*0/.test(body),
      'onFocusOut must set scrollLeft = 0 to recover any horizontal drift',
    );
  });
});
