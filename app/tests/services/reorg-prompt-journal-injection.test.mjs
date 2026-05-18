// Phase 48-01 Task 4 — Source-reading invariants for reorganizeMindmap's
// "Manual corrections to preserve:" prompt injection.
//
// Source-reading (not behavioral) per RESEARCH §R8 and 48-01-PLAN.md
// Task 4 <action>: executing _doReorganize requires LLM provider stubs;
// the code-shape invariants are what we actually want to guard
// (matches classification-dedup.test.mjs canonical pattern).
//
// Asserts:
// 1. Source imports graphEditJournal from graph-edit-journal.service.
// 2. Source imports / references phraseJournalEntry inside _doReorganize.
// 3. Empty-case literal 'Manual corrections to preserve:' present.
// 4. Empty-case literal '(none)' present.
// 5. Non-empty-case literal 'most recent learner edits' present.
// 6. Injection position invariant: the block sits BETWEEN the existing
//    'Rules:' string and the existing 'Respond ONLY with valid JSON'
//    string inside the _doReorganize body slice (R4 line 430).
//
// Byte-stability surface: the literal strings + injection position are
// the part of the prompt that survives across consecutive reorg runs
// when the journal is empty. Any prefix drift (e.g., re-ordering the
// constraints block above 'Rules:') would move the cache-break
// boundary unpredictably and invalidate this guard.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/services/canonical-knowledge.service.ts', import.meta.url),
  'utf-8',
);

// Slice the _doReorganize function body so positional asserts don't
// pick up unrelated text elsewhere in the 2000+ line file.
const reorgIdx = source.indexOf('async function _doReorganize');
assert.ok(reorgIdx !== -1, '_doReorganize must exist in canonical-knowledge.service.ts');
// Approximate body — enough chars to cover the entire builder + chatCompletion call.
const reorgBody = source.slice(reorgIdx, reorgIdx + 8000);

describe('reorg prompt journal injection (Phase 48-01 Task 4)', () => {
  it('imports graphEditJournal from graph-edit-journal.service', () => {
    // Extension may be .ts (project convention) or .js (post-build); accept either.
    assert.match(
      source,
      /import\s*\{\s*graphEditJournal\s*\}\s*from\s*['"]\.\/graph-edit-journal\.service(?:\.ts|\.js)?['"]/,
      'canonical-knowledge.service.ts must import { graphEditJournal } from ./graph-edit-journal.service',
    );
  });

  it('imports phraseJournalEntry from graph-edit-journal-phrasing', () => {
    assert.match(
      source,
      /import\s*\{\s*phraseJournalEntry\s*\}\s*from\s*['"]\.\/graph-edit-journal-phrasing(?:\.ts|\.js)?['"]/,
      'canonical-knowledge.service.ts must import { phraseJournalEntry } from ./graph-edit-journal-phrasing',
    );
  });

  it('_doReorganize references graphEditJournal.list()', () => {
    assert.match(
      reorgBody,
      /graphEditJournal\.list\s*\(\s*\)/,
      '_doReorganize must call graphEditJournal.list() to read the journal at prompt-build time',
    );
  });

  it('_doReorganize references phraseJournalEntry', () => {
    assert.match(
      reorgBody,
      /phraseJournalEntry\s*\(/,
      '_doReorganize must call phraseJournalEntry() to project each entry into a prompt line',
    );
  });

  it('empty-case branch contains the literal "Manual corrections to preserve:"', () => {
    // The empty-case header is the byte-stable boundary: even with no
    // edits, the constraint block exists so the prompt shape is
    // identical empty→empty (R4 byte-stability requirement).
    assert.match(
      reorgBody,
      /Manual corrections to preserve:/,
      'empty-case header must use the literal "Manual corrections to preserve:"',
    );
  });

  it('empty-case branch contains the literal "(none)"', () => {
    assert.match(
      reorgBody,
      /\(none\)/,
      'empty-case body must use the literal "(none)" so the block is well-formed with no entries',
    );
  });

  it('non-empty-case branch contains the literal "most recent learner edits"', () => {
    assert.match(
      reorgBody,
      /most recent learner edits/,
      'non-empty header must include the "most recent learner edits" subordinate clause from R4 template',
    );
  });

  it('injection point is BETWEEN "Rules:" and "Respond ONLY with valid JSON" inside _doReorganize prompt array', () => {
    // R4 line 430 — at RUNTIME, the constraints block sits between the
    // existing Rules: block and the existing Respond ONLY with valid
    // JSON block, preserving byte-stability of the prefix up to Rules:.
    //
    // Source text alone can't prove runtime ordering (the constraintsBlock
    // VALUE is declared before the systemPrompt array literal that
    // REFERENCES it). The real invariant: inside the systemPrompt array
    // literal, the `constraintsBlock` IDENTIFIER must appear AFTER the
    // 'Rules:' element and BEFORE the 'Respond ONLY with valid JSON'
    // element. That's what the LLM actually sees.
    //
    // Locate the systemPrompt array literal anchor — it starts at
    // `const systemPrompt = [`. From that anchor, find the relative
    // positions of: 'Rules:', the `constraintsBlock` identifier, and
    // 'Respond ONLY with valid JSON'.
    const arrayAnchor = reorgBody.indexOf('const systemPrompt = [');
    assert.ok(arrayAnchor !== -1, 'const systemPrompt = [ array literal must exist in _doReorganize');
    // Slice tightly to the array body — `].join(` closes the literal.
    const arrayEnd = reorgBody.indexOf("].join('\\n')", arrayAnchor);
    assert.ok(arrayEnd > arrayAnchor, 'systemPrompt array literal must terminate with ].join(\\n)');
    const arrayBody = reorgBody.slice(arrayAnchor, arrayEnd);

    const rulesIdx = arrayBody.indexOf("'Rules:'");
    const constraintsIdx = arrayBody.indexOf('constraintsBlock');
    const respondIdx = arrayBody.indexOf("'Respond ONLY with valid JSON");

    assert.ok(rulesIdx !== -1, "systemPrompt array must contain the literal 'Rules:' element");
    assert.ok(constraintsIdx !== -1, 'systemPrompt array must reference the constraintsBlock identifier');
    assert.ok(respondIdx !== -1, "systemPrompt array must contain the literal 'Respond ONLY with valid JSON...' element");

    assert.ok(
      rulesIdx < constraintsIdx,
      'constraintsBlock must come AFTER the existing Rules: element in the systemPrompt array (not prepended)',
    );
    assert.ok(
      constraintsIdx < respondIdx,
      'constraintsBlock must come BEFORE the existing Respond ONLY with valid JSON element in the systemPrompt array (not appended)',
    );
  });
});
