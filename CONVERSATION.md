# Re-Audit Report

Date: 2026-03-21
Project: EchoLearn
Scope: Re-check whether the previously identified fixes were actually applied

## Summary

I re-examined the codebase with focus on the previously reported problem areas:

1. STT typing and configuration
2. Chat/session to persisted-question synchronization
3. Flashcard extraction completion logic
4. Streaming timeout behavior
5. Graph link symmetry
6. SQLite write-through consistency
7. Session deletion cascade behavior

Conclusion:

- The earlier fixes are not fully applied.
- The app still fails to build.
- Most of the previously reported logic and design defects remain present in source.

## Current Findings

### 1. STT fix is still not applied

Severity: High

Current state:

- `transcribeAudio()` still requires a config shape with `apiKey: string`.
- Both call sites still pass `settings.tts` directly.
- `TTSConfig.apiKey` remains optional, so TypeScript still rejects these calls.

References:

- `app/src/providers/stt/index.ts`
- `app/src/components/ChatInput.tsx`
- `app/src/screens/HomeScreen.tsx`

Impact:

- The app still does not build.
- The intended speech-input configuration cleanup was not completed.

### 2. Chat edit/regenerate/delete flows still do not synchronize stored question data

Severity: High

Current state:

- `handleEditSubmit()` still truncates and rewrites only session messages.
- `handleRegenerateResponse()` still removes only the AI message from the chat session.
- `handleDeleteResponse()` still deletes only the chat message.
- The only flow that deletes the underlying persisted question remains the flag-confirm path.

References:

- `app/src/screens/AskScreen.tsx`

Impact:

- Persisted `Question` records still survive when the visible conversation is edited, regenerated, or deleted.
- This means graph data, related knowledge, and podcast inputs can still reflect stale content that the user believes is gone.

### 3. Flashcard extraction completion is still incorrect

Severity: High

Current state:

- `startNewSession()` still marks the session as `processed: true` after `flashcardService.processSession()` resolves.
- `processSession()` still returns `[]` for several non-success cases:
  - LLM not configured
  - malformed model output
  - transient request failure

References:

- `app/src/screens/AskScreen.tsx`
- `app/src/services/flashcard.service.ts`

Impact:

- Sessions can still be marked complete even when extraction never actually succeeded.
- Flashcards can still be lost permanently for a conversation.

### 4. Streaming timeout behavior is unchanged

Severity: Medium-High

Current state:

- The code still says the 30-second timeout is for receiving the first streaming byte.
- In practice, the timeout signal is still attached to the full request lifetime.
- OpenAI, Claude, and Gemini stream paths still use this same approach.

References:

- `app/src/providers/llm/index.ts`

Impact:

- Long responses can still be cut off after about 30 seconds even if the stream is healthy.

### 5. Graph relationships are still asymmetric by default

Severity: Medium

Current state:

- Newly created questions still store outbound `relatedQuestionIds` only on the new question.
- Existing related questions are still not backfilled at creation time.
- `getUnlinkedNodes()` still treats “no outbound links” as unlinked.

References:

- `app/src/services/question.service.ts`
- `app/src/services/graph.service.ts`

Impact:

- Nodes can still appear unlinked even when they are conceptually connected.
- Recommendation and inbox behavior can still be inconsistent.

### 6. SQLite write-through remains incomplete

Severity: Medium

Current state:

- Initial question creation still persists to SQLite.
- `updateReviewSchedule()` still only updates localStorage.
- `patchQuestion()` still only updates localStorage.
- `updateRelatedIds()` does persist to SQLite, but the overall write-through strategy is still partial and inconsistent.

References:

- `app/src/services/question.service.ts`
- `app/src/services/graph.service.ts`

Impact:

- Question state can still drift between localStorage and SQLite.
- Native rehydration can still restore stale copies of question data.

### 7. Deleting a session still leaves derived flashcards behind

Severity: Medium

Current state:

- `flashcardService.deleteBySession()` still exists.
- `handleDeleteSession()` still does not call it.

References:

- `app/src/screens/AskScreen.tsx`
- `app/src/services/flashcard.service.ts`

Impact:

- Deleted conversations can still leave review artifacts in the flashcard library and queue.

## Build Verification

Command run:

```bash
npm run build
```

Observed result:

- Build still fails.

Error summary:

- `src/components/ChatInput.tsx(69,50): error TS2345`
- `src/screens/HomeScreen.tsx(159,52): error TS2345`

Reason:

- `TTSConfig` is still being passed to `transcribeAudio()`, which expects a config object with a required `apiKey: string`.

## What Changed vs Previous Audit

There are no meaningful signs that the key fixes were completed in the audited areas.

Some surrounding code has changed, but the core defects previously reported are still present:

- build break still present
- message/question data drift still present
- session processing bug still present
- streaming timeout bug still present
- graph asymmetry still present
- persistence drift still present
- missing cascade deletion still present

## Recommendation

The codebase still needs the original fix plan to be implemented for real.

Recommended order:

1. Fix STT typing/config and restore build health.
2. Make chat message actions synchronize with persisted question lifecycle.
3. Replace the boolean session processing model with a retry-safe status model.
4. Separate first-byte timeout from idle-stream timeout.
5. Normalize graph link semantics and backfill if needed.
6. Make SQLite persistence truly consistent for all question mutations.
7. Apply the intended cascade behavior when deleting sessions and other derived artifacts.

## Bottom Line

The implementation is not complete. The re-audit shows that the most important previously identified issues are still present in the current codebase.
