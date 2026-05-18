/**
 * Stub for canonical-knowledge.service.ts.
 *
 * - `buildAnchorReflectionTree` — used by trellis-actions / useTrellisData;
 *   returns empty tree so buildTrellisState can run without the full dep
 *   chain.
 * - `classifyAndAnchorIncremental` — Plan 48-03 Task 2: graphCommandService
 *   .detach fires this fire-and-forget. The mock RECORDS each call (so
 *   tests can assert it ran) AND honors the AbortSignal at a synthetic
 *   await checkpoint (so the Warning #2 cancellation test can verify
 *   signal.aborted is observed mid-flight).
 *
 *   Per-call behavior toggles via the helpers below:
 *     _resetClassifyCalls()              — clear the call log
 *     _getClassifyCalls()                — read the recorded call log
 *     _setClassifyCheckpointDelay(ms)    — milliseconds between the call
 *                                          and its NEXT signal.aborted
 *                                          checkpoint. Default = 0 (sync).
 *                                          Test sets >0 to give the
 *                                          controller.abort() a chance to
 *                                          land before the next checkpoint.
 *
 *   The mock returns void; if signal.aborted at the checkpoint, the call
 *   short-circuits and the recorded entry's `completed` flag is `false`
 *   (so tests can verify the call DID start but DID NOT complete to its
 *   final patchQuestion).
 */

const _classifyCalls = [];
let _classifyCheckpointDelay = 0;

export function _resetClassifyCalls() {
  _classifyCalls.length = 0;
  _classifyCheckpointDelay = 0;
}

export function _getClassifyCalls() {
  return [..._classifyCalls];
}

export function _setClassifyCheckpointDelay(ms) {
  _classifyCheckpointDelay = ms;
}

export function buildAnchorReflectionTree() {
  return [];
}

export async function classifyAndAnchorIncremental(question, allQuestions, llmConfig, signal) {
  const entry = {
    question,
    allQuestionsCount: Array.isArray(allQuestions) ? allQuestions.length : 0,
    llmConfig,
    signal,
    abortedAtCheckpoint: false,
    completed: false,
  };
  _classifyCalls.push(entry);

  // Synthetic await checkpoint — sleep then check signal.aborted.
  // The Warning #2 fix in graph-command-service.detach forwards opts?.signal
  // to this call; the LOCALE_CHANGED cancellation test sets a non-zero
  // checkpoint delay and aborts the controller after invocation but before
  // this resolves.
  if (_classifyCheckpointDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, _classifyCheckpointDelay));
  } else {
    // Even with 0 delay, yield once so microtasks queued before us (a
    // sync controller.abort() call from the test) get a chance to land
    // before the checkpoint.
    await Promise.resolve();
  }

  if (signal?.aborted === true) {
    entry.abortedAtCheckpoint = true;
    // Short-circuit per the D-19 LOCALE_CHANGED contract. Do NOT proceed
    // to the imaginary final patchQuestion this mock omits — the
    // `completed: false` flag is the assertion surface.
    return;
  }

  entry.completed = true;
}
