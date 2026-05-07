/**
 * Guards the Phase 33 UAT-4 fix (2026-04-20): AskScreen's messages
 * container MUST declare `overscrollBehavior: 'contain'` and
 * `WebkitOverflowScrolling: 'touch'` alongside `overflowY: 'auto'`.
 *
 * Without `contain`, the default `overscroll-behavior: auto` fires the
 * native elastic bounce at scroll boundaries. The bounce absorbs the
 * first reversing swipe after a boundary hit, so users needed two
 * gestures to change scroll direction — the "swipe down twice to go
 * back down" symptom users reported on AskScreen with keyboard open.
 *
 * App convention (established in App.tsx:155-156, 172-173, 185-186,
 * HomeScreen, InfoFlow) pairs both properties on every scroll region.
 * AskScreen was the lone outlier until this fix.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/screens/AskScreen.tsx', import.meta.url),
  'utf-8',
);

describe('AskScreen messages container scroll-containment', () => {
  it('messages scroll region uses the app-wide contain + touch pattern', () => {
    // Locate the messages container (scrollContainerRef). It is the only
    // ref'd scrollable region in AskScreen.
    const idx = source.indexOf('ref={scrollContainerRef}');
    assert.ok(idx !== -1, 'AskScreen.tsx should contain ref={scrollContainerRef} on the messages div');

    // Capture the surrounding JSX tag.
    const tagStart = source.lastIndexOf('<div', idx);
    const tagEnd = source.indexOf('>', idx);
    const tag = source.slice(tagStart, tagEnd + 1);

    assert.ok(
      /overflowY:\s*['"]auto['"]/.test(tag),
      'messages div must retain overflowY: auto (it is the legitimate scroll container inside AskScreen)',
    );
    assert.ok(
      /overscrollBehavior:\s*['"]contain['"]/.test(tag),
      'messages div must set overscrollBehavior: "contain" — prevents native elastic bounce from absorbing reversing swipes at scroll boundaries',
    );
    assert.ok(
      /WebkitOverflowScrolling:\s*['"]touch['"]/.test(tag),
      'messages div must set WebkitOverflowScrolling: "touch" — matches the pattern used in App.tsx, HomeScreen, InfoFlow',
    );
  });
});
