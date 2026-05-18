// Phase 50 gap closure 50-12 (G6). Enforces 50-VALIDATION.md row 4: tab switch
// on /saved preserves the search-bar query and rescopes results. Tab change
// still clears filters + debounce timer (Pitfall 8 mitigation), but NOT the
// user-typed query. Source-reading only — no DOM render. Helpers extract the
// targeted useEffect / useCallback bodies so the regex scope does not catch the
// legitimate clearAllFilters path.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..', '..');

const readSrc = (rel) => readFileSync(path.join(appRoot, rel), 'utf8');

/**
 * Extract the useEffect body whose dependency array is [activeTab].
 * Returns the substring from `useEffect(() => {` through `}, [activeTab]);`.
 */
function extractTabChangeEffect(src) {
  // Match the effect with [activeTab] deps — non-greedy to get the first match.
  const match = src.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?\},\s*\[activeTab\]\s*\)/);
  assert.ok(match, 'Could not locate the useEffect(..., [activeTab]) block in SavedScreen.tsx');
  return match[0];
}

/**
 * Extract the clearAllFilters useCallback body.
 * Returns the substring from `const clearAllFilters = useCallback(` through
 * the closing `}, [])`.
 */
function extractClearAllFilters(src) {
  const match = src.match(/const\s+clearAllFilters\s*=\s*useCallback\([\s\S]*?\},\s*\[\]\s*\)/);
  assert.ok(match, 'Could not locate the clearAllFilters useCallback block in SavedScreen.tsx');
  return match[0];
}

test('TPQ-01: tab-change useEffect contains clearTimeout(debounceRef.current) — Pitfall 8 timer flush preserved', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  const block = extractTabChangeEffect(src);
  assert.match(block, /clearTimeout\(debounceRef\.current\)/,
    'Tab-change effect must flush the pending debounce timer (Pitfall 8 mitigation).');
});

test('TPQ-02: tab-change useEffect resets all 3 filter chips (concept/source/date)', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  const block = extractTabChangeEffect(src);
  assert.match(block, /setFilterConcept\(null\)/,
    'Tab-change effect must clear filterConcept.');
  assert.match(block, /setFilterSource\(null\)/,
    'Tab-change effect must clear filterSource.');
  assert.match(block, /setFilterDate\(['"]all['"]\)/,
    'Tab-change effect must reset filterDate to "all".');
});

test('TPQ-03: tab-change useEffect does NOT clear query or inputDraft — G6 fix (50-VALIDATION.md row 4)', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  const block = extractTabChangeEffect(src);
  assert.doesNotMatch(block, /setQuery\(['"]{2}\)/,
    'Tab-change effect must NOT call setQuery(\'\') — query persists across tab change per 50-VALIDATION.md row 4.');
  assert.doesNotMatch(block, /setInputDraft\(['"]{2}\)/,
    'Tab-change effect must NOT call setInputDraft(\'\') — input draft persists across tab change per 50-VALIDATION.md row 4.');
});

test('TPQ-04: source contains provenance reference to 50-VALIDATION.md row 4 near tab-change effect', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  assert.match(src, /50-VALIDATION\.md\s+row\s+4/,
    'Source must reference "50-VALIDATION.md row 4" so future readers understand the design decision.');
});

test('TPQ-05: clearAllFilters callback STILL clears query + inputDraft (explicit user action preserved)', () => {
  const src = readSrc('src/screens/SavedScreen.tsx');
  const block = extractClearAllFilters(src);
  assert.match(block, /setQuery\(['"]{2}\)/,
    'clearAllFilters must still call setQuery(\'\') — the "Clear filters" button is an explicit user action.');
  assert.match(block, /setInputDraft\(['"]{2}\)/,
    'clearAllFilters must still call setInputDraft(\'\') — the "Clear filters" button is an explicit user action.');
});
