# Architecture Research

**Domain:** Trellis v1.6 Control, Graph Trust, Retrieval, Podcast Controls, and Ethical Engagement
**Researched:** 2026-05-13
**Confidence:** HIGH for existing integration points; MEDIUM for proposed UX surface names

## Standard Architecture

### System Overview

v1.6 should extend Trellis through additive local-first services and typed events. The current architecture already has the right shape: React screens stay thin, services own business logic, `Question` records are the durable knowledge graph substrate, and screens re-read service state after event-bus signals.

```
+--------------------------------------------------------------------------+
| React Screens / Hooks                                                     |
| Ask/useQuestions | GraphScreen | PodcastScreen | SavedScreen | Home      |
+-------------------------+------------------+-----------------------------+
                          | calls services + subscribes to typed events
                          v
+--------------------------------------------------------------------------+
| Domain Services                                                           |
| questionService        -> persists Q&A and durable knowledge nodes        |
| question-filter        -> should become ingestion gate, not chat gate     |
| canonical-knowledge    -> classifies root/branch/cluster/anchor           |
| graphService           -> graph reads and edge weights                    |
| podcastService         -> script/audio generation                         |
| engagementService      -> save/like/dismiss post and anchor signals       |
| NEW graph-edit         -> manual graph correction transactions            |
| NEW retrieval/library  -> search, tags, bookmarks, concept dashboards     |
| NEW learning-engagement-> goals, stop cues, reflection/retrieval prompts  |
+-------------------------+------------------+-----------------------------+
                          | persists local-first state
                          v
+--------------------------------------------------------------------------+
| Storage                                                                   |
| localStorage primary: trellis_questions, trellis_podcasts, engagement,    |
| post history, settings, new v1.6 metadata stores                          |
| SQLite backup: questions, edge_weights, planner tables                    |
| IndexedDB: podcast audio blobs                                            |
+--------------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `questionService` | Durable Q&A persistence, related IDs, SQLite write-through | Modify to support "answer but do not ingest" and batch graph patches |
| `question-filter.service.ts` | Current off-topic flagging | Refactor into ingestion evaluation with reason/confidence and override path |
| `canonical-knowledge.service.ts` | Automatic classification and anchor/cluster creation | Keep auto pipeline; respect manual graph locks and correction metadata |
| `graph.service.ts` | Graph reads, semantic candidates, edge weights | Add read helpers for editable graph operations; keep writes in new `graph-edit.service.ts` |
| `GraphScreen.tsx` | MindElixir rendering and node selection | Add correction UI that delegates every mutation to `graph-edit.service.ts` |
| `podcast.service.ts` | Daily script/audio generation and IndexedDB audio blobs | Add options snapshot and prompt builder for length/style controls |
| `PodcastScreen.tsx` | Player, concept list, generation trigger | Add learner controls before generation/regeneration |
| `SavedScreen.tsx` | Saved/Liked/History archive | Extend through retrieval/library service; avoid embedding search logic in the screen |
| NEW `retrieval.service.ts` | Unified local search over concepts, Q&As, posts, history, tags | Pure service returning typed ranked results |
| NEW `library.service.ts` | Tags/bookmarks and concept dashboard metadata | LocalStorage-backed leaf service, consumes existing engagement/post history |
| NEW `learning-engagement.service.ts` | Goals, stop cues, reflection prompts, learning metrics | Separate from `engagementService` so likes/saves do not become addictive metrics |

## Recommended Project Structure

```
app/src/
├── types/index.ts
│   └── Add ingestion, graph edit, podcast option, retrieval, and learning metric types
├── services/
│   ├── question-filter.service.ts      # refactor into ingestion evaluator
│   ├── question.service.ts             # gate durable writes; add batch patch helpers
│   ├── canonical-knowledge.service.ts  # respect graph locks/manual corrections
│   ├── graph.service.ts                # graph read helpers
│   ├── graph-edit.service.ts           # NEW: rename/move/merge/detach transactions
│   ├── retrieval.service.ts            # NEW: ranked search across local stores
│   ├── library.service.ts              # NEW: tags/bookmarks/dashboard metadata
│   ├── podcast.service.ts              # options-aware generation
│   └── learning-engagement.service.ts  # NEW: goals, cues, reflection, metrics
├── screens/
│   ├── GraphScreen.tsx                 # correction controls
│   ├── PodcastScreen.tsx               # length/style controls
│   ├── SavedScreen.tsx                 # search/tags/bookmark/history improvements
│   └── ConceptDashboardScreen.tsx      # NEW or extend AnchorDetailScreen
├── state/
│   ├── useQuestions.ts                 # ingestion flow for streaming ask path
│   ├── usePodcast.ts                   # option-aware generation state
│   └── useRetrieval.ts                 # NEW thin hook over retrieval/library events
└── tests/
    ├── services/graph-edit*.test.mjs
    ├── services/question-ingestion*.test.mjs
    ├── services/retrieval*.test.mjs
    ├── services/podcast-options*.test.mjs
    └── services/learning-engagement*.test.mjs
```

### Structure Rationale

- **Keep services as owners:** This matches the repo's existing business-logic boundary and keeps screens from becoming persistence coordinators.
- **Use additive leaf services:** `engagementService` and `postHistoryService` show the preferred localStorage-backed leaf pattern. Retrieval, library metadata, and ethical engagement should follow that style.
- **Do not create a new graph database:** The graph is already encoded in `Question` fields (`parentId`, `isAnchorNode`, `isClusterNode`, `rootLabel`, `branchLabel`, `clusterLabel`, `clusterNodeId`, `qaCount`). v1.6 should add correction metadata, not fork the model.
- **Keep `GRAPH_UPDATED` as the broad invalidation event:** Existing subscribers already re-read from storage on that event. Add specific edit events only for toast/undo/history details.

## Architectural Patterns

### Pattern 1: Ingestion Gate After Natural Chat

**What:** Chat answer generation and durable graph ingestion must become separate decisions. Natural chat can still be answered, but only valid learning material becomes a `Question`/anchor input.

**When to use:** Ask/chat paths, especially `useQuestions.askStreaming` and `questionService.ask`.

**Trade-offs:** This changes the current streaming path, which calls `buildAndSave` before filtering and then patches `flagged`. The safer v1.6 shape is slightly more plumbing but prevents transient small talk and prompt-leak attempts from being broadcast as `QUESTION_ASKED`.

**Example:**

```typescript
const answer = await generateAnswer(content, history);
const decision = await ingestionGate.evaluate({ content, answer, sessionContext });

if (decision.ingest) {
  const question = questionService.buildAndSave(content, answer, store, {
    ingestion: decision,
  });
  eventBus.emit({ type: 'QUESTION_INGESTED', payload: { questionId: question.id, decision } });
  void classifyAndAnchorIncremental(question, questionService.getAll(), llmConfig, signal);
} else {
  eventBus.emit({ type: 'QUESTION_INGESTION_EVALUATED', payload: { decision } });
}
```

### Pattern 2: Graph Edits as Transactions Over `Question[]`

**What:** Manual graph correction should be centralized in `graph-edit.service.ts`. Each operation reads the latest `trellis_questions`, computes all affected patches, writes them together, records an edit log entry, updates SQLite via `questionService`, and emits events.

**When to use:** Rename anchor/cluster, move anchor, move Q&A, merge anchors, detach Q&A, restore/undo.

**Trade-offs:** A transaction helper is needed because current code patches one question at a time. Without centralization, `qaCount`, `nodeSummary`, child labels, and cluster aggregates will drift.

**Example:**

```typescript
graphEditService.moveAnchor({
  anchorId,
  targetClusterId,
  lockPlacement: true,
});

// Internally:
// 1. patch anchor labels + clusterNodeId
// 2. patch all child Q&As to the same labels/clusterNodeId
// 3. recompute old/new cluster qaCount
// 4. append GraphEditRecord
// 5. emit GRAPH_EDIT_APPLIED + GRAPH_UPDATED
```

### Pattern 3: Retrieval Reads Existing Stores, Tags Live Separately

**What:** Search should aggregate from `questionService`, `postHistoryService`, `engagementService`, and `podcastService`, while user-authored tags/bookmarks live in a dedicated localStorage store.

**When to use:** Saved/Liked/History search, concept dashboards, later "find this again" workflows.

**Trade-offs:** On-demand indexing is simpler and safer for local-first v1.6 than a persisted search index. Persist only user metadata; derive rankings from current data.

### Pattern 4: Option Snapshots for Podcasts

**What:** Store the learner's generation options on each `DailyPodcast` so the script/audio can be reproduced and invalidated deterministically.

**When to use:** Length/style controls, default podcast preferences, regeneration.

**Trade-offs:** A single daily podcast remains simpler than multiple variants per day. If options change, mark the existing podcast `pending` or generate over the same ID after explicit user action.

### Pattern 5: Ethical Engagement is Not Feed Engagement

**What:** Keep goals, stop cues, reflection prompts, and learning metrics in `learning-engagement.service.ts`, separate from `engagementService`.

**When to use:** Home feed cues, post-completion prompts, Saved retrieval prompts, Planner goals.

**Trade-offs:** Separating services avoids turning saves/likes into the central success metric. The app can show learning-oriented signals without corrupting the existing save/like/dismiss semantics.

## Data Flow

### v1.6 Ask and Ingestion Flow

```
User asks in AskScreen
  -> useQuestions.askStreaming / questionService.ask
  -> LLM answers naturally
  -> ingestionGate evaluates durable-learning eligibility
      -> not ingestible: session message only, no Question, no graph event
      -> ingestible: questionService.buildAndSave
          -> QUESTION_ASKED / QUESTION_INGESTED
          -> classifyAndAnchorIncremental
          -> GRAPH_UPDATED
  -> GraphScreen/Home/Planner re-read on GRAPH_UPDATED
```

Critical change: filtering is an ingestion boundary, not a presentation boundary. A valid learning question about "system prompts" must ingest; "show me your system prompt" must not.

### v1.6 Graph Correction Flow

```
GraphScreen node selected
  -> correction sheet/action
  -> graphEditService operation
  -> fresh Question[] read
  -> multi-node patch + graph edit log append
  -> SQLite write-through for patched questions
  -> GRAPH_EDIT_APPLIED
  -> GRAPH_UPDATED
  -> GraphScreen/useTrellisData/Planner/Home re-read local state
```

Affected records by operation:

| Operation | Records to Patch | Notes |
|-----------|------------------|-------|
| Rename anchor | Anchor title/content/summary/aliases, optional child placement reason | Keep `id` stable |
| Rename cluster | Cluster node, child anchors, child Q&As | Recompute reflection tree labels |
| Move anchor | Anchor labels/`clusterNodeId`, all child Q&A labels/`clusterNodeId`, old/new cluster `qaCount` | Mark manual lock so classifier does not move it back |
| Move Q&A | Q&A `parentId`, labels, `clusterNodeId`, old/new anchor `qaCount` and summaries | Use for "this answer belongs elsewhere" |
| Merge anchors | Survivor anchor metadata, all source child Q&As `parentId`, source anchor tombstone/`mergedIntoId`, cluster counts | Prefer reversible tombstone over hard delete |
| Detach Q&A | Q&A `parentId` removed, labels preserved or set to chosen cluster | Legacy leaf remains visible |

### v1.6 Retrieval Flow

```
SavedScreen / ConceptDashboard / Search UI
  -> retrievalService.search(query, filters)
      -> questionService.getAll({ includeFlagged: false })
      -> postHistoryService.getPosts()
      -> engagementService saved/liked IDs
      -> podcastService.getAll()
      -> libraryService tag/bookmark metadata
      -> ranked SearchResult[]
  -> UI opens /anchor/:id, /ask/:id, /posts/:id, or /podcast
```

The first implementation should use lexical matching plus existing `embeddingVector` where available. Persisting a separate vector index is unnecessary for v1.6.

### v1.6 Podcast Generation Flow

```
PodcastScreen controls
  -> usePodcast.generatePodcast(date, conceptIds, options)
  -> podcastService stores pending DailyPodcast with options snapshot
  -> prompt builder uses length/style/source concepts
  -> LLM script generation
  -> TTS synthesize
  -> IndexedDB audio blob
  -> PODCAST_GENERATION_* events
  -> usePodcast updates player state
```

### v1.6 Ethical Engagement Flow

```
Home/Post/Saved/Planner signals
  -> learningEngagementService.record(...)
  -> local daily metrics + goal progress update
  -> LEARNING_METRICS_UPDATED
  -> optional LEARNING_CUE_TRIGGERED
  -> UI shows stop cue, retrieval prompt, or reflection prompt
```

This should consume existing signals (`CONCEPT_EXPLORED`, post history, review completion) and avoid new addictive counters such as streak-first or endless-scroll rewards.

## Storage Schema Changes

### Modify `Question`

Additive fields only; old records must continue to parse.

```typescript
interface Question {
  ingestion?: {
    status: 'ingested' | 'not_ingested' | 'override_ingested';
    reason: 'learning' | 'small_talk' | 'prompt_leak' | 'jailbreak' | 'non_learning' | 'ambiguous';
    confidence: number;
    decidedAt: number;
    overrideable: boolean;
  };
  graphTrust?: {
    manualPlacement?: boolean;
    locked?: boolean;
    correctedAt?: number;
    correctionCount?: number;
    mergedIntoId?: string;
    detachedAt?: number;
  };
}
```

### Modify `DailyPodcast`

```typescript
interface PodcastGenerationOptions {
  targetDurationSec: 90 | 180 | 300 | 600;
  style: 'recap' | 'socratic' | 'story' | 'exam-prep';
  detailLevel: 'light' | 'standard' | 'deep';
}

interface DailyPodcast {
  options?: PodcastGenerationOptions;
  optionsHash?: string;
}
```

### Modify `PodcastSettings`

```typescript
interface PodcastSettings {
  sleepTime: string;
  advanceMinutes: number;
  autoGenerate: boolean;
  defaultOptions?: PodcastGenerationOptions;
}
```

### New `trellis_graph_edits_v1`

```typescript
interface GraphEditRecord {
  id: string;
  type: 'rename' | 'move' | 'merge' | 'detach' | 'undo';
  targetIds: string[];
  before: Array<Pick<Question, 'id' | 'parentId' | 'rootLabel' | 'branchLabel' | 'clusterLabel' | 'clusterNodeId' | 'title' | 'qaCount' | 'nodeSummary'>>;
  after: Array<Partial<Question> & { id: string }>;
  createdAt: number;
}
```

### New `trellis_library_v1`

```typescript
interface LibraryState {
  tagsByItemId: Record<string, string[]>;
  bookmarks: Array<{ itemId: string; itemType: 'post' | 'question' | 'anchor' | 'podcast'; createdAt: number }>;
}
```

Keep saved/liked post IDs in `trellis_engagement_v1`; do not duplicate them in `trellis_library_v1`.

### New `trellis_learning_engagement_v1`

```typescript
interface LearningEngagementState {
  goals: Array<{ id: string; label: string; cadence: 'daily' | 'weekly'; target: number; createdAt: number }>;
  dailyMetrics: Record<string, {
    conceptsExplored: number;
    retrievalPromptsAnswered: number;
    reviewsCompleted: number;
    postsViewed: number;
    stopCueShownAt?: number;
  }>;
  reflectionPrompts: Array<{ id: string; prompt: string; sourceId?: string; answeredAt?: number; createdAt: number }>;
}
```

### SQLite / Backup Implications

- `questions` table stores the full `Question` JSON, so new `Question` fields are backed up automatically.
- Add no SQLite table for `trellis_library_v1` or `trellis_learning_engagement_v1` in the first pass unless product requires backup parity. Current engagement/history services are localStorage-only, so matching that pattern is acceptable.
- If graph edit undo must survive localStorage eviction independently, add `graph_edits (id TEXT PRIMARY KEY, data TEXT NOT NULL)` to `db.service.ts`; otherwise the durable corrected graph state already lives in `questions`.
- `clearAllTables()` and Settings "Clear All Data" must remove any new `trellis_` keys automatically; explicit DB table cleanup is needed only if a new SQLite table is added.

## Event-Bus Updates

Keep existing events stable. Add events where consumers need specific semantics; otherwise emit existing broad invalidation events.

| Event | Payload | Emitted By | Consumers |
|-------|---------|------------|-----------|
| `QUESTION_INGESTION_EVALUATED` | `{ decision }` | ingestion gate | Ask UI, tests, optional debug UI |
| `QUESTION_INGESTED` | `{ questionId, decision }` | question service/useQuestions | Optional analytics/metrics; `QUESTION_ASKED` can remain for compatibility |
| `GRAPH_EDIT_APPLIED` | `{ editId, type, targetIds }` | `graph-edit.service.ts` | Graph toast, undo affordance, tests |
| `GRAPH_EDIT_REVERTED` | `{ editId }` | `graph-edit.service.ts` | Graph toast/history |
| `GRAPH_UPDATED` | no payload | graph edit, classifier, delete/prune/reorg | Existing re-read subscribers |
| `LIBRARY_CHANGED` | `{ kind, itemId, itemType }` | `library.service.ts` | SavedScreen, ConceptDashboard, search UI |
| `RETRIEVAL_INDEX_UPDATED` | `{ reason }` | retrieval/library service if cached | Search UI only if a cache is introduced |
| `PODCAST_OPTIONS_CHANGED` | `{ date, options }` | PodcastScreen/usePodcast | PodcastScreen, scheduler if auto-generation observes defaults |
| `LEARNING_GOAL_UPDATED` | `{ goalId }` | learning engagement service | Home/Planner goal displays |
| `LEARNING_CUE_TRIGGERED` | `{ cue, reason }` | learning engagement service | Home/Post cue UI |
| `LEARNING_METRICS_UPDATED` | `{ date }` | learning engagement service | Dashboard/Planner/Home |

Do not overload `ENGAGEMENT_CHANGED` for goals or learning metrics. That event is already scoped to save/unsave/like/unlike/undismiss and SavedScreen depends on that narrow meaning.

## Integration Points

### Modified Files

| File | Change |
|------|--------|
| `app/src/types/index.ts` | Add ingestion decision, graph edit, podcast options, retrieval result, learning engagement types, and new `AppEvent` variants |
| `app/src/services/question-filter.service.ts` | Replace boolean off-topic classifier with ingestion gate result; fix prompt-leak false positive for legitimate conceptual questions |
| `app/src/services/question.service.ts` | Split answer generation from durable save, support ingestion metadata, add batch patch/replace helper for graph transactions |
| `app/src/state/useQuestions.ts` | Apply ingestion gate before `buildAndSave` on streaming path; preserve byte-stable system prompt invariants |
| `app/src/services/canonical-knowledge.service.ts` | Respect `graphTrust.locked/manualPlacement`; avoid moving manually corrected nodes during classification/reorg |
| `app/src/services/graph.service.ts` | Add read helpers for anchors/clusters/children and validation candidates |
| `app/src/screens/GraphScreen.tsx` | Add manual correction UI while keeping MindElixir `editable: false`; all writes go through service |
| `app/src/services/podcast.service.ts` | Accept generation options, store options snapshot, build prompt from length/style/detail |
| `app/src/state/usePodcast.ts` | Pass options through generation and reload state after option changes |
| `app/src/screens/PodcastScreen.tsx` | Add learner controls and regeneration behavior |
| `app/src/screens/SavedScreen.tsx` | Add search/filter/tags via retrieval/library service |
| `app/src/services/settings.service.ts` | Add default podcast options and possibly ethical-engagement preferences |
| `app/src/services/db.service.ts` | Only modify if graph edit log gets SQLite backup |
| `app/src/screens/settings/SettingsDataScreen.tsx` | Ensure new stores clear/reset correctly; add developer reset if needed |

### New Files

| File | Purpose |
|------|---------|
| `app/src/services/ingestion-gate.service.ts` | Optional extraction if `question-filter.service.ts` becomes too broad; recommended for testability |
| `app/src/services/graph-edit.service.ts` | Manual graph correction transactions and edit history |
| `app/src/services/retrieval.service.ts` | Unified local search/ranking |
| `app/src/services/library.service.ts` | Tags/bookmarks metadata |
| `app/src/services/learning-engagement.service.ts` | Goals, stop cues, reflection prompts, learning metrics |
| `app/src/state/useRetrieval.ts` | Thin hook for Saved/Dashboard search state |
| `app/src/screens/ConceptDashboardScreen.tsx` | Concept-level retrieval/review/dashboard surface, unless folded into `AnchorDetailScreen.tsx` |
| `app/src/components/graph/GraphEditSheet.tsx` | Graph correction actions |
| `app/src/components/retrieval/SearchBar.tsx` | Shared search input/filter controls |
| `app/src/components/learning/StopCue.tsx` | Ethical stop/reflection cue UI |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Ask -> ingestion -> graph | Service call + typed events | Do not emit persisted question events for non-ingested chat |
| GraphScreen -> graph edits | `graphEditService` only | MindElixir stays non-editable; custom UI controls write through service |
| Classifier -> manual graph state | Read `graphTrust` fields | Locked/manual nodes are constraints, not suggestions |
| SavedScreen -> retrieval | `retrievalService` and `libraryService` | Avoid direct multi-store search logic in screen |
| PodcastScreen -> podcast service | Options object | Store option snapshot on `DailyPodcast` |
| Ethical cues -> feed/archive/planner | `learningEngagementService` events | Keep separate from `engagementService` save/like events |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current local-first single user | On-demand scans of `Question[]` and post history are fine |
| Large personal graph, 1k-10k nodes | Add memoized retrieval indexes in memory; batch graph patches; avoid O(N^2) graph validation in UI thread |
| Very large local archive | Persist lightweight search index in IndexedDB, not localStorage; move audio/history cleanup into background tasks |

### Scaling Priorities

1. **First bottleneck:** Graph edit operations that recompute summaries/counts across all questions. Fix with service-level batch helpers and focused affected-subtree recomputation.
2. **Second bottleneck:** Retrieval scanning every post and question on each keystroke. Fix with debounce and in-memory index rebuilt on `GRAPH_UPDATED`, `LIBRARY_CHANGED`, and post-history changes.
3. **Third bottleneck:** Podcast audio storage. IndexedDB is already the right store; add quota-aware cleanup only after options increase generation frequency.

## Anti-Patterns

### Anti-Pattern 1: Treating Filtering as "Do Not Answer"

**What people do:** Block or refuse small talk/meta questions before chat generation.
**Why it's wrong:** The product requirement is natural chat with selective graph ingestion. Blocking presentation makes the app feel brittle and still does not solve graph pollution cleanly.
**Do this instead:** Answer naturally, then decide whether to create durable `Question`/graph state.

### Anti-Pattern 2: Letting MindElixir Mutate the Model

**What people do:** Turn on `editable: true` and infer model updates from library DOM events.
**Why it's wrong:** The real model includes anchors, clusters, Q&A children, `qaCount`, `clusterNodeId`, SQLite write-through, and graph invalidation events. DOM editing cannot keep those coherent.
**Do this instead:** Keep `editable: false` and build explicit graph edit controls backed by `graph-edit.service.ts`.

### Anti-Pattern 3: Hard-Deleting Merged Graph Nodes

**What people do:** Delete source anchors during merge.
**Why it's wrong:** Local-first async writes and SQLite restore rules can resurrect stale rows, and hard delete removes undo context.
**Do this instead:** Reparent children to the survivor and tombstone the source anchor with `graphTrust.mergedIntoId` or a similar additive field.

### Anti-Pattern 4: Duplicating Saved/Liked State in a New Library Store

**What people do:** Copy saved and liked post IDs into `libraryService`.
**Why it's wrong:** `engagementService` already owns those semantics and emits narrow events. Duplication creates ordering and retention bugs.
**Do this instead:** Let `libraryService` own tags/bookmarks only and read saved/liked through `engagementService`.

### Anti-Pattern 5: Using Likes/Saves as Learning Success

**What people do:** Build "success metrics" from feed engagement counts.
**Why it's wrong:** v1.6 is explicitly adding ethical engagement guardrails. Saves/likes are useful retrieval signals, not evidence of learning.
**Do this instead:** Track retrieval prompts answered, reviews completed, concepts revisited, and reflection completion.

## Suggested Build Order

1. **Ingestion Gate Foundation**
   - Modify `question-filter.service.ts`, `question.service.ts`, and `useQuestions.ts`.
   - Add ingestion metadata and events.
   - Rationale: This prevents new graph pollution before manual graph work depends on the graph being trustworthy.

2. **Graph Edit Service and Tests**
   - Add batch patch helper, `graph-edit.service.ts`, edit records, and service tests for rename/move/merge/detach.
   - Rationale: Correctness belongs in a service before UI makes it easy to mutate production data.

3. **GraphScreen Correction UI**
   - Add node action sheet/menus that call graph edit operations.
   - Rationale: UI is now a thin consumer of tested graph transactions.

4. **Retrieval and Library Services**
   - Add search/ranking, tags/bookmarks, and `LIBRARY_CHANGED`.
   - Rationale: Retrieval depends on stable graph IDs and should reuse corrected anchors.

5. **SavedScreen and Concept Dashboard Retrieval Surfaces**
   - Add search/filter/tags to Saved/Liked/History; add concept dashboard or extend anchor detail.
   - Rationale: Surfaces consume retrieval services without affecting ingestion/graph correctness.

6. **Podcast Options**
   - Add options types, settings defaults, prompt builder, PodcastScreen controls, and option-aware regeneration.
   - Rationale: Mostly independent after retrieval, but it benefits from stable concept selection and dashboard links.

7. **Ethical Engagement Guardrails**
   - Add learning goals, stop cues, reflection/retrieval prompts, and learning metrics.
   - Rationale: This should consume stable signals from ingestion, retrieval, reviews, feed history, and podcast completion rather than invent parallel metrics.

## Sources

- `.planning/PROJECT.md` - v1.6 milestone goals and local-first architecture decisions.
- `app/src/types/index.ts` - `Question`, `DailyPodcast`, settings, `AppEvent`, and graph-related domain types.
- `app/src/services/question.service.ts` - current save/filter/classification order and SQLite write-through.
- `app/src/services/question-filter.service.ts` - current pattern/LLM off-topic classifier.
- `app/src/services/canonical-knowledge.service.ts` - anchor/cluster projection, classification, reorg, and `GRAPH_UPDATED`.
- `app/src/services/graph.service.ts` - graph reads, edge weights, semantic candidates, parent movement.
- `app/src/screens/GraphScreen.tsx` - MindElixir rendering, read-only graph UI, reorg events.
- `app/src/services/podcast.service.ts` - current fixed 90-second prompt, localStorage metadata, IndexedDB audio.
- `app/src/screens/PodcastScreen.tsx` - current player/generation/concept insertion flow.
- `app/src/screens/SavedScreen.tsx` - Saved/Liked/History archive and `ENGAGEMENT_CHANGED` refresh pattern.
- `app/src/services/engagement.service.ts` - save/like/dismiss ownership and event semantics.
- `app/src/services/post-history.service.ts` - local post archive consumed by Saved/Liked.
- `app/src/services/db.service.ts` - SQLite/localStorage persistence boundary.

---
*Architecture research for: v1.6 Control, Graph Trust, Retrieval, Podcast Controls, and Ethical Engagement*
*Researched: 2026-05-13*
