/**
 * Mock for question.service.ts — used in trellis-actions tests AND
 * Plan 48-02 graph-command tests.
 *
 * Uses a simple in-memory store so patchQuestion/getAll/getPrunedQuestions/
 * delete behave correctly without SQLite or LLM dependencies.
 *
 * Plan 48-02 additions:
 *   - delete() now returns ServiceResult<void> matching the real signature
 *     at question.service.ts:565-571 (Blocker #2 — callers must inspect
 *     result.success before journaling).
 *   - delete() emits the untyped GRAPH_UPDATED event the real impl emits
 *     at question.service.ts:569 (so the double-emit assertion in
 *     graph-command-service.delete.test.mjs is honored).
 *   - _setDeleteFail(true) forces delete() to return { success: false }
 *     so the Blocker #2 abort-before-journal path can be tested.
 */

let _store = [];
let _deleteFail = false;

// Plan 48-04 Warning #6 fix — opt-in localStorage mirror (default OFF).
// When enabled, every store mutation (patchQuestion / delete / restoreDeleted)
// ALSO writes JSON.stringify(_store) to localStorage so the reload-survival
// test can exercise the localStorage round-trip. Default OFF preserves
// Plan 02 + Plan 03 test behavior exactly (their existing assertions never
// hit localStorage; turning the mirror on by default would surface
// quota/serialization noise into unrelated tests).
let _localStorageMirrorEnabled = false;

export function _enableLocalStorageMirror(enabled = true) {
  _localStorageMirrorEnabled = !!enabled;
}

function _mirrorToStorageIfEnabled() {
  if (!_localStorageMirrorEnabled) return;
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      localStorage.setItem('trellis_questions', JSON.stringify(_store));
    }
  } catch {
    // Quota or other storage failure — silent (mirrors real
    // saveStore() graceful degradation; the test asserts the
    // SUCCESS path with sufficient quota).
  }
}

export function _reloadFromStorage() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) {
      _store = [];
      return;
    }
    const raw = localStorage.getItem('trellis_questions');
    _store = raw ? JSON.parse(raw) : [];
  } catch {
    _store = [];
  }
}

export function _resetStore(questions) {
  _store = questions ? [...questions] : [];
  _deleteFail = false;
  // Mirror the reset into storage too, so a reload after _resetStore
  // sees the seeded state instead of yesterday's leftover.
  _mirrorToStorageIfEnabled();
}

export function _getStore() {
  return [..._store];
}

export function _setDeleteFail(fail) {
  _deleteFail = !!fail;
}

export const questionService = {
  getAll(opts) {
    return opts?.includeFlagged
      ? [..._store]
      : _store.filter((q) => !q.flagged);
  },

  getPrunedQuestions() {
    return _store.filter((q) => q.flagged === true && q.prunedFromTrellis === true);
  },

  patchQuestion(questionId, patch) {
    const idx = _store.findIndex((q) => q.id === questionId);
    if (idx !== -1) {
      _store[idx] = { ..._store[idx], ...patch };
      _mirrorToStorageIfEnabled();
    }
  },

  async delete(questionId) {
    if (_deleteFail) {
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'mock delete forced failure', retryable: true },
      };
    }
    _store = _store.filter((q) => q.id !== questionId);
    _mirrorToStorageIfEnabled();
    // Mirror real impl: emit QUESTION_DELETED + (untyped) GRAPH_UPDATED.
    // The eventBus is imported lazily so we don't create a module-load
    // ordering trap when the mock is registered.
    const { eventBus } = await import('../../src/lib/event-bus.ts');
    eventBus.emit({ type: 'QUESTION_DELETED', payload: { id: questionId } });
    eventBus.emit({ type: 'GRAPH_UPDATED' });
    return { success: true };
  },

  // Plan 48-04 — single permitted exception used ONLY by
  // graphCommandService.undo() to resurrect a hard-deleted record from the
  // journal's full pre-image. Mirrors the real questionService.restoreDeleted
  // shape (sync write-through via saveStore, no separate emit — undo's
  // command-boundary emit covers the GRAPH_UPDATED).
  //
  // Warning #6 fix (revision 1): localStorage mirror is opt-in via
  // _enableLocalStorageMirror(true). Default OFF preserves Plan 02 + Plan 03
  // test behavior exactly.
  restoreDeleted(question) {
    const idx = _store.findIndex((q) => q.id === question.id);
    if (idx === -1) {
      _store = [..._store, question];
    } else {
      _store[idx] = question;
    }
    _mirrorToStorageIfEnabled();
  },
};
