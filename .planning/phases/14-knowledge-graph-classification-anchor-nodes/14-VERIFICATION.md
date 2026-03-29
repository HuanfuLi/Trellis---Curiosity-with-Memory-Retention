---
phase: 14-knowledge-graph-classification-anchor-nodes
verified: 2026-03-29T21:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 10/10
  note: "Initial VERIFICATION.md claimed passed but was written before UAT revealed the askStreaming gap. This re-verification incorporates the 14-04 gap-closure fix and confirms all truths hold after the fix."
  gaps_closed:
    - "classifyAndAnchor now called in askStreaming (useQuestions.ts lines 120-126)"
  gaps_remaining: []
  regressions: []
---

# Phase 14: Knowledge Graph Classification & Anchor Nodes — Verification Report

**Phase Goal:** Fix mindmap branch/cluster name quality by separating classification into a dedicated second LLM call, and introduce concept anchor nodes so the mindmap displays clean concept names instead of raw questions.
**Verified:** 2026-03-29T21:00:00Z
**Status:** passed
**Re-verification:** Yes — after UAT identified gap (Plan 14-04 closed it)

---

## Re-verification Context

The initial VERIFICATION.md was produced before UAT. UAT (documented in 14-UAT.md) found 4 major issues:

- Tests 2, 3, 4, 5 all failed because `askStreaming` in `useQuestions.ts` never called `classifyAndAnchor`.
- Root cause: the `classifyAndAnchor` call was added only to `questionService.ask()`, but `AskScreen` exclusively uses `askStreaming`.

Plan 14-04 fixed this with commit `7b4c7e5e`: added the import and fire-and-forget call to `askStreaming`.

This re-verification checks all 10 truths against the post-fix codebase.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | First LLM call JSON schema contains no `knowledgeDecision` field | VERIFIED | `grep knowledgeDecision app/src/services/question.service.ts` — no matches |
| 2 | `decideIngestionOutcome` returns only `{ outcome, targetNodeId? }` with no label fields | VERIFIED | `canonical-knowledge.service.ts` lines 257-288: all five return paths contain only `outcome` and optional `targetNodeId` |
| 3 | `Question` type has `isAnchorNode`, `qaCount`, and `shortSummary` fields | VERIFIED | `types/index.ts` lines 33-35: all three optional fields present with correct comments |
| 4 | `IngestionDecision` type has only `outcome` and `targetNodeId` fields | VERIFIED | `types/index.ts` lines 375-378: two-field interface, no label fields |
| 5 | `ClassificationResult` type is exported with `anchorName` and `anchorId` | VERIFIED | `types/index.ts` lines 380-388: exported interface with all required fields |
| 6 | Second LLM call fires only when `filterQuestion` confirms `flagged !== true` — in BOTH `ask()` and `askStreaming()` | VERIFIED | `question.service.ts` line 255 (`ask`), `useQuestions.ts` lines 122-126 (`askStreaming`): both guarded by `question.flagged !== true` |
| 7 | Second call receives question text and existing branch/cluster tree structure | VERIFIED | `canonical-knowledge.service.ts` lines 410-428: `buildTreeContext(allQuestions)` injected into system prompt |
| 8 | Anchor nodes created with `isAnchorNode: true` and Q&As attached via `parentId` | VERIFIED | `canonical-knowledge.service.ts` line 511: `isAnchorNode: true` on anchor creation; line 538: `parentId: anchorId` patched onto Q&A |
| 9 | Anchor `nodeSummary` grows as append-only log; `qaCount` increments on each attachment | VERIFIED | `canonical-knowledge.service.ts` lines 546-554: `newSummary` concatenated, `qaCount: (anchor.qaCount || 0) + 1` |
| 10 | Mindmap renders only anchor nodes as leaves; Q&As accessible via expand/retract; legacy nodes backward compatible | VERIFIED | `GraphScreen.tsx` lines 31-88: `buildAnchorReflectionTree` used, anchor `expanded: false` (line 57), `qaChildren` as children (lines 58-62), `legacyNodes` as direct leaves (lines 65-69) |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/types/index.ts` | `isAnchorNode`, `qaCount`, `shortSummary` on Question; stripped IngestionDecision; ClassificationResult export | VERIFIED | Lines 33-35 (Question fields), lines 375-388 (IngestionDecision, ClassificationResult) |
| `app/src/services/canonical-knowledge.service.ts` | `classifyAndAnchor`, `buildTreeContext`, `buildAnchorReflectionTree`, stripped `decideIngestionOutcome` | VERIFIED | All four functions exported at lines 257, 381, 405, 581 |
| `app/src/services/question.service.ts` | No `knowledgeDecision` in first call; `classifyAndAnchor` wired in `ask()` | VERIFIED | No `knowledgeDecision` in file; `classifyAndAnchor` imported (line 11) and called (line 258) |
| `app/src/state/useQuestions.ts` | `classifyAndAnchor` called in `askStreaming` after `filterQuestion` gate | VERIFIED | Line 7 imports `classifyAndAnchor`; lines 120-126: fire-and-forget call guarded by `question.flagged !== true` — this was the UAT gap now closed by Plan 14-04 |
| `app/src/screens/GraphScreen.tsx` | `buildMindElixirData` uses `buildAnchorReflectionTree`; anchor detail panel shows "CONCEPT ANCHOR" | VERIFIED | Import line 11, usage line 40, "CONCEPT ANCHOR" label line 655, `isAnchorNode` checks lines 647/683 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useQuestions.ts` (askStreaming) | `canonical-knowledge.service.ts` | `classifyAndAnchor` fire-and-forget | WIRED | Line 7 imports, lines 122-126 calls with `question, questionService.getAll(), llmConfig` — **this was the UAT gap; now fixed** |
| `question.service.ts` (ask) | `canonical-knowledge.service.ts` | `classifyAndAnchor` fire-and-forget | WIRED | Line 11 imports, line 258 calls |
| `question.service.ts` | `canonical-knowledge.service.ts` | `decideIngestionOutcome` | WIRED | Used in `buildAndSave` |
| `canonical-knowledge.service.ts` | `providers/llm/index.ts` | `chatCompletion` for second call | WIRED | `classifyAndAnchor` calls `chatCompletion` at line 431 |
| `canonical-knowledge.service.ts` | `question.service.ts` | `questionService.patchQuestion` (lazy import) | WIRED | Line 466 lazy import, line 533 patches Q&A, lines 548-555 patches anchor |
| `GraphScreen.tsx` | `canonical-knowledge.service.ts` | `buildAnchorReflectionTree` import | WIRED | Line 11 imports, line 40 calls in `buildMindElixirData` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GraphScreen.tsx buildMindElixirData` | `nodes: Question[]` | `graphService.getGraph()` → `questionService.getAll()` → localStorage | Yes — reads all stored questions including anchors | FLOWING |
| `classifyAndAnchor` anchor creation | `anchorNode` | localStorage `echolearn_questions` → `store.unshift(anchorNode)` → `localStorage.setItem` | Yes — direct localStorage write with fully-populated anchor object | FLOWING |
| `classifyAndAnchor` Q&A label patch | `result` from LLM | `chatCompletion` returns JSON → parsed into `ClassificationResult` | Yes — real LLM call; keyword fallback on parse failure | FLOWING |
| `askStreaming` in `useQuestions.ts` | `classifyAndAnchor` trigger | Question saved via `questionService.buildAndSave`, then `filterQuestion`, then fire-and-forget second call | Yes — second call receives live store snapshot via `questionService.getAll()` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with zero errors | `npx tsc --noEmit` in `app/` | No output | PASS |
| `knowledgeDecision` absent from first-call prompt | `grep knowledgeDecision app/src/services/question.service.ts` | No matches | PASS |
| `classifyAndAnchor` exported from canonical-knowledge | `grep "export async function classifyAndAnchor"` | Match at line 405 | PASS |
| `classifyAndAnchor` imported in `useQuestions.ts` | `grep classifyAndAnchor app/src/state/useQuestions.ts` | Matches at lines 7 and 123 | PASS |
| Guard `question.flagged !== true` present in `askStreaming` | `grep "flagged !== true" app/src/state/useQuestions.ts` | Match at line 122 | PASS |
| Anchor guard in `projectQuestionToKnowledgeNode` | `grep "isAnchorNode === true" canonical-knowledge.service.ts` | Match at line 68 (returns null) | PASS |
| `expanded: false` on anchor NodeObj | `grep "expanded: false" GraphScreen.tsx` | Match at line 57 | PASS |
| `CONCEPT ANCHOR` label in detail panel | `grep "CONCEPT ANCHOR" GraphScreen.tsx` | Match at line 655 | PASS |
| Fix commit exists in git history | `git log --oneline \| grep 7b4c7e5e` | `7b4c7e5e fix(14-04): call classifyAndAnchor in askStreaming after filterQuestion` | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| GRAPH-01 | 14-02, 14-04 | Dedicated second LLM call fired only after filterQuestion, in both ask() and askStreaming() | SATISFIED | `question.service.ts` line 255; `useQuestions.ts` lines 122-126 — both paths guarded |
| GRAPH-02 | 14-02 | Second call receives question text, <=30-word self-answer, keyword, existing tree — never inherits labels from prior candidate nodes | SATISFIED | `classifyAndAnchor` system prompt uses independent `buildTreeContext` read; prompt requests `briefAnswer`, `keyword`, `branchLabel`, `clusterLabel`, `anchorName` |
| GRAPH-03 | 14-01 | `decideIngestionOutcome` returns only `{ outcome, targetNodeId }` — all label fields stripped | SATISFIED | `canonical-knowledge.service.ts` lines 257-289: all return paths label-free |
| GRAPH-04 | 14-01, 14-02 | Concept anchor nodes explicitly created by LLM with clean noun/concept name | SATISFIED | `classifyAndAnchor` creates `anchorNode` with `isAnchorNode: true`, title set to `result.anchorName` from LLM |
| GRAPH-05 | 14-01, 14-02 | Q&A nodes attach to anchor via `parentId`; anchor maintains append-only `nodeSummary` log | SATISFIED | Q&A patched with `parentId: anchorId` (line 538); anchor `nodeSummary` concatenated with `[qa.id]` prefix (lines 530, 547) |
| GRAPH-06 | 14-03 | Mindmap renders only anchor nodes as leaves; individual Q&As accessible via Mind-Elixir expand/retract | SATISFIED | `GraphScreen.tsx buildMindElixirData` uses `buildAnchorReflectionTree`; anchors get `expanded: false` with `qaChildren` as NodeObj children |

All 6 requirements satisfied. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `canonical-knowledge.service.ts` | 516-522 | Direct `localStorage.getItem/setItem` bypass of `questionService` for anchor creation | Info | Deliberate workaround to avoid circular dependency (lazy import is used for subsequent patches). Anchor stored to correct key `echolearn_questions`. Not a functional blocker. |

No TODO/FIXME/placeholder patterns found in modified files. No empty implementation stubs.

---

### Human Verification Required

#### 1. Second Classification Call End-to-End (Re-test after UAT fix)

**Test:** Ask a question through AskScreen with a configured LLM. Wait 2-5 seconds after the answer appears. Open the GraphScreen.
**Expected:** A concept anchor node appears under the correct branch/cluster (e.g., "Spaced Repetition" under "Psychology > Memory"). The anchor shows `(1)` in its label. The Q&A is a child of the anchor, visible after expanding.
**Why human:** Requires a live LLM API key and runtime observation of the async second call firing from `askStreaming`.

#### 2. Anchor Expand/Collapse in GraphScreen

**Test:** Open GraphScreen with at least one anchor node visible. Click the expand toggle on an anchor node.
**Expected:** Q&A children expand. Clicking the anchor node shows the "CONCEPT ANCHOR — N Q&As" detail panel (no navigate to `/ask/:id`). Clicking a Q&A child shows its detail panel and navigates to `/ask/:id`.
**Why human:** Mind-Elixir expand/collapse is visual browser interaction.

#### 3. Legacy Node Backward Compatibility

**Test:** Open GraphScreen with pre-Phase-14 questions in localStorage (no `isAnchorNode`, no `parentId`).
**Expected:** Legacy Q&A nodes appear directly under their cluster as before. No data loss or hidden nodes.
**Why human:** Requires pre-existing legacy localStorage data.

---

### Gaps Summary

No gaps found after re-verification. The UAT-identified root cause (missing `classifyAndAnchor` call in `askStreaming`) was fixed by Plan 14-04 commit `7b4c7e5e`. All 10 observable truths are verified, all 6 requirements are satisfied, TypeScript compiles clean, and the fix commit is present in git history.

The phase goal is fully achieved: answer generation and knowledge-graph classification are separated into two distinct LLM calls, `askStreaming` (the primary AskScreen entrypoint) now fires the second call, concept anchor nodes are created with clean academic labels, Q&A nodes attach to anchors via `parentId`, and the mindmap renders the anchor-based hierarchy with collapsed Q&A children.

---

_Verified: 2026-03-29T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after Plan 14-04 gap closure_
