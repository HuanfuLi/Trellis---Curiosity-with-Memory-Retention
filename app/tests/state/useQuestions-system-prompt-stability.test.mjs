/**
 * Phase 35 system-prompt-stability regression suite (2026-04-29).
 *
 * Locks in the Phase 35 structural guarantee that the Ask-chat system prompt
 * is BYTE-STABLE across chat turns — the per-turn formatCandidateContextPack
 * output lives in a tail-position assistant message, NOT inside the system role.
 *
 * Two opposite regressions this guards against:
 *   1. Someone re-interpolates dynamic content into systemPrompt (silently
 *      re-breaks the provider KV-cache prefix coverage on conversation history).
 *   2. Someone deletes the assistant-tail context message thinking it's dead
 *      code (silently degrades Ask answer quality by stripping the graph-
 *      grounded prompt — graph candidates are load-bearing for relevant
 *      cross-Q&A continuity).
 *
 * See app/CLAUDE.md "Ask-chat system prompt — byte-stable across turns" and
 * .planning/phases/35-fix-the-dynamic-system-prompt-issue/35-CONTEXT.md D-04.
 *
 * Source-reading asserts. The behavior under test (KV-cache prefix coverage)
 * is observable only at the provider boundary, which we do not stub in CI.
 * Code-shape assertions are the durable, deterministic guard.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../src/state/useQuestions.ts', import.meta.url),
  'utf-8',
);

describe('useQuestions system prompt stability (Phase 35)', () => {
  it('formatCandidateContextPack is NOT referenced inside any role:"system" content', () => {
    // Find every occurrence of formatCandidateContextPack in the source.
    const occurrences = [];
    let idx = 0;
    while ((idx = source.indexOf('formatCandidateContextPack', idx)) !== -1) {
      occurrences.push(idx);
      idx += 'formatCandidateContextPack'.length;
    }
    assert.ok(
      occurrences.length >= 2,
      `formatCandidateContextPack should appear at least twice (import + assistantContextMessage assignment) — found ${occurrences.length}`,
    );

    // For each occurrence, walk back up to 200 chars and confirm no
    // role: 'system' string sits in that window. The systemPrompt const
    // is built as a string array filtered+joined, so any reintroduction
    // of formatCandidateContextPack would land inside that array literal.
    for (const at of occurrences) {
      const windowStart = Math.max(0, at - 200);
      const window = source.slice(windowStart, at);
      assert.ok(
        !/role:\s*['"]system['"]/.test(window),
        `formatCandidateContextPack at offset ${at} appears within 200 chars after a role:'system' marker — Phase 35 forbids dynamic interpolation in the system prompt. Move the candidate-context emission into a role:'assistant' tail message.`,
      );
    }
  });

  it('Pass 1 chatStream array has a role:"assistant" message carrying the candidate context BEFORE the user turn', () => {
    // Locate the Pass 1 chatStream call (the FIRST chatStream invocation in askStreaming).
    const pass1Idx = source.indexOf('const stream = chatStream(');
    assert.ok(pass1Idx !== -1, 'useQuestions.ts must contain the Pass 1 chatStream call (`const stream = chatStream(`)');
    // Narrow to the array-literal argument — up to the closing `],` followed by llmConfig.
    const pass1ArrayEnd = source.indexOf('llmConfig', pass1Idx);
    assert.ok(pass1ArrayEnd !== -1, 'Pass 1 chatStream call must reach llmConfig argument');
    const pass1Array = source.slice(pass1Idx, pass1ArrayEnd);

    // Must contain a role:'assistant' element with content: assistantContextMessage.
    assert.ok(
      /role:\s*['"]assistant['"],\s*content:\s*assistantContextMessage/.test(pass1Array),
      'Pass 1 chatStream array must contain `{ role: "assistant", content: assistantContextMessage }` — the tail-position graph-context message',
    );

    // The assistant context message must appear AFTER ...historyMessages and BEFORE the user turn.
    const historySpread = pass1Array.indexOf('...historyMessages');
    const assistantCtx = pass1Array.search(/role:\s*['"]assistant['"],\s*content:\s*assistantContextMessage/);
    // Match both `content` shorthand and `content: content` long-form for the user turn.
    const userTurn = pass1Array.search(/role:\s*['"]user['"]\s*,\s*content(?:\s*:\s*content)?\s*[,}]/);
    assert.ok(historySpread !== -1, 'Pass 1 array must spread ...historyMessages');
    assert.ok(userTurn !== -1, 'Pass 1 array must contain the new user turn `{ role: "user", content }`');
    assert.ok(
      historySpread < assistantCtx && assistantCtx < userTurn,
      `Pass 1 array order must be: ...historyMessages → assistant(context) → user(content). Got offsets history=${historySpread}, assistant=${assistantCtx}, user=${userTurn}.`,
    );
  });

  it('Pass 2 chatStream array has the SAME role:"assistant" assistantContextMessage element', () => {
    // Locate the Pass 2 chatStream call (the SECOND chatStream invocation in askStreaming).
    const pass2Idx = source.indexOf('const stream2 = chatStream(');
    assert.ok(pass2Idx !== -1, 'useQuestions.ts must contain the Pass 2 chatStream call (`const stream2 = chatStream(`)');
    const pass2ArrayEnd = source.indexOf('llmConfig', pass2Idx);
    assert.ok(pass2ArrayEnd !== -1, 'Pass 2 chatStream call must reach llmConfig argument');
    const pass2Array = source.slice(pass2Idx, pass2ArrayEnd);

    assert.ok(
      /role:\s*['"]assistant['"],\s*content:\s*assistantContextMessage/.test(pass2Array),
      'Pass 2 chatStream array must contain `{ role: "assistant", content: assistantContextMessage }` — same closure variable as Pass 1, preserves Pass1→Pass2 prefix-cache continuity',
    );

    // Order: ...historyMessages → assistant(context) → user(content) → assistant(searched-the-web) → user(search-results).
    const historySpread = pass2Array.indexOf('...historyMessages');
    const assistantCtx = pass2Array.search(/role:\s*['"]assistant['"],\s*content:\s*assistantContextMessage/);
    // Match both `content` shorthand and `content: content` long-form for the user turn.
    const userTurn = pass2Array.search(/role:\s*['"]user['"]\s*,\s*content(?:\s*:\s*content)?\s*[,}]/);
    const searchAck = pass2Array.indexOf('I searched the web');
    const searchResults = pass2Array.indexOf('Web search results for');
    assert.ok(historySpread !== -1, 'Pass 2 array must spread ...historyMessages');
    assert.ok(searchAck !== -1, 'Pass 2 array must keep the synthetic "I searched the web" assistant ack');
    assert.ok(searchResults !== -1, 'Pass 2 array must keep the search-results user message');
    assert.ok(
      historySpread < assistantCtx && assistantCtx < userTurn && userTurn < searchAck && searchAck < searchResults,
      `Pass 2 array order must be: ...historyMessages → assistant(context) → user(content) → assistant(searched-the-web) → user(search-results). Got offsets history=${historySpread}, assistantCtx=${assistantCtx}, user=${userTurn}, searchAck=${searchAck}, searchResults=${searchResults}.`,
    );
  });

  it('assistantContextMessage is declared exactly once (Pass 1 and Pass 2 share the closure variable)', () => {
    const decls = source.match(/const\s+assistantContextMessage\s*=/g) ?? [];
    assert.equal(
      decls.length,
      1,
      `assistantContextMessage must be declared exactly once in useQuestions.ts so Pass 1 and Pass 2 reuse the same per-turn value (preserves Pass1→Pass2 prefix-cache continuity). Found ${decls.length} declarations.`,
    );
  });

  it('formatCandidateContextPack remains imported from canonical-knowledge.service', () => {
    // Negative-test counterweight: catches a future contributor who deletes
    // the symbol thinking it's dead code. Phase 35 keeps the same graph-
    // grounding behavior — only the message position changes.
    assert.ok(
      /import\s*\{[^}]*formatCandidateContextPack[^}]*\}\s*from\s*['"][^'"]*canonical-knowledge\.service['"]/.test(source),
      'useQuestions.ts must still import formatCandidateContextPack from canonical-knowledge.service — Phase 35 keeps the graph-context content, only relocates its message role',
    );
  });
});
