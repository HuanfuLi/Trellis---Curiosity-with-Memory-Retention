// Phase 39 — engagement anti-wire SOURCE-READING invariant test (D-06 STATIC HALF).
//
// Walks every .ts/.tsx file under app/src/ and asserts no single file contains
// BOTH `eventBus.emit({ type: 'ANCHOR_DISMISSED' ... })` and
// `eventBus.emit({ type: 'CONCEPT_EXPLORED' ... })` within the same 800-char
// window — a pragmatic over-approximation of "same function body" matching
// the prior-art pattern in useQuestions-system-prompt-stability.test.mjs.
//
// Defense-in-depth: the BEHAVIORAL HALF lives in engagement.service.test.mjs
// (case 6 — captured event log on a dismissAnchor call); the static half here
// catches BOTH (a) an unreachable code path that the behavioral test wouldn't
// load, AND (b) a future contributor wiring a co-emit through a separate handler.
//
// Counterweight assertion: also asserts that engagement.service.ts IS in the
// scan list AND DOES contain at least one anchor-dismiss emit. Without this,
// a future refactor that deletes the engagement service would silently leave
// the co-emit scan with nothing to scan, producing a false-pass.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src');
const ENGAGEMENT_SERVICE = resolve(SRC, 'services/engagement.service.ts');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      // Skip generated/build/test directories
      if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') continue;
      out.push(...walk(p));
      continue;
    }
    if (!s.isFile()) continue;
    if (!(p.endsWith('.ts') || p.endsWith('.tsx'))) continue;
    // Skip test/spec files (these reference the events for assertions, not real wiring)
    if (/\.(test|spec)\.(ts|tsx|mjs|js)$/.test(name)) continue;
    out.push(p);
  }
  return out;
}

const ALL_TS = walk(SRC);

const DISMISS_RE = /eventBus\.emit\(\s*\{\s*type:\s*['"]ANCHOR_DISMISSED['"]/g;
const EXPLORED_RE = /eventBus\.emit\(\s*\{\s*type:\s*['"]CONCEPT_EXPLORED['"]/g;
const WINDOW = 800;

function findAll(re, text) {
  const matches = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    matches.push(m.index);
  }
  return matches;
}

test('engagement.service.ts emits an anchor-dismiss event at least once (counterweight — proves the scan reaches the target file)', () => {
  // Confirms the scan list contains the engagement service file.
  assert.ok(
    ALL_TS.includes(ENGAGEMENT_SERVICE),
    `engagement-anti-wire scan must include ${relative(SRC, ENGAGEMENT_SERVICE)} — otherwise the co-emit scan has nothing to scan and silently passes`,
  );
  // Confirms the engagement service still emits the dismiss event (catches a
  // future refactor that removes the emit site).
  const source = readFileSync(ENGAGEMENT_SERVICE, 'utf8');
  const dismissMatches = findAll(DISMISS_RE, source);
  assert.ok(
    dismissMatches.length >= 1,
    'engagement.service.ts must contain at least one eventBus.emit({ type: \'ANCHOR_DISMISSED\' ... }) — Phase 39 D-05',
  );
});

test('no source file under app/src/ contains both anchor-dismiss and explored emit sites within the same 800-char window (D-06)', () => {
  const offenders = [];
  for (const file of ALL_TS) {
    const source = readFileSync(file, 'utf8');
    const dismissMatches = findAll(DISMISS_RE, source);
    const exploredMatches = findAll(EXPLORED_RE, source);
    if (dismissMatches.length === 0 || exploredMatches.length === 0) continue;
    // Check pairwise: any dismiss within WINDOW of any explored is a violation,
    // regardless of which one comes first.
    for (const d of dismissMatches) {
      for (const e of exploredMatches) {
        if (Math.abs(d - e) <= WINDOW) {
          offenders.push({ file: relative(SRC, file), dismissOffset: d, exploredOffset: e });
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} file(s) contain both ANCHOR_DISMISSED and CONCEPT_EXPLORED emit sites within an 800-char window — D-06 forbids co-emission. Move the second emit to a separate function or revert one of the two.\n${offenders.map(o => `  - ${o.file} (dismiss@${o.dismissOffset}, explored@${o.exploredOffset})`).join('\n')}`,
  );
});
