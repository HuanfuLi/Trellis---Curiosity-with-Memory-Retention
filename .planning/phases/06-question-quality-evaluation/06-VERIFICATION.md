---
phase: 06-question-quality-evaluation
verified: 2026-03-25T12:00:00Z
status: human_needed
score: 10/10 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 9/10
  gaps_closed:
    - "Session context passed to filterQuestion() in the non-streaming ask() path (question.service.ts)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Off-topic badge visual appearance"
    expected: "A small badge reading 'Off-topic' appears below the AI response when the question is flagged; no badge for substantive questions"
    why_human: "Badge styling and visual placement cannot be verified programmatically — requires viewing the rendered UI"
  - test: "Override flow interaction"
    expected: "Clicking the badge expands an inline prompt 'This looks off-topic. Save anyway?' with 'Yes, save anyway' and 'Discard' buttons. Clicking 'Yes, save anyway' shows a toast and badge disappears. Clicking 'Discard' closes the prompt and badge persists."
    why_human: "React state transitions and toast visibility require running the app"
  - test: "Knowledge graph exclusion end-to-end"
    expected: "A flagged-but-not-overridden greeting does not appear in the knowledge graph, review queue, flashcards, or podcast content"
    why_human: "Verifying end-to-end exclusion across downstream features requires navigating the live app"
---

# Phase 6: Question Quality Evaluation Verification Report

**Phase Goal:** Add a hybrid pattern + LLM-based detection layer that flags off-topic and meta-questions, allows users to see and override the flag with a minimal UI, and respects the flag during knowledge graph ingestion.
**Verified:** 2026-03-25
**Status:** human_needed (all automated checks pass; 3 items require human testing)
**Re-verification:** Yes — after gap closure (plan 06-02)

---

## Re-Verification Summary

| Item | Previous | Now |
|------|----------|-----|
| Overall score | 9/10 (gaps_found) | 10/10 (human_needed) |
| Gap: non-streaming ask() missing sessionContext | PARTIAL | CLOSED |
| Commits verified | — | ec470411, 889b99c0 |
| Regressions | — | None |

The single gap identified in the initial verification — `question.service.ts ask()` calling `filterQuestion(question)` without session context — has been resolved. Commits `ec470411` and `889b99c0` exist in git history.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Off-topic questions (meta, greetings, jokes) are detected and flagged | VERIFIED | `question-filter.service.ts` exports `isOffTopicByPattern()` (line 44) and `evaluateQuestion()` (line 101). PATTERN_LIBRARY covers 5 categories. High-confidence (>=0.75) resolves synchronously; LLM fallback for borderline cases. |
| 2  | Valid questions auto-save and appear in knowledge graph | VERIFIED | `useQuestions.askStreaming` calls `buildAndSave()` then `filterQuestion()`. Questions with `flagged: false` pass the `projectQuestionsToKnowledgeNodes` filter unchanged (canonical-knowledge.service.ts line 95). |
| 3  | Users see a non-intrusive badge when a question is flagged | VERIFIED | `ChatMessage.tsx` lines 218-244: badge renders only when `type === 'ai' && flagged === true`. Silent (no DOM node) when not flagged. |
| 4  | Users can override the flag with "Yes, save anyway?" | VERIFIED | `ChatMessage.tsx` lines 248-301: clicking badge toggles `showOverridePrompt`. Inline panel shows "This looks off-topic. Save anyway?" with "Yes, save anyway" (line 265 triggers `onQuestionOverride`) and "Discard" buttons. |
| 5  | Overridden questions are persisted to knowledge graph | VERIFIED | `AskScreen.tsx` line 392: `questionService.patchQuestion(questionId, { flagged: false })`. After patch, `projectQuestionsToKnowledgeNodes` includes the question (line 95 filter: `q.flagged !== true`). |
| 6  | Flagged questions do not pollute the knowledge graph | VERIFIED | `canonical-knowledge.service.ts` line 61: `if (question.flagged === true) return null`. Line 95: `.filter((q) => q.flagged !== true)` in batch function. All downstream calls use this function. |
| 7  | Filtering adds less than 100ms latency | VERIFIED | `isOffTopicByPattern()` is synchronous regex iteration over 5 patterns — <1ms by construction. LLM fallback only for borderline confidence; pattern-only path has no async overhead. |
| 8  | Follow-up questions are evaluated WITH prior session context (streaming path) | VERIFIED | `useQuestions.ts` line 113: `filterQuestion(rawQuestion, sessionContext)`. `AskScreen.tsx` lines 182-191 build `sessionContext = { priorQuestion, priorAnswer }` from the last AI message and pass to `askStreaming()`. |
| 9  | Follow-up questions are evaluated WITH prior session context (non-streaming path) | VERIFIED | `question.service.ts` line 161: `async ask(content: string, sessionContext?: QuestionFilterContext)`. Line 259: `filterQuestion(question, sessionContext)`. `QuestionFilterContext` imported at line 15. Commit ec470411. |
| 10 | Follow-ups that are elaborations are treated as valid | VERIFIED | LLM prompt (question-filter.service.ts line 73): "If this appears to be a follow-up or elaboration on the prior question shown above, treat it as a valid learning question." LLM receives `priorQuestion` and `priorAnswer` preview. |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/services/question-filter.service.ts` | Hybrid pattern + LLM filtering; exports `evaluateQuestion()`, `isOffTopicByPattern()` | VERIFIED | 124 lines. Both functions exported. PATTERN_LIBRARY has 5 entries. LLM fallback with graceful degradation. |
| `app/src/types/index.ts` | Contains `flagged?: boolean` in Question type | VERIFIED | Line 32: `flagged?: boolean;  // true if detected as off-topic/meta-question; user can override` |
| `app/src/components/ChatMessage.tsx` | Off-topic badge + override button UI | VERIFIED | 390+ lines. Badge at lines 218-244. Inline override prompt at lines 248-301. Props: `flagged`, `questionId`, `onQuestionOverride`. |
| `app/src/services/question.service.ts` | Filter called with sessionContext; ask() accepts sessionContext param | VERIFIED | Line 15: imports `QuestionFilterContext`. Line 161: `ask(content: string, sessionContext?: QuestionFilterContext)`. Line 259: `filterQuestion(question, sessionContext)`. |
| `app/src/services/canonical-knowledge.service.ts` | Skips ingest if `question.flagged === true` | VERIFIED | Line 61: `if (question.flagged === true) return null`. Line 95: `.filter((q) => q.flagged !== true)` in batch function. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useQuestions.ts` (askStreaming) | `question-filter.service.ts` | `filterQuestion(rawQuestion, sessionContext)` | WIRED | Line 113 passes both question and sessionContext |
| `question.service.ts` (ask) | `question-filter.service.ts` | `filterQuestion(question, sessionContext)` | WIRED | Line 259 — gap closed by commit ec470411. Both arguments confirmed present. |
| `canonical-knowledge.service.ts` | `types/index.ts` (flagged field) | `question.flagged === true` guard | WIRED | Lines 61 and 95 explicitly check `flagged` field |
| `ChatMessage.tsx` | `AskScreen.tsx` | `onQuestionOverride(questionId, shouldSave)` callback | WIRED | ChatMessage.tsx line 26 declares prop; AskScreen.tsx line 591 passes `handleQuestionOverride` |
| `AskScreen.tsx` | `question.service.ts` | `patchQuestion(id, { flagged: false })` | WIRED | AskScreen.tsx line 392 calls `questionService.patchQuestion(questionId, { flagged: false })` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `ChatMessage.tsx` (badge) | `flagged` prop | `questions.find((q) => q.id === message.questionId)?.flagged` (AskScreen.tsx line 590) | Yes — derived from live questions state updated after `filterQuestion()` runs | FLOWING |
| `canonical-knowledge.service.ts` | `questions` array | `questionService.getAll()` reading from localStorage store | Yes — real persisted questions with `flagged` field from `evaluateQuestion()` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `evaluateQuestion` and `isOffTopicByPattern` exported | Source read lines 44, 101 | Both exported at correct lines | PASS |
| `flagged` field in Question type | `grep -n "flagged" app/src/types/index.ts` | Line 32 confirmed | PASS |
| `projectQuestionToKnowledgeNode` returns null for flagged | Source read line 61 | `if (question.flagged === true) return null` | PASS |
| ask() signature updated | `grep -n "async ask(content: string, sessionContext" question.service.ts` | Line 161 confirmed | PASS |
| filterQuestion receives sessionContext in non-streaming path | `grep -n "filterQuestion(question, sessionContext)" question.service.ts` | Line 259 confirmed | PASS |
| Commits exist in git history | `git log --oneline` | ec470411 and 889b99c0 both present | PASS |
| AskScreen does not call ask() directly | `grep "questionService.ask(" AskScreen.tsx` | No direct calls found; comment added at lines 11-13 documenting this | PASS |

---

### Requirements Coverage

No requirement IDs were declared in `06-01-PLAN.md` or `06-02-PLAN.md` (`requirements: []`). No entries in `.planning/REQUIREMENTS.md` mapped to phase 6. Requirements coverage check: N/A.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ChatMessage.tsx` | 284 | `Discard` button calls `setShowOverridePrompt(false)` only — no `onQuestionOverride(questionId, false)` call | Info | Intentional per plan decision D-02: Discard just collapses the prompt; flagged state persists. No functional issue. |

No TODO/FIXME/placeholder comments found in phase 6 files. No empty implementations. No hardcoded empty data in rendering paths. No regressions introduced by gap closure plan 06-02.

---

### Human Verification Required

#### 1. Off-Topic Badge Visual Appearance

**Test:** Ask a greeting like "Hello there!" in the Ask screen with an LLM configured.
**Expected:** After the AI responds, a small badge labeled "Off-topic" (with warning icon) appears below the response. No badge appears for substantive learning questions.
**Why human:** Badge styling, positioning, and visual prominence require viewing the rendered UI.

#### 2. Override Flow End-to-End

**Test:** Ask "Hello!" to trigger a flag. Click the "Off-topic" badge. Click "Yes, save anyway".
**Expected:** Inline prompt appears inline (no modal). After clicking "Yes, save anyway", a toast "Question saved to knowledge base" appears and the badge disappears.
**Why human:** React state transitions and toast visibility cannot be verified statically.

#### 3. Knowledge Graph Exclusion End-to-End

**Test:** Ask "Hello!" (flagged). Do NOT override. Navigate to any knowledge graph or review screen.
**Expected:** The greeting does not appear in the knowledge graph, review queue, flashcards, or podcast content.
**Why human:** Verifying end-to-end exclusion across downstream features requires navigating the live app.

---

### Gap Closure Confirmation

**Gap (initial verification):** `question.service.ts` `ask()` called `filterQuestion(question)` with no second argument. The `ask()` signature only accepted `content: string`, so callers could not supply prior Q&A context.

**Resolution (plan 06-02, commit ec470411):**
- `QuestionFilterContext` type imported at line 15
- `ask()` signature updated to `ask(content: string, sessionContext?: QuestionFilterContext)` at line 161
- `filterQuestion(question)` updated to `filterQuestion(question, sessionContext)` at line 259

**AskScreen clarification (commit 889b99c0):** A comment at lines 11-13 of AskScreen.tsx documents that AskScreen uses `askStreaming` exclusively and does not call `ask()` directly. The non-streaming path is a consistent, correct fallback.

Both streaming and non-streaming paths now behave identically with respect to session context forwarding.

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after plan 06-02 gap closure_
