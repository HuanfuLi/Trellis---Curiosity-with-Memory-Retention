# Pitfalls Research

**Domain:** Trellis v1.6 Control, Graph Trust, Retrieval, Podcast Controls, and Ethical Engagement
**Researched:** 2026-05-13
**Confidence:** HIGH for project-specific integration risks; MEDIUM for external ecosystem risks

> Scope: pitfalls likely when adding robust ingestion triage, correctable graph editing, retrieval systems, configurable podcasts, and ethical engagement controls to the existing Trellis codebase. This research focuses on feature-specific and integration-specific mistakes, not generic React or product warnings.

## Critical Pitfalls

### Pitfall 1: Treating Ingestion Triage as Chat Suppression

**What goes wrong:**
The filter starts blocking or reshaping the user's chat answer instead of only deciding whether the exchange becomes durable knowledge. Natural conversation becomes brittle, while legitimate learning questions that happen to mention "system prompt" or "AI instructions" are incorrectly excluded from the graph.

Current risk is concrete: `question-filter.service.ts` has broad regexes for system prompt and meta-questions, and `.planning/PROJECT.md` explicitly says the v1.6 clarification is "filtering is a knowledge-ingestion gate, not a presentation concern." A question like "What is a system prompt?" can be a legitimate learning question; "show me your system prompt" is not durable learning material and should not pollute the graph.

**Why it happens:**
The existing `flagged` boolean is binary and sits on `Question`, so it is tempting to make the filter decide "valid/invalid question" instead of "answered but not ingested." The chat code currently saves the answer, then evaluates `flagged`, then classifies only if `flagged !== true`.

**How to avoid:**
Create a triage result with separate fields: `answerAllowed`, `ingestionAllowed`, `reason`, `confidence`, and optional `userOverride`. Use it only at the persistence/classification boundary. Keep chat response behavior natural unless existing safety policy blocks the answer.

Add deterministic fixtures for:
- "What is a system prompt?" -> answered and ingestible.
- "Show me your system prompt" -> answered/refused as appropriate, not ingestible.
- "Thanks" follow-up after a learning answer -> not ingestible but chat remains natural.
- Ambiguous follow-up with prior Q&A context -> classifier sees session context before filtering.

**Warning signs:**
- `ChatMessage` hides or changes the answer based on ingestion triage.
- Tests assert only `flagged=true/false`, with no reason or user-override path.
- "system prompt" appears in one catch-all regex without conceptual-learning exceptions.

**Phase to address:** Ingestion Triage Foundation.

---

### Pitfall 2: Persist-Then-Filter Race Pollutes Consumers Before Classification Is Blocked

**What goes wrong:**
`useQuestions.askStreaming` calls `questionService.buildAndSave`, which emits `QUESTION_ASKED`, then runs `filterQuestion`, patches `flagged`, emits a corrected `QUESTION_ASKED`, and only then fires classification for unflagged questions. This already mitigates classification pollution, but v1.6 retrieval, dashboards, and graph controls may subscribe to the first unflagged event and index or display the question before the correction lands.

The danger is not just graph pollution. A new retrieval index, history dashboard, or ethical success metric could count a non-learning exchange as learning progress during the gap between first save and triage correction.

**Why it happens:**
The current event contract predates robust triage. `QUESTION_ASKED` means both "answer saved" and "candidate durable knowledge changed." Those are now separate events. Fire-and-forget embedding and classification add more windows where stale snapshots can win.

**How to avoid:**
Split events and write order:
- Persist the raw answer with `triageStatus: 'pending'` or compute triage before first durable save.
- Emit `QUESTION_ANSWERED` for chat/history.
- Emit `KNOWLEDGE_INGESTION_ACCEPTED` only after triage accepts durable ingestion.
- Make classification, graph cache invalidation, retrieval indexing, dashboards, and podcast concept updates subscribe to the accepted-ingestion event, not raw chat.

If the code keeps `QUESTION_ASKED`, require every durable consumer to filter by `ingestionAllowed === true` or equivalent. Add a race test where a non-learning question emits the raw event and verify graph/retrieval/podcast consumers do not index it.

**Warning signs:**
- New code subscribes to `QUESTION_ASKED` and mutates graph, retrieval index, or metrics.
- Tests only inspect final localStorage state and not the sequence of emitted events.
- A non-learning exchange briefly appears in GraphScreen, Saved/History retrieval, or concept dashboards.

**Phase to address:** Ingestion Triage Foundation before Retrieval or Graph Editing.

---

### Pitfall 3: Overloading `flagged` for Off-Topic, Pruned, Hidden, Detached, and Corrected State

**What goes wrong:**
The same `Question.flagged` field already means "off-topic/meta-question" and is also used with `prunedFromTrellis` for explicit trellis pruning. If v1.6 uses `flagged` for manual detach, hide from graph, merge source cleanup, or ethical stop-cue suppression, features will conflict:

- pruned nodes can appear in the wrong archive;
- off-topic chat can be treated as user-pruned knowledge;
- graph edits can accidentally make Q&As disappear from review and retrieval;
- reorg can skip data that should remain reviewable.

**Why it happens:**
`projectQuestionsToKnowledgeNodes`, review projection, and reorg all filter `flagged === true`. That is convenient but too coarse for v1.6 learner control.

**How to avoid:**
Introduce explicit fields:
- `ingestionStatus: 'accepted' | 'rejected' | 'pending' | 'manual_override'`
- `graphVisibility: 'visible' | 'detached' | 'hidden'`
- `graphExcludedReason?: 'small_talk' | 'prompt_leak_request' | 'user_detached' | 'pruned'`

Keep `prunedFromTrellis` for the existing prune archive or migrate it deliberately. Do not add any new meaning to `flagged` without a migration and source-reading tests over `projectQuestionToKnowledgeNode`, `getPrunedQuestions`, `buildAnchorReflectionTree`, and `reorganizeMindmap`.

**Warning signs:**
- A patch like `patchQuestion(id, { flagged: true })` is added outside filter/prune code.
- Feature code asks "should this show in graph?" by checking only `flagged`.
- `getPrunedQuestions` starts returning ingestion-rejected small talk.

**Phase to address:** Ingestion Triage Foundation and Graph Correction Data Model.

---

### Pitfall 4: Graph UI Edits Mutate Mind Elixir State Instead of Trellis Canonical State

**What goes wrong:**
Mind Elixir supports editing, moving, and data export/import APIs, and Trellis currently initializes it with `editable: false`, `draggable: true`, and custom click/touch handlers. Turning `editable: true` and trusting the library's internal tree will create edits that look right until the next `GRAPH_UPDATED` reload, then vanish or reappear incorrectly because GraphScreen is regenerated from `Question` records via `buildAnchorReflectionTree`.

**Why it happens:**
GraphScreen's displayed tree is a projection, not the source of truth. Node IDs include synthetic root/branch IDs, real cluster IDs, anchor IDs, and Q&A IDs. Direct drag/drop edits in the rendered tree do not automatically update `parentId`, `clusterNodeId`, `rootLabel`, `branchLabel`, `clusterLabel`, `qaCount`, `nodeSummary`, review projection, or retrieval indexes.

**How to avoid:**
Keep Mind Elixir as a view layer. Add explicit graph command methods in a single `graph-correction.service.ts`:
- `renameAnchor(anchorId, title)`
- `moveAnchor(anchorId, targetClusterId)`
- `mergeAnchors(sourceAnchorId, targetAnchorId)`
- `detachQuestion(questionId)`
- `moveQuestionToAnchor(questionId, anchorId)`

Each command must patch all derived fields and emit `GRAPH_UPDATED` exactly once after a fresh read-modify-write. If drag/drop is enabled later, treat the UI event as a command input and immediately re-render from Trellis state.

**Warning signs:**
- `enableEdit`, `setNodeTopic`, `moveNodeIn`, or `getData` is used as persistence.
- Graph edits pass UI tests but disappear after navigation.
- Edit code updates `topic` but not `Question.title`/labels/parent fields.

**Phase to address:** Graph Correction Data Model before Graph Editing UI.

---

### Pitfall 5: Partial Graph Corrections Leave Anchors, Clusters, and Q&A Fields Inconsistent

**What goes wrong:**
A manual correction patches the field that is visible on screen but misses dependent fields. Examples:

- rename anchor changes `title` but not `content`, `summary`, aliases, or retrieval terms;
- move anchor changes `clusterNodeId` but not `branchLabel`/`clusterLabel` on child Q&As;
- merge anchors moves Q&As but does not recompute `qaCount` or `nodeSummary`;
- detach Q&A clears `parentId` but leaves stale `clusterNodeId`;
- delete anchor leaves child Q&As pointing to a missing parent.

GraphScreen, ClusterDetailScreen, AnchorDetailScreen, ReviewScreen, planner suggestions, and podcast concept selection will then disagree.

**Why it happens:**
The current classification commit writes cluster nodes directly to localStorage in places and uses `questionService.patchQuestion` elsewhere. `graphService.moveToParent` only patches `parentId`. `buildAnchorReflectionTree` derives display from several fields, so no single field is authoritative today.

**How to avoid:**
Make graph correction commands transactional at the application level:
- always read fresh `trellis_questions`;
- validate target IDs and node roles before writing;
- patch parent and child records in one localStorage write where possible;
- recompute `qaCount` and `nodeSummary` from child Q&As after every move/merge/detach;
- persist affected records to SQLite or document localStorage-primary limits;
- emit one `GRAPH_UPDATED` at the end.

Add invariant tests:
- every non-hidden Q&A `parentId` points to an existing anchor or is explicitly detached;
- every anchor `clusterNodeId` points to an existing cluster;
- every cluster `qaCount` equals sum of child anchor `qaCount`;
- every anchor `qaCount` equals attached Q&A count;
- no structural node has a due review date before `9999-12-31`.

**Warning signs:**
- A graph edit uses `questionService.patchQuestion` directly from a component.
- Tests assert only the edited node and not affected siblings/children.
- Selected node card shows a different child count than ClusterDetailScreen.

**Phase to address:** Graph Correction Data Model and Graph Editing UI.

---

### Pitfall 6: Manual Corrections Race With Fire-and-Forget Classification and Reorganization

**What goes wrong:**
The user corrects an anchor while `classifyAndAnchorIncremental` or `reorganizeMindmap` is still in flight. The async classifier commits stale labels after the manual edit, or reorg writes a new structural store from a snapshot that predates the correction. The user loses trust because "I fixed it and Trellis changed it back."

The code already contains race lessons: `buildAndSave` avoids stale pre-LLM snapshots, and reorg reconciles deletes/new Q&As after a 10-30 second LLM window. Manual graph corrections are another concurrent mutation class and need the same treatment.

**Why it happens:**
Current race defenses track existence of IDs, not structural revision. A manual correction changes structure while preserving IDs, so existing reconciliation sees the node as current and can still overwrite its labels.

**How to avoid:**
Add structural revision metadata before manual editing:
- `graphRevision` or per-node `structuralUpdatedAt`;
- `manualStructuralLock?: true` or `lastCorrectedAt`;
- classifier/reorg commits must re-read the current node and skip overwriting fields changed after their snapshot.

For graph-wide reorg, either block manual edit commands while `_reorgInProgress` is true, or queue them and replay after reorg. For classification, allow it to attach new Q&As but never overwrite manually corrected anchor/cluster labels without explicit user confirmation.

**Warning signs:**
- A correction is followed by a `GRAPH_UPDATED` from classification and the correction disappears.
- Reorg result includes nodes edited after reorg started.
- Tests simulate correction only when no async classification is active.

**Phase to address:** Graph Correction Data Model before enabling manual edits.

---

### Pitfall 7: LocalStorage Schema Changes Are Additive in Types but Not in Loaders

**What goes wrong:**
v1.6 adds new local-first fields for triage, graph corrections, retrieval tags, podcast options, goals, or ethical cue preferences. TypeScript compiles because fields are optional, but old persisted payloads load with missing fields and new code assumes arrays/objects exist. Conversely, a migration rewrites large `trellis_questions`, `trellis_post_history`, or `trellis_podcasts` payloads synchronously and blocks the UI.

**Why it happens:**
Most services parse localStorage and cast directly. Some loaders validate shape (`post-history.service.ts`, `engagement.service.ts`), but others trust JSON more broadly. Browser Web Storage is synchronous and limited; MDN documents that `localStorage` operations block JS execution and Web Storage is limited to about 10 MiB per origin.

**How to avoid:**
For each new store or field:
- add a version field only when a real migration is required;
- prefer additive optional fields plus load-time normalization;
- validate arrays/objects in `loadState` before returning;
- keep large/audio/blob/vector data out of localStorage;
- migrate lazily by record on read or command execution, not via one giant boot rewrite.

Use IndexedDB or SQLite for larger indexes/snapshots. Trellis already uses IndexedDB for podcast audio and SQLite as a cold backup for questions, so follow that precedent.

**Warning signs:**
- `JSON.parse(raw) as SomeNewType` followed by direct `.map` on newly added fields.
- A boot-time migration loops through every question and writes the whole store before first render.
- New retrieval index duplicates full post bodies in localStorage.

**Phase to address:** Data Migration and Persistence Foundation, before feature-specific UI phases.

---

### Pitfall 8: Retrieval Becomes Another Feed Instead of a Recovery Tool

**What goes wrong:**
Search, tags, bookmarks, history, and dashboards are implemented as another infinite stream ranked by recency or engagement. The user gets a second discovery feed, not a way to find, resume, review, or compare prior learning. Ethical engagement goals are undermined because "retrieval" increases scrolling surface area.

**Why it happens:**
SavedScreen already consolidates Saved, Liked, and History. It is easy to add search and filters into that same archive as a browseable stream. Existing scorer code includes feed engagement as a ranking signal, so retrieval can accidentally prioritize what was clicked over what needs recalling.

**How to avoid:**
Separate retrieval modes by intent:
- exact search over Q&A, anchors, post titles, summaries, and tags;
- concept dashboard for one anchor/cluster;
- review/retrieval-practice entry points;
- archive filters for saved/liked/history;
- bounded "recently viewed" lists without infinite recommendations.

Rank retrieval by relevance, concept match, review need, and user tags, not by feed popularity alone. Add empty states that point to Ask/Review, not "generate more posts."

**Warning signs:**
- Retrieval screen has endless scroll and no query/filter state.
- Search results include generated recommendations that were never viewed or saved.
- User cannot answer "where did I save that concept?" without scrolling.

**Phase to address:** Retrieval Foundation and Concept Dashboard.

---

### Pitfall 9: Bookmark/Tag Retrieval Stores IDs Only, Then Loses the Content It Promised to Preserve

**What goes wrong:**
Saved and liked posts currently store IDs in `trellis_engagement_v1` and resolve full posts through `postHistoryService`. This is lean and works because saved/liked IDs are pinned against history purge. v1.6 tags/bookmarks can break if they store only IDs for content that is not guaranteed to exist in `trellis_post_history`, `trellis_daily_posts`, video/news caches, or generated essay caches.

Result: a saved/tagged item appears in counts but opens to missing content, or search finds a tag whose post body was purged.

**Why it happens:**
Trellis has multiple post stores and patch paths. `post-essay.service.ts` already had to patch `trellis_post_history` along with daily/video/news caches so streamed essays remain openable from archive surfaces. Retrieval features will multiply these references.

**How to avoid:**
Define a retrieval record shape:
- ID and content type;
- title, source concept IDs, context label, generatedAt/date;
- minimal searchable text snapshot;
- pointer to full post if available;
- tag/bookmark metadata;
- retention policy.

Do not duplicate large essays unnecessarily, but do store enough snapshot data for search results and archive rows to remain meaningful after cache eviction. Extend purge tests so saved/liked/tagged/bookmarked content survives as promised.

**Warning signs:**
- Tag service stores `{ tag: string, postIds: string[] }` only.
- Search result opens `/posts/:id` but that ID is absent from all cache stores.
- History purge tests are not updated for tags/bookmarks.

**Phase to address:** Retrieval Persistence before Retrieval UI.

---

### Pitfall 10: Podcast Length/Style Controls Are Raw Prompt Strings With No Cache Identity

**What goes wrong:**
The user asks for a shorter, longer, calmer, or more technical podcast, but Trellis returns the existing ready podcast because `generatePodcast` skips generation when today's ready audio blob exists. Or a new style setting changes the script prompt but not the stored podcast identity, so the UI shows stale duration/script under the new controls. If controls are passed as raw prompt text, educational coverage degrades or the model emits stage directions that TTS reads aloud.

**Why it happens:**
Current `DailyPodcast` has no options field. `podcast.service.ts` stores one podcast per date and skips ready regeneration if audio exists. The script prompt is fixed at "90-second spoken podcast recap. Conversational radio style."

**How to avoid:**
Add a typed `PodcastOptions` and an `optionsHash` to `DailyPodcast`:
- `length: 'brief' | 'standard' | 'deep'`
- `style: 'calm' | 'conversational' | 'quiz' | 'story'`
- `voice/speed` if relevant.

Only reuse a ready podcast when date, concept IDs, locale, and optionsHash match. Prompt style controls as bounded instructions, with non-negotiable quality constraints: cover every selected concept, no invented references, no stage directions, no music cues, spoken-friendly formatting. Regeneration must clear old audio/script and revoke blob URLs.

**Warning signs:**
- `PodcastSettings` grows new fields but `DailyPodcast` does not.
- `generatePodcast` still has only `(date, conceptIds?)`.
- "Style" is a freeform textarea sent into the system prompt.

**Phase to address:** Podcast Controls Data Model before Podcast UI.

---

### Pitfall 11: Podcast Generation Has No Per-Options Concurrency Guard

**What goes wrong:**
The user changes length/style and taps regenerate while a previous generation is running. Two fire-and-forget async jobs patch the same podcast ID. The slower older job can overwrite the newer script/audio and emit `PODCAST_GENERATION_COMPLETED` after the UI already shows the new options.

**Why it happens:**
`podcastService.generatePodcast` starts a background async IIFE, writes `status: 'generating'`, and patches by podcast ID. There is no generation token, abort controller, or options hash check before final `patchPodcast`.

**How to avoid:**
For every generation, create `generationId` and store it on the podcast. Every progress/final patch must first verify the current podcast still has that generationId and optionsHash. If not, drop the stale result. Add abort support for LLM/TTS where provider APIs allow it; otherwise stale-result dropping is mandatory.

Also add a UI disabled/loading state scoped to the selected options, not a single global `isGenerating` that can hide which version is in flight.

**Warning signs:**
- Progress events carry only `podcastId` and `progress`.
- Final completion overwrites by ID without checking current options.
- Rapid regenerate tests are absent.

**Phase to address:** Podcast Controls Data Model and Podcast Generation Reliability.

---

### Pitfall 12: Ethical Engagement Cues Become Nagging or Another Reward Loop

**What goes wrong:**
Goals, stop cues, reflection prompts, and learning metrics fire too often, use guilt language, or become another streak/credit mechanic. Users learn to dismiss them reflexively. Worse, "ethical" cues can still optimize for more sessions, more posts, or more generated content instead of learning quality.

**Why it happens:**
Trellis already has feed engagement, likes, saves, dismisses, vine progress, credits, planner suggestions, and review metrics. Adding cues as toasts or modal interruptions reuses the most intrusive surfaces. W3C Ethical Web Principles call out user control, privacy, verification, and avoiding addictive/manipulative patterns; v1.6 should not implement "healthy engagement" with coercive engagement mechanics.

**How to avoid:**
Make cues user-controlled and sparse:
- user sets goals and quiet hours;
- cue frequency has snooze/disable;
- stop cues are informational and non-blocking;
- reflection prompts are tied to meaningful transitions, not every scroll threshold;
- success metrics emphasize retrieval, review completion, concept correction, and user-stated goals, not session length or feed volume.

Do not award credits for dismissing stop cues or continuing after them. Track cue fatigue: dismiss-without-action rate, repeated snoozes, immediate app exit after cue.

**Warning signs:**
- Cue copy says "keep going" more often than "pause" or "review."
- Stop cue has no snooze/disable.
- Metrics dashboard celebrates posts viewed more prominently than recall/review outcomes.

**Phase to address:** Ethical Engagement Foundation and Metrics UI.

---

### Pitfall 13: New Controls Ignore Always-Mounted Screen Resync Rules

**What goes wrong:**
Graph corrections, retrieval tags, podcast options, goals, or dismiss/undismiss changes update services while another first-level screen is foregrounded. Because first-level screens remain mounted, the destination screen shows stale state when the user navigates back.

This is a repeated Trellis failure mode already documented in `.planning/PROJECT.md`: always-mounted screens consuming mutable services need `[location.pathname]` resync effects. SavedScreen is not always-mounted and can rely on mount cleanup; HomeScreen and GraphScreen are always-mounted surfaces.

**Why it happens:**
Event-bus subscriptions feel sufficient during same-screen interactions, but navigation back to an already-mounted screen does not remount or rerun initial state. Bulk resets may intentionally emit no per-item events.

**How to avoid:**
For every v1.6 service mutation, define:
- semantic event for live same-screen updates;
- `[location.pathname]` re-read for always-mounted consumers;
- bulk reset behavior;
- source-reading test that the relevant screen re-reads on navigation.

GraphScreen should reload on `GRAPH_UPDATED` and also revalidate selected node after corrections/deletes. HomeScreen retrieval/ethical widgets should mirror the Phase 36/43 sibling-effect pattern.

**Warning signs:**
- State initializer reads a service and no navigation resync exists.
- Bulk reset emits no events and no screen re-read covers it.
- Back navigation shows stale selected node, stale saved/tag state, or old goal progress.

**Phase to address:** Cross-Cutting State/Event Foundation before UI-heavy phases.

---

### Pitfall 14: Retrieval Indexing Pulls Dynamic Graph Context Back Into the Byte-Stable Ask Prompt

**What goes wrong:**
To improve retrieval, a developer injects richer graph/search context into the Ask system prompt. This regresses the Phase 35 load-bearing invariant: the system prompt must remain byte-stable across turns, with per-turn graph context in a tail assistant message and strict user/assistant alternation for local models like Qwen via LM Studio.

**Why it happens:**
Retrieval feels like prompt context, and system prompts feel authoritative. But Trellis already paid for this lesson: dynamic system prompt bytes broke provider KV-cache behavior and local chat templates.

**How to avoid:**
Retrieval context belongs in the existing tail context message pattern or in a separate retrieval result message that preserves strict alternation. Do not interpolate query-specific retrieval results into `systemPrompt`. Extend `useQuestions-system-prompt-stability.test.mjs` if new retrieval context is added.

**Warning signs:**
- `systemPrompt` references search results, tags, bookmarks, dashboard summaries, or `formatCandidateContextPack`.
- New retrieval context is inserted as assistant-before-user without the constant user ack.
- Source-reading prompt-stability tests are edited only to make them pass.

**Phase to address:** Retrieval Foundation and Ask Integration.

---

### Pitfall 15: Privacy Boundary Drift When Retrieval, Graph Trust, and Ethical Metrics Are Added

**What goes wrong:**
Local-first retrieval indexes, correction history, goals, and engagement metrics quietly become prompt context or provider payloads. A user who consented to AI answers may not expect saved/liked history, goals, or correction logs to be transmitted for every Ask or podcast generation.

**Why it happens:**
Trellis has a single `aiConsentGiven` preference and multiple providers. New features will be tempted to "improve personalization" by passing broader local context into LLM calls. Current code uses localStorage/SQLite as primary local stores and only transmits specific prompts to configured providers.

**How to avoid:**
Add context categories and provider-boundary tests:
- ask question text;
- graph candidate summaries;
- retrieval result snippets;
- saved/liked/tag metadata;
- goals/reflection notes;
- correction history.

Each LLM call site must document which categories it sends. Default to minimal context; require user-visible settings for broader personalization. Keep retrieval search local unless user explicitly requests web/current information.

**Warning signs:**
- A helper called `buildFullUserContext` is used by Ask, podcasts, retrieval, and planner.
- Goals/reflections appear in podcast or Ask prompts without a setting.
- Tests mock provider calls but do not assert payload exclusions.

**Phase to address:** Privacy/Context Boundary Gate before Retrieval and Ethical Metrics.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse `flagged` for every graph exclusion | Fast implementation | Off-topic, prune, detach, and manual hide collide | Never for new v1.6 states |
| Patch graph fields directly from components | Fewer service methods | Inconsistent anchors/clusters and missing events | Never beyond throwaway prototype |
| Store retrieval index as full duplicated post/question blobs in localStorage | Easy search implementation | Quota, sync blocking, stale copies | Only tiny derived metadata; large bodies in existing stores/IDB/SQLite |
| Use raw prompt text for podcast styles | Flexible UI | Quality drift, prompt injection, stale cache identity | Never; use bounded enum controls |
| Use `QUESTION_ASKED` as durable-ingestion event | Avoids event type additions | Race between answer save, triage, classification, retrieval indexing | Only for chat/history display |
| Add cue toasts for every ethical nudge | Quick visible feature | Nagging and cue fatigue | Only for rare confirmations/errors, not ongoing habit design |
| Source-reading tests that only assert "call exists" | Cheap regression guard | False confidence about scope/order | Acceptable only with scoped regions and counterweights |

## Integration Gotchas

Common mistakes when connecting v1.6 features to existing systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Ask -> triage -> graph | Save emits untriaged `QUESTION_ASKED` and durable consumers index it | Split chat-answer events from ingestion-accepted events or require durable consumers to filter triage status |
| Triage -> classifier | Classifier checks only `flagged !== true` | Classifier consumes explicit `ingestionStatus === 'accepted'` |
| GraphScreen -> Mind Elixir | Enable library editing and persist exported tree | Use explicit graph commands; re-render from `Question` source of truth |
| Manual graph edits -> reorg/classification | Async LLM commits overwrite user corrections | Structural revisions/locks; stale commit detection |
| Retrieval -> SavedScreen | Add infinite browse results to archive tabs | Keep retrieval intent-specific: search, filters, concept dashboard, review entry |
| Tags/bookmarks -> history purge | Store only IDs and assume post remains | Pin or snapshot enough searchable/openable metadata |
| Podcast settings -> generation | Add settings but reuse one ready podcast per date | Add optionsHash/generationId and invalidate stale script/audio |
| Ethical cues -> engagement service | Treat cue dismissal as engagement/exploration | Separate cue telemetry from learning progress and feed exploration |
| Force-New-Day -> new services | Reset old services only | Every date-scoped service has reset semantics and tests |
| LLM prompt context -> privacy | Send goals/tags/corrections in every personalization prompt | Document context categories and assert exclusions at provider boundaries |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rebuilding full retrieval index on every keystroke | Search input jank | Precompute small metadata index, debounce, worker/IDB for larger index | Hundreds of posts/questions |
| Large synchronous localStorage migrations | Slow boot, blank screen | Lazy migrations and load-time normalization | Thousands of Q&As or long post history |
| Graph invariant recompute inside every render | GraphScreen drag lag returns | Compute in service command and reload on `GRAPH_UPDATED` | 100+ anchors/Q&As |
| Podcast regenerate without stale-job dropping | Older audio overwrites newer settings | generationId/optionsHash guard | Two rapid regenerations |
| Semantic retrieval over all embeddings in UI thread | Search feels frozen | Pre-filter lexical/tag results, cap vector scans, consider worker | 500+ stored vectors |
| Cue metrics update on every scroll tick | Battery/scroll regressions | Event-level logging only at meaningful transitions | Masonry feed rapid scroll |
| Mind Elixir editable drag events persisted live | Frequent localStorage writes during drag | Persist only explicit confirmed command | Any mobile drag interaction |

## Security Mistakes

Domain-specific security and privacy issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treat "system prompt" keyword as always malicious | Blocks legitimate AI literacy learning | Triage intent with examples and session context |
| Let user-supplied podcast style text enter system prompt | Prompt injection and low-quality audio | Bounded style enum with fixed prompt templates |
| Send retrieval archive/goals to LLM by default | Privacy boundary surprise | Minimal-context defaults and provider payload tests |
| Store API-derived audio/transcripts only in localStorage | Quota errors and potential data loss | IndexedDB for audio blobs; localStorage only metadata |
| Direct graph edit to synthetic branch/root IDs | Corrupt hierarchy and orphan Q&As | Validate node role and target role before command |
| Correction history has no revert/audit | User cannot recover from bad merge | Revert snapshot for graph edit batches, similar to reorg snapshot |
| Web/current retrieval mixed with local retrieval silently | Unwanted network calls | Separate local search from explicit web search toggle |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Triage labels user chat as "invalid" | User feels judged | "Answered, not added to your map" with override |
| Graph edit controls expose every operation at once | Fear of breaking graph | Contextual actions: rename, move, merge, detach with preview/revert |
| Merge has no preview of affected Q&As | Trust loss | Show source/target anchors, Q&A counts, and resulting title/summary |
| Retrieval screen resembles Home feed | More scrolling, less recovery | Search-first interface with filters and concept dashboards |
| Podcast style options promise entertainment over learning | Lower educational quality | Style as delivery tone; concept coverage remains fixed |
| Stop cues interrupt active review | Annoyance and dismissal | Trigger at feed/session boundaries, never mid-answer or mid-review card |
| Metrics celebrate time spent | Reinforces addictive loop | Celebrate recall, corrections, reviews, and user-set goals |

## "Looks Done But Isn't" Checklist

- [ ] **Ingestion triage:** Non-learning chat is answered but not indexed; legitimate learning about AI/system prompts is ingestible.
- [ ] **Event ordering:** Durable graph/retrieval/podcast consumers do not subscribe blindly to untriaged `QUESTION_ASKED`.
- [ ] **Flag migration:** New graph exclusion states do not reuse `flagged` without explicit migration tests.
- [ ] **Graph commands:** Rename/move/merge/detach recompute child labels, `parentId`, `clusterNodeId`, `qaCount`, `nodeSummary`, and emit one `GRAPH_UPDATED`.
- [ ] **Manual correction race:** In-flight classification/reorg cannot overwrite corrections made after its snapshot.
- [ ] **Mind Elixir:** UI edits are command inputs; library internal tree is never treated as source of truth.
- [ ] **Retrieval persistence:** Saved/tagged/bookmarked results remain searchable/openable after history purge or cache eviction.
- [ ] **Retrieval ranking:** Search/dashboard ranking is not primarily feed engagement or recency.
- [ ] **Podcast options:** Date + concept IDs + locale + optionsHash determine reuse; old audio is revoked on regeneration.
- [ ] **Podcast concurrency:** Stale generation jobs cannot patch current podcast state.
- [ ] **Ethical cues:** Every cue has snooze/disable or frequency limits; metrics avoid time-spent/feed-volume celebration.
- [ ] **Navigation resync:** Always-mounted screens re-read relevant services on `[location.pathname]`.
- [ ] **Provider privacy:** Tests assert which context categories are sent to LLM/TTS providers.
- [ ] **Migration:** Old localStorage payloads with missing v1.6 fields load without throwing.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Over-broad triage excluded valid learning questions | MEDIUM | Add `ingestionStatus` reasons, let user review rejected items, reclassify accepted items, add fixtures |
| Graph pollution from non-learning chat | MEDIUM | Identify rejected reasons, set ingestion rejected, remove orphan anchors/clusters with zero valid Q&As, rebuild counts |
| Manual merge corrupts anchors | HIGH | Restore from graph edit/reorg snapshot; otherwise recompute anchors from Q&A parent links and ask user to confirm |
| Classification overwrites correction | MEDIUM | Add structural revision; replay correction from edit log; add stale-commit test |
| Retrieval IDs open missing posts | MEDIUM | Backfill retrieval snapshots from available caches/history; mark missing records with repair/delete UI |
| Podcast stale job overwrites current audio | LOW-MEDIUM | Add generationId guard; clear affected podcast audio/script and regenerate |
| Ethical cues cause fatigue | LOW | Lower default frequency, add snooze/disable, rewrite copy, remove reward coupling |
| localStorage migration blocks boot | HIGH | Ship lazy migration patch; avoid full-store rewrite; add corrupted/old-payload loader tests |
| Privacy context over-send | HIGH | Stop sending broad context, add payload tests, surface release note/settings reset if shipped |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Triage as chat suppression | Ingestion Triage Foundation | Fixture matrix for answer vs ingestion decisions |
| Persist-then-filter race | Ingestion Triage Foundation | Event sequence test with durable consumers attached |
| `flagged` overload | Data Model/Migration | Source-reading + loader tests over filter/prune/graph projection |
| Mind Elixir as source of truth | Graph Correction Data Model | Negative test: no persistence from `getData`/library edit state |
| Partial graph corrections | Graph Correction Commands | Invariant suite for parent/cluster/count/summary consistency |
| Manual edit vs async LLM races | Graph Trust Reliability | Revision/stale commit tests for classification and reorg |
| LocalStorage schema drift | Data Migration Foundation | Old payload and corrupted payload load tests |
| Retrieval becomes feed | Retrieval IA/Foundation | UAT: user can find saved concept without scrolling feed |
| ID-only retrieval loss | Retrieval Persistence | Purge/cache eviction tests for tagged/bookmarked/saved items |
| Podcast controls stale cache | Podcast Controls Data Model | optionsHash reuse/invalidation tests |
| Podcast generation races | Podcast Generation Reliability | Rapid regenerate stale-result test |
| Ethical cues nag | Ethical Engagement Foundation | Cue frequency/snooze tests and copy review |
| Always-mounted stale state | Cross-Cutting Event/Resync | `[location.pathname]` source-reading tests per screen |
| Prompt stability regression | Retrieval Ask Integration | Extend Phase 35 prompt-stability tests |
| Privacy boundary drift | Privacy/Context Boundary Gate | Provider payload exclusion tests |

## Sources

**Project sources (HIGH confidence):**
- `.planning/PROJECT.md` — v1.6 goal, filter-as-ingestion-gate clarification, local-first decisions, prior race/resync lessons.
- `.planning/STATE.md` — current milestone state and accepted v1.5 baselines.
- `app/src/services/question-filter.service.ts` — current regex/LLM hybrid filter and broad system-prompt/meta patterns.
- `app/src/state/useQuestions.ts` — answer persistence, filter patch, corrected event rebroadcast, fire-and-forget classification, byte-stable prompt invariant.
- `app/src/services/question.service.ts` — localStorage-primary question store, SQLite backup, buildAndSave event emission, fresh read-modify-write race defenses.
- `app/src/services/canonical-knowledge.service.ts` — classification commit, anchor/cluster structure, reorg snapshot/reconciliation, projection helpers.
- `app/src/screens/GraphScreen.tsx` — Mind Elixir projection layer, `editable: false`, event reloads, Android drag layer constraints.
- `app/src/services/graph.service.ts` — existing direct `moveToParent`/edge helpers and their limited patch behavior.
- `app/src/services/podcast.service.ts` and `app/src/state/usePodcast.ts` — one-podcast-per-date cache, IndexedDB audio storage, async generation events.
- `app/src/screens/PodcastScreen.tsx` — current podcast UI, concept insertion, regenerate path.
- `app/src/screens/SavedScreen.tsx`, `app/src/services/engagement.service.ts`, `app/src/services/post-history.service.ts` — Saved/Liked/History retrieval foundation and ID-to-history resolution.
- `app/src/services/settings.service.ts`, `app/src/services/legacy-migration.service.ts`, `app/src/services/db.service.ts` — settings schema, Trellis key migration, SQLite/localStorage split.
- Existing regression tests under `app/tests/` for prompt stability, engagement anti-wire, GraphScreen performance layer, SavedScreen, Force-New-Day, and canonical knowledge classification.

**External sources (MEDIUM-HIGH confidence):**
- MDN Web Storage API: `localStorage`/`sessionStorage` are synchronous and can block JS; IndexedDB is recommended for larger/performance-sensitive data. https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- MDN Storage quotas and eviction criteria: Web Storage is limited to about 10 MiB per origin and throws `QuotaExceededError` at limit. https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- MDN IndexedDB API: IndexedDB is a transactional object database for keyed structured-clone objects. https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- React docs, Synchronizing with Effects: Effects need cleanup for subscriptions/async work and Strict Mode remounts stress-test cleanup. https://react.dev/learn/synchronizing-with-effects
- Mind Elixir API docs: options include `editable`, `draggable`, `contextMenu`, and methods include edit/move/data APIs; Trellis must treat these as view-layer inputs unless mapped to canonical commands. https://docs.mind-elixir.com/docs/api/mind-elixir.options and https://docs.mind-elixir.com/docs/api/mind-elixir.methods
- W3C Ethical Web Principles: emphasizes privacy, verification, user control, and avoiding manipulative/addictive patterns. https://www.w3.org/TR/ethical-web-principles/

---
*Pitfalls research for: Trellis v1.6 Control, Graph Trust, Retrieval, Podcast Controls, and Ethical Engagement*
*Researched: 2026-05-13*
