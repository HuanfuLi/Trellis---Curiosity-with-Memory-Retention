// Phase 42 plan 42-05 — cross-tree no-card-slide-in negative grep.
//
// Locks UI-SPEC invariant #7 + RESEARCH.md Pitfall 7: the `card-slide-in` CSS
// keyframe (formerly in app/src/index.css) and its 3 callsites in InfoFlow.tsx
// (image card, text-art card, video card) were removed in plan 42-03. The
// framer-motion <motion.div> entrance animations inside MasonryFeed.tsx are
// now the SOLE feed-entrance animation system. This test forbids the keyframe
// from being re-introduced anywhere under app/src/.
//
// Pattern B (cross-tree walker). Mirrors
// tests/services/engagement-anti-wire.test.mjs.
//
// Counterweight assertions: confirm the walker reaches at least 50 files AND
// the two known critical files (app/src/index.css + app/src/components/
// InfoFlow.tsx) are in the scan list. Without this, a future refactor that
// breaks the SRC_ROOT path or skips file types could produce a silent
// false-pass.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(__dirname, '../../src');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx|css|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const ALL_SRC_FILES = walk(SRC_ROOT);

describe('card-slide-in keyframe deleted (Phase 42 D-06)', () => {
  // Counterweight — confirm the walker is reaching files (catches scan-list regressions).
  it('walker reaches at least 50 files under app/src (counterweight)', () => {
    assert.ok(
      ALL_SRC_FILES.length >= 50,
      `walker must reach app/src files; found ${ALL_SRC_FILES.length} (expected >= 50). Check walk() / SRC_ROOT path.`,
    );
  });

  // Counterweight — confirm at least one critical file is in the scan list.
  it('walker scan list includes app/src/index.css (counterweight)', () => {
    const indexCss = ALL_SRC_FILES.find((f) => f.endsWith('/src/index.css'));
    assert.ok(
      indexCss,
      'app/src/index.css must be in the scan list — counterweight to catch path regressions.',
    );
  });

  it('walker scan list includes app/src/components/InfoFlow.tsx (counterweight)', () => {
    const infoFlow = ALL_SRC_FILES.find((f) => f.endsWith('/src/components/InfoFlow.tsx'));
    assert.ok(
      infoFlow,
      'app/src/components/InfoFlow.tsx must be in the scan list — counterweight.',
    );
  });

  // UI-SPEC invariant #7 — cross-tree negative grep.
  it('zero source files contain `card-slide-in` (D-06 — framer-motion replaces CSS entrance animation)', () => {
    const offenders = [];
    for (const file of ALL_SRC_FILES) {
      const source = readFileSync(file, 'utf8');
      if (/card-slide-in/.test(source)) {
        offenders.push(file);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `${offenders.length} file(s) still contain card-slide-in (D-06 deletes the keyframe + 3 callsites; framer-motion replaces it):\n${offenders.join('\n')}`,
    );
  });
});
