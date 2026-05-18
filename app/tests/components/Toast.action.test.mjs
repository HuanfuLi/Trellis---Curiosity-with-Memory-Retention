/**
 * Toast.action.test.mjs — Phase 49-03
 *
 * 5 tests (numbered 7–11 to match the plan's test inventory) on the extended
 * toast() signature and Toast.tsx trailing-action button.
 *
 * Source-reading approach for structural assertions; runtime check for Test 7
 * via dynamic import of the .ts module.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TOAST_LIB_PATH = resolve(here, '../../src/lib/toast.ts');
const TOAST_TSX_PATH = resolve(here, '../../src/components/ui/Toast.tsx');
const SRC_ROOT = resolve(here, '../../src');

// Test 7 — signature: toast('msg', 'info', { action: {...} }) does not throw;
// toast('msg') and toast('msg', 'info') still compile/run.
test('Test 7 — toast() accepts optional 3rd arg with action; legacy calls still work', async () => {
  const mod = await import('../../src/lib/toast.ts');
  assert.equal(typeof mod.toast, 'function', 'toast must be exported as a function');
  // No handler registered → all calls become no-ops, but must NOT throw.
  assert.doesNotThrow(() => mod.toast('one-arg'), 'toast("msg") must not throw');
  assert.doesNotThrow(() => mod.toast('two-arg', 'info'), 'toast("msg", "info") must not throw');
  assert.doesNotThrow(
    () => mod.toast('three-arg', 'info', { action: { label: 'Undo', onAction: () => {} } }),
    'toast("msg", "info", { action: {...} }) must not throw',
  );
  // Source-reading sanity: 3rd-arg type contains label + onAction fields.
  const src = readFileSync(TOAST_LIB_PATH, 'utf-8');
  assert.match(
    src,
    /label\s*:/,
    'toast.ts must declare a `label` field on the action type',
  );
  assert.match(
    src,
    /onAction\s*:/,
    'toast.ts must declare an `onAction` field on the action type',
  );
});

// Test 8 — render: when an action payload is delivered to the handler, the
// trailing <button> with label is rendered within the toast row.
test('Test 8 — Toast.tsx renders trailing button when action present', () => {
  const src = readFileSync(TOAST_TSX_PATH, 'utf-8');
  // ToastMessage interface includes action?: { label; onAction }.
  assert.match(
    src,
    /action\s*\?\s*:\s*\{\s*label\s*:[^}]*onAction\s*:/,
    'ToastMessage must include `action?: { label; onAction }` field',
  );
  // Conditional render of a <button> branch tied to t.action presence.
  assert.match(
    src,
    /\{t\.action\s*&&/,
    'must conditionally render the action button via `{t.action && ...}`',
  );
  // The button must render the action label.
  assert.match(
    src,
    /\{t\.action\.label\}/,
    'must render the action label inside the trailing button',
  );
});

// Test 9 — action handler: clicking the action button invokes onAction AND
// dismisses the toast (exiting: true followed by removal).
test('Test 9 — action button click invokes onAction and dismisses the toast', () => {
  const src = readFileSync(TOAST_TSX_PATH, 'utf-8');
  // Click handler must call t.action!.onAction().
  assert.match(
    src,
    /t\.action!\.onAction\(\)/,
    'action button onClick must invoke t.action!.onAction()',
  );
  // Click handler must also dismiss the toast — via the shared dismissToast(id)
  // helper or an inline setToasts(... exiting: true ...) update.
  assert.ok(
    /dismissToast\(t\.id\)/.test(src) ||
      /setToasts\([^)]*exiting:\s*true[^)]*\)/.test(src),
    'action button onClick must dismiss the toast (dismissToast(t.id) or inline exiting:true)',
  );
});

// Test 10 — duration: 5000ms when action set; 3000ms unchanged otherwise.
test('Test 10 — auto-dismiss is 5000ms with action, 3000ms without (regression guard)', () => {
  const src = readFileSync(TOAST_TSX_PATH, 'utf-8');
  // Must reference both durations. Either via ternary or two separate setTimeout
  // calls — both patterns are acceptable as long as both numbers appear.
  assert.match(src, /5000/, 'must reference 5000ms (action duration)');
  assert.match(src, /3000/, 'must reference 3000ms (no-action duration)');
  // Ternary pattern is what the plan recommends and what we shipped:
  //   const dismissDelay = msg.action ? 5000 : 3000;
  assert.match(
    src,
    /action\s*\?\s*5000\s*:\s*3000/,
    'must use ternary `msg.action ? 5000 : 3000` for the auto-dismiss timer',
  );
});

// Test 11 — existing call sites: every toast(...) call in src/ uses 1, 2, or 3 args.
// If 3-arg, third must be a `{ action: ... }`-shaped object literal (or destructured
// variable — we accept any non-string non-numeric expression as long as the call
// is well-formed).
test('Test 11 — all existing toast() call sites compile under the new signature', () => {
  // Walk app/src/ collecting every toast( ) call.
  const callSites = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        const src = readFileSync(full, 'utf-8');
        // Match `toast(` calls — exclude method-property accesses like `.toast(` only
        // when they're clearly not our import. Our toast helper is invoked as a
        // free function. Simple regex: `\btoast\(` (word boundary).
        const re = /\btoast\(/g;
        let m;
        while ((m = re.exec(src))) {
          // Capture the call from `toast(` through its matching `)` — small
          // hand-rolled balanced-paren walker.
          let depth = 0;
          let i = m.index + 'toast'.length;
          const start = i;
          for (; i < src.length; i++) {
            const ch = src[i];
            if (ch === '(') depth++;
            else if (ch === ')') {
              depth--;
              if (depth === 0) {
                const callBody = src.slice(start + 1, i);
                callSites.push({ file: full.replace(SRC_ROOT, 'src'), callBody });
                break;
              }
            }
          }
        }
      }
    }
  }
  walk(SRC_ROOT);

  assert.ok(
    callSites.length > 0,
    'expected to find at least one toast() call in src/ — sanity check on the walker',
  );

  // Split each call by top-level commas (depth-aware) and check arg counts.
  for (const { file, callBody } of callSites) {
    const args = [];
    let cur = '';
    let depth = 0;
    let inStr = null; // '"', '\''
    for (let i = 0; i < callBody.length; i++) {
      const ch = callBody[i];
      const prev = i > 0 ? callBody[i - 1] : '';
      if (inStr) {
        cur += ch;
        if (ch === inStr && prev !== '\\') inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch;
        cur += ch;
        continue;
      }
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
      if (ch === ',' && depth === 0) {
        args.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim() !== '') args.push(cur.trim());

    assert.ok(
      args.length >= 1 && args.length <= 3,
      `toast() at ${file} has ${args.length} args (callBody="${callBody.slice(0, 80)}..."); must be 1, 2, or 3`,
    );
    if (args.length === 3) {
      // Third arg must look like an object literal mentioning `action` OR a
      // variable reference (we accept that since it's structurally compatible).
      const third = args[2];
      // Reject obvious non-options third args (e.g. a literal string or number).
      assert.ok(
        !/^['"`]/.test(third) && !/^-?\d/.test(third),
        `toast() at ${file} has 3rd arg "${third}" — must be ToastOptions, not a string/number literal`,
      );
    }
  }
});
