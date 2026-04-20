# Live Mindmap: Design Problem-Solving Record

A detailed record of the design challenges, attempted solutions, and architectural trade-offs encountered while building EchoLearn's live knowledge mindmap — the system that automatically organizes user Q&A into a hierarchical knowledge graph in real-time.

---

## 1. System Overview

### 1.1 What the Mindmap Does

EchoLearn's knowledge mindmap is a live, auto-organizing knowledge graph that builds itself as the user asks questions. Every question the user asks in the Ask screen is:

1. **Answered** by an LLM with full session context
2. **Stored** as a Q&A node in the knowledge graph
3. **Classified** into a 4-level hierarchy: `Root (Knowledge) -> Branch (discipline) -> Cluster (domain) -> Anchor (concept noun) -> QA (leaf)`
4. **Connected** to related Q&A nodes via keyword overlap and embedding-based cosine similarity

The mindmap drives multiple downstream features:
- **Trellis** — a health visualization where each anchor is a plant whose leaf state (bud/green/yellow/falling/fallen/blossom/fruit) reflects the user's review engagement
- **SM-2 Review Scheduling** — spaced repetition flashcards extracted from Q&A nodes
- **Podcast Generation** — daily audio recaps sourced from anchor concepts
- **Concept Feed** — a social-media-style feed of learning posts generated from anchors
- **Graph Visualization** — an interactive mindmap UI (MindElixir) showing the full hierarchy

### 1.2 Key Data Structures

```
Question (types/index.ts) — the universal node type for BOTH anchors and Q&A leaves:
  id: string
  content: string              // the question text
  answer: string               // the LLM response
  isAnchorNode?: boolean       // true = concept container, false/undefined = Q&A leaf
  parentId?: string            // links Q&A leaf -> anchor (the critical hierarchy link)
  branchLabel?: string         // inherited from classification
  clusterLabel?: string        // inherited from classification
  rootLabel?: string           // inherited from classification
  embeddingVector?: number[]   // for semantic similarity
  relatedQuestionIds: string[] // concept bridges to other Q&As
  reviewSchedule: { nextReviewDate, reviewCount, easeFactor }
  flagged?: boolean            // off-topic marker
  prunedFromTrellis?: boolean  // user-pruned from trellis
```

```
ChatSession (types/index.ts) — the conversation container:
  id: string
  title: string                // LLM-generated from first Q&A exchange
  messages: SessionMessage[]   // { type: 'user'|'ai', content, questionId? }
  processed: boolean           // true once flashcard extraction has run
  origin?: SessionOrigin       // 'post' origin for post-context sessions
```

### 1.3 The Classification Pipeline

Classification runs **asynchronously** (fire-and-forget) after each Q&A is persisted:

```
User sends message
  -> LLM streams response (1-3s)
  -> buildAndSave() persists Q&A node immediately
  -> filterQuestion() checks off-topic status
  -> void classifyAndAnchorIncremental() fires (5-20s async)
      -> preCheckAnchorMatch(): embed question, cosine scan all anchors
         -> if match >= 0.82: reuse anchor, skip LLM tree descent
         -> if no match: 3-step LLM classification (branch -> cluster -> anchor)
      -> commitClassificationResult(): create/reuse anchor, patch Q&A with parentId
      -> emit GRAPH_UPDATED event
```

The 3-step LLM tree descent is a token-saving design: the LLM never sees the full graph. It picks a branch from branch names only, then a cluster within that branch, then an anchor within that cluster. This scales to large mindmaps but has structural limitations (see Problem 3).

---

## 2. Problem 1: Off-Topic Filtering

### 2.1 The Problem

The off-topic filter (`question-filter.service.ts`) uses a hybrid approach:
1. **Fast pattern matching** — 11 regex categories with confidence scores (greetings, meta-questions, jailbreaks, spam, etc.)
2. **LLM fallback** — invoked only when pattern confidence is ambiguous (> 0 but < 0.75)

**The gap:** When a message matches zero patterns (confidence = 0), the LLM fallback is never triggered, and the message is assumed valid. Short ambiguous inputs like "you", "hey", or "lol what" have zero pattern confidence because no regex matches them exactly. They pass through the filter, get stored as Q&A nodes, and pollute the mindmap with garbage.

### 2.2 Root Cause

The control flow at lines 126-136 of `question-filter.service.ts`:

```typescript
// confidence > 0 triggers LLM fallback
if (patternResult.confidence > 0) {
  // ... LLM check
}
// confidence === 0 → assume valid (THE BUG)
return { ...question, flagged: false };
```

Zero confidence doesn't mean "definitely valid" — it means "no signal." The filter treats absence of evidence as evidence of absence.

### 2.3 Proposed Solution

Fix the control flow: route short zero-confidence queries (<=3 words) to the LLM fallback when available. The LLM already has a good system prompt for this classification and handles session context for follow-up detection.

### 2.4 Considered Alternative: Embedding-Based Exemplar Matching

The user proposed pre-building a bank of ~20-30 canonical off-topic phrases with embeddings, then computing cosine similarity between new queries and exemplars to catch semantic near-misses.

**Why we deferred this approach:**
- Exemplar embeddings can't be pre-shipped — embedding dimensions and semantic spaces vary by provider/model. They must be computed per-user on first use, cached, and invalidated on model change.
- Embedding models encode meaning proximity, not the off-topic/on-topic boundary. "You" is close to both "how are you" (off-topic) and "how do you learn" (valid).
- The exemplar coverage problem — off-topic queries are an open-ended class. The bank would need constant growth, becoming a more expensive version of the regex list.
- The simpler LLM fallback fix covers the actual gap (short ambiguous inputs) without new infrastructure.

**The embedding approach remains viable** for a future iteration if longer off-topic queries (5+ words) prove to be a problem that dodges both regex and LLM classification.

### 2.5 Status

- Pattern filter: **Implemented and working** for high-confidence cases
- LLM fallback for short queries: **Designed, not yet implemented**
- Embedding exemplar approach: **Deferred**

---

## 3. Problem 2: Cross-Branch Duplicate Anchors

### 3.1 The Problem

The 3-step classification pipeline (branch -> cluster -> anchor) commits to a branch at step 1 based on branch names only, before seeing which anchors exist elsewhere. A concept like "Spaced Repetition" plausibly fits both "Cognitive Science" and "Educational Technology." Once the LLM picks one branch, it's locked into that subtree and cannot discover a matching anchor living in another branch. Result: duplicate anchors across branches.

### 3.2 Root Cause

The by-layer tree descent is a deliberate token-saving design — the LLM never sees the full graph. But this creates a structural blind spot for cross-cutting concepts. The LLM makes an irrevocable branch decision with incomplete information.

### 3.3 Implemented Solution: Embedding Pre-Check (Phase 33)

An O(N_anchors) cosine pre-check runs BEFORE the tree descent in `classifyAndAnchorIncremental`:

1. **Embed the question's content.** Compare against every existing anchor's `embeddingVector`.
2. **If cosine similarity >= 0.82** (the `ANCHOR_PRE_CHECK_SIMILARITY_THRESHOLD`), reuse that anchor AND adopt its `branchLabel` + `clusterLabel`. Skip the tree descent entirely. **Zero LLM tokens on the match path.**
3. **Opportunistic backfill:** Anchors created before this feature have no `embeddingVector`. Backfill up to 8 per classification call.
4. **Normalize anchor lookup on BOTH sides** — both `result.anchorName` and stored `q.title` pass through `normalizeAnchorName()`.
5. **Case-insensitive NEW coercion** at step 1 + step 2 — if the LLM returns `{"index":"NEW","name":"psychology"}` and "Psychology" already exists, coerce to selection.

**Commits:**
- `73aeb159` — feat(classification): embedding pre-check + dedup guards + stronger prompts
- `1ac251a1` — test(classification): 8-test dedup + prompt regression suite
- `863228d8` — docs(33): UAT gap entry + CLAUDE.md invariants

### 3.4 Known Limitations

- **Threshold 0.82 is a conservative guess.** Too high misses legitimate near-duplicates; too low false-positive merges unrelated concepts. Needs tuning after device data shows the pass/fail distribution.
- **Existing graph pollution persists.** Anchors created before the pre-check keep their duplicate names. No migration — the user can manually reorganize via the Reorganize button or Clear-All-Data + re-classify.
- **Branch prompt doesn't include branch CONTENTS** — deferred until we see if the pre-check alone is sufficient for most cases.

### 3.5 Status

- Embedding pre-check: **Implemented and tested** (8 regression tests)
- Threshold tuning: **Awaiting device data**
- Branch content enrichment: **Deferred**

---

## 4. Problem 3: Follow-Up Messages Creating Garbage Nodes

### 4.1 The Problem

Every message in the Ask screen becomes a standalone Q&A node in the mindmap. But not every message is a knowledge question:

| Message Type | Example | Should It Be a Node? |
|---|---|---|
| New topic question | "What is photosynthesis?" | Yes — new Q&A leaf |
| Topical follow-up | "How does it differ in C4 plants?" | Debatable — could be sibling node under same anchor |
| Conversation directive | "Answer differently", "Explain simpler", "Give an example" | No — this is a conversation artifact, not knowledge |

When a user sends "Answer differently":
1. The AI answers correctly (it has full session history)
2. `buildAndSave("Answer differently", <LLM response>)` creates a new Question node
3. `decideIngestionOutcome` finds zero keyword overlap with anything → outcome: 'new'
4. `classifyAndAnchorIncremental` tries to classify "Answer differently" as a standalone question
5. Result: a garbage node in the mindmap, possibly under a nonsensical anchor

### 4.2 Intersection with Off-Topic Filter

The off-topic filter should catch "Answer differently" — but it doesn't. The phrase has zero pattern confidence (no regex matches it), and the LLM fallback is never triggered (zero confidence → skip). Even if the LLM fallback fires, it receives `sessionContext` (the prior Q&A pair), which could help it recognize the directive — but this code path is unreachable under the current control flow.

### 4.3 Three Design Models Explored

We explored three fundamentally different approaches to solving this problem:

#### Model A: Directive Detection + Skip Ingestion

Detect conversation directives before `buildAndSave` and skip node creation entirely. The AI already answered correctly in the chat stream; the response lives in session history. The mindmap just doesn't get polluted.

**Detection heuristics:**
- Has session context (prior Q&A exists) — necessary condition
- Short (<=8 words) — directives are almost always brief
- No question word (what/why/how/when/where/which) at start
- Matches directive patterns: "answer differently", "explain more", "give example", "simplify", etc.
- LLM fallback for ambiguous cases

**Pros:** Minimal code change (~3 files), no data model change, each fix independent and testable.

**Cons:** Heuristic — will have false negatives (exotic directives slip through) and potential false positives (short genuine questions like "What about DNA?").

#### Model B: Session-as-Leaf

Make the entire chat session the atomic unit in the mindmap, replacing individual Q&A nodes. All messages within a session belong to one leaf node. Classification runs once per session (or on session close), not per message.

**Pros:**
- Eliminates the directive problem entirely — directives are just part of the session
- Eliminates the classification timing race (classify once, not per-message)
- Conceptually cleaner — users think in sessions, not individual messages

**Cons (discovered through deep research):**
- **`parentId` is a load-bearing wall** — 36 references across the codebase link Q&A nodes to anchors. Every downstream consumer (trellis, graph, feed, anchor detail, cluster detail) queries `q.parentId === anchor.id`. Session-as-leaf breaks all of them.
- **SM-2 review requires per-Q&A granularity** — `computeLeafState` does "worst-child-wins" aggregation across individual Q&A review schedules. A session-level review schedule loses this signal.
- **`relatedQuestionIds` has no session equivalent** — the feed, flashcards, and context ranking all use per-Q&A semantic links. "Related sessions" would need expensive recomputation.
- **Sessions are mutable** — users can reopen and continue old sessions. If the session is the mindmap leaf, adding a message means the leaf mutates: embedding, keywords, summary, review schedule all need recomputation.
- **Cross-session same-topic problem** — a user may have 5 sessions over 5 days about "Spaced Repetition." These shouldn't be 5 separate leaves but would be under session-as-leaf, requiring a secondary dedup/merge mechanism that recreates the same problem at the session level.
- **Implementation cost** — ~10 files, schema change, tree rebuild rewrite, data migration for existing users. High regression risk.

#### Model C: Session-Aware Anchor Inheritance

Keep per-Q&A nodes but make the ingestion path session-aware. When a session has an established anchor (first question classified successfully), subsequent messages inherit that anchor by default instead of running independent classification.

**Proposed flow:**
1. First message in session → full classification → establishes "session anchor"
2. Subsequent messages → embed → compare to session anchor embedding
   - High similarity → inherit anchor, skip classification
   - Low similarity → topic break → run full classification, new anchor
3. Directives ("answer differently") → semantically similar to prior Q&A → inherit anchor → node created but correctly placed

**Critical timing flaw discovered:** Classification is fire-and-forget and takes 5-20 seconds. The user can easily send a follow-up before the first message's anchor exists. At that point there is no session anchor to inherit from. Two rapid messages trigger parallel, independent classifications with stale store snapshots — both may create duplicate anchors. The model's core assumption (session has an established anchor) fails in the most common case (user sends a follow-up quickly).

**Mitigation:** A classification queue (serialize calls) would fix the timing issue but adds significant machinery and latency for the second message.

### 4.4 Comparative Analysis

| Dimension | Model A (Directive Detection) | Model B (Session-as-Leaf) | Model C (Anchor Inheritance) |
|---|---|---|---|
| Solves directive problem | Yes — skip ingestion | Yes — directives stay in session | Partially — directives create nodes but under correct anchor |
| Solves follow-up duplication | No — needs separate fix | Yes — all messages in one leaf | Yes — inheritance prevents duplicate classification |
| Classification timing race | Needs classification queue | Eliminated — classify once | Needs classification queue |
| Off-topic filtering | Needs LLM fallback fix | Simpler — only filter first message | Needs LLM fallback fix + embedding comparison |
| Review granularity | Preserved (per-Q&A) | Lost (session-level) | Preserved (per-Q&A) |
| Concept bridges | Preserved | Lost (must recompute) | Preserved |
| Implementation cost | Low (~3 files, additive) | Very high (~10 files, schema change, migration) | Medium (~5 files, new queue + inheritance logic) |
| Regression risk | Low — each fix independent | High — touches every downstream consumer | Medium — touches classification + ask flow |
| Cross-session dedup | Already solved (embedding pre-check) | New problem (5 sessions = 5 leaves for same topic) | Already solved (embedding pre-check) |
| Session mutation | No issue | Complicates everything | Minor — new messages just add sibling nodes |

### 4.5 Current Decision

**Model A (Directive Detection + Skip Ingestion) chosen for Phase 33** as the pragmatic path. It solves the immediate user-facing problems without touching the data model:

1. **Skip ingestion for directives** — heuristic + LLM fallback before `buildAndSave`
2. **Fix off-topic filter control flow** — route short zero-confidence queries to LLM fallback
3. **Classification queue** — serialize `classifyAndAnchorIncremental` calls to prevent timing races

Model B (Session-as-Leaf) remains a candidate for a **future major refactor** if the per-Q&A model proves fundamentally insufficient, but the research shows it would be a multi-phase effort touching the entire data layer.

### 4.6 Status

- Directive detection: **Designed, not yet implemented**
- Classification queue: **Designed, not yet implemented**
- Session-as-leaf: **Researched and deferred** — documented here for future reference

---

## 5. Problem 4: Graph Screen Not Refreshing After Node Deletion

### 5.1 The Problem

When a user deletes a node (concept anchor or Q&A) from a detail page within the Graph screen, the mindmap visualization does not refresh. The user must quit and reopen the app to see the updated graph.

### 5.2 Root Cause

`questionService.delete()` emits `QUESTION_DELETED`, but `GraphScreen` only subscribes to `GRAPH_UPDATED` and `REORG_*` events. The event subscriber matrix:

| Event | Emitted By | GraphScreen Listens? |
|---|---|---|
| `QUESTION_DELETED` | `questionService.delete()` | No |
| `ANCHOR_DELETED` | `trellisActionsService.prune()` | No |
| `GRAPH_UPDATED` | `classifyAndAnchorIncremental()`, `replant()` | Yes |

Deleting a node IS a graph mutation, but it emits a different event that the graph doesn't listen to.

### 5.3 Implemented Solution

Added `eventBus.emit({ type: 'GRAPH_UPDATED' })` to `questionService.delete()` (line 483), so the GraphScreen's existing `GRAPH_UPDATED` subscriber triggers `reload()`.

### 5.4 Status

- Fix: **Implemented** (single line addition)
- Testing: **Pending device verification**

---

## 6. Architectural Observations

### 6.1 The parentId Load-Bearing Wall

The `parentId` field on `Question` is the single most critical relationship in the data model. It links Q&A leaves to concept anchors, and through that link, powers:
- Trellis health computation (aggregate child review states)
- Graph visualization (anchor -> children tree)
- Feed generation (group content by concept)
- Anchor/Cluster detail screens (list children)
- Flashcard placement (inherit anchor's branch/cluster labels)

Any design that touches `parentId` semantics affects all of these. This was the primary reason Session-as-Leaf was deferred.

### 6.2 Fire-and-Forget Classification: Feature and Liability

Classification is async and non-blocking — the user sees their answer immediately while classification runs in the background (5-20 seconds). This is critical for UX (no spinner while the LLM does 3 classification calls). But it means:
- The Q&A node exists in the store for seconds before it has a `parentId`
- Any follow-up message during this window can't inherit the pending anchor
- Parallel classifications from rapid messages read stale store snapshots
- The embedding pre-check can miss if the first message's anchor hasn't been created yet

A classification queue (serializing calls) would fix races but add latency to the second message. This is an inherent tension between UX responsiveness and data consistency.

### 6.3 The Question Type Does Double Duty

`Question` represents both concept anchors (`isAnchorNode: true`) and Q&A leaves. This is elegant (no schema duplication, anchors participate in review scheduling) but means every query over questions must filter by `isAnchorNode` to avoid mixing levels. It also means anchor-specific fields (`qaCount`, `nodeSummary`) pollute the Q&A type and vice versa.

### 6.4 Sessions Are a UI Boundary, Not a Knowledge Boundary

A session starts when the user opens the app or taps "New Chat." A knowledge topic may span multiple sessions (user returns to the same subject over days) or a single session may cover multiple topics (user asks about Transformers in a Spaced Repetition session). The mismatch between session boundaries and knowledge boundaries is the root cause of Problem 3 and the reason Session-as-Leaf introduces as many problems as it solves.

---

## 7. Summary of Current State

| Problem | Solution | Status |
|---|---|---|
| Off-topic filter blind spot (short queries) | LLM fallback for short zero-confidence queries | Designed |
| Cross-branch duplicate anchors | Embedding pre-check before tree descent | **Implemented** |
| Follow-up directives creating garbage nodes | Directive detection + skip ingestion | Designed |
| Classification timing races | Serialized classification queue | Designed |
| Graph not refreshing after deletion | Emit GRAPH_UPDATED on delete | **Implemented** |
| Session-as-leaf architecture | Researched and deferred | Documented |

---

## 8. References

### Key Files
- `app/src/services/question-filter.service.ts` — off-topic filter (pattern + LLM hybrid)
- `app/src/services/canonical-knowledge.service.ts` — classification pipeline, embedding pre-check, tree builder
- `app/src/services/question.service.ts` — Q&A CRUD, embedding, delete events
- `app/src/state/useQuestions.ts` — ask streaming flow, classification trigger
- `app/src/screens/AskScreen.tsx` — session management, message handling
- `app/src/services/session.service.ts` — session lifecycle
- `app/src/services/trellis-state.service.ts` — trellis health computation
- `app/src/screens/GraphScreen.tsx` — mindmap visualization + event subscriptions
- `app/src/types/index.ts` — Question, ChatSession, SessionMessage types

### Key Commits (Phase 33)
- `73aeb159` — embedding pre-check + dedup guards + stronger prompts
- `1ac251a1` — 8-test dedup + prompt regression suite
- `863228d8` — UAT gap entry + CLAUDE.md classification dedup section
- `4492456a` — ChatInput flex shrink fix (AskScreen keyboard overflow)

### CLAUDE.md Sections
- "Classification dedup -- embedding pre-check" — 5 rules for the pre-check invariants
- "Concept Feed Generation Pipeline" — 3-list architecture documentation
- "Event bus -- unified GRAPH_UPDATED" — single-event-per-signal principle
