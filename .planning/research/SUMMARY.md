# Project Research Summary

**Project:** Trellis v1.6 - Control, Graph Trust, Retrieval, and Ethical Engagement
**Domain:** Local-first AI learning app with learner-controlled knowledge ingestion, correctable graph structure, retrieval, podcasts, and ethical engagement
**Researched:** 2026-05-13
**Confidence:** HIGH for roadmap ordering and architecture; MEDIUM for MindElixir edit hooks and OpenAI TTS quality until device UAT

## Executive Summary

Trellis is a local-first AI learning workspace: Ask generates natural answers, the mind map organizes durable knowledge, the feed surfaces concept-linked material, SM-2 drives review, and podcasts recap learning. v1.6 should shift the product from "compelling learning feed" toward "trusted learner-controlled system." Experts build this type of product by separating chat presentation from durable knowledge ingestion, treating graph structure as canonical data rather than UI state, and making retrieval a bounded recovery tool rather than another discovery feed.

The recommended approach is conservative and service-oriented. Keep the existing React 19 / TypeScript / Vite / Tailwind / Capacitor stack, add `zod` for runtime validation at LLM/storage/edit-command boundaries, add `minisearch` for local full-text retrieval, and upgrade only MindElixir and Capacitor SQLite in-major where they directly support v1.6. The central dependency is strict: ingestion gate first, then graph command service and invariants, then graph UI, then retrieval/library surfaces, then podcast options, then ethical engagement cues over stable signals.

The key risks are data pollution, graph corruption, and engagement drift. Non-learning chat must be answerable but excluded from graph/review/feed/podcast/retrieval. MindElixir must remain a renderer/input surface, with every correction flowing through a validated graph edit service. Retrieval must help users find, resume, compare, and practice prior learning, not create a second infinite feed. Podcast options must be bounded and quality-preserving, not freeform prompt personas. Ethical engagement must be separate from save/like/dismiss metrics and must prioritize goals, stop cues, recall, review, and reflection.

## Key Findings

### Recommended Stack

v1.6 should avoid a platform rewrite. The existing local-first service architecture is already aligned with the milestone: services own business logic, screens re-read after event-bus signals, `Question` records remain the canonical graph substrate, localStorage is the active store, SQLite backs up questions, and IndexedDB stores podcast audio blobs.

**Core technologies:**
- React / React DOM `^19.2.6`: UI framework - keep current validated version; no UI architecture change is needed.
- TypeScript `~5.9.3`: static contracts - keep tilde pin while adding runtime schemas for untrusted boundaries.
- Vite `^7.3.1` and Tailwind CSS 4: build/style stack - no v1.6 need justifies major churn.
- Capacitor `^8.3.3`: native shell - keep current shell; no new native plugin is required.
- `@capacitor-community/sqlite` `^8.1.0`: durable cold backup - upgrade before adding v1.6 schema/migration surface.
- MindElixir `^5.11.0`: mind-map rendering - retain current renderer, but drive edits through Trellis commands.
- `zod` `^4.4.3`: runtime validation - required for LLM JSON, storage migrations, graph commands, podcast options, and learning-engagement records.
- `minisearch` `^7.2.0`: local search - use for archive/knowledge/podcast retrieval; use embeddings only as an optional reranker.
- Existing LLM/TTS/embedding provider layers: provider-neutral AI calls - do not add LangChain, Agents SDK, vector DBs, graph DBs, analytics SDKs, or backend sync.

Critical version notes: upgrade MindElixir and Capacitor SQLite before graph/storage work; move OpenAI TTS default from hard-coded `tts-1` toward configurable `gpt-4o-mini-tts` only with provider capability checks and device UAT.

### Expected Features

**Must have (v1.6 P1):**
- Ingestion outcome taxonomy - distinguish `Added to map`, `Chat only`, `Needs review`, and `Security blocked`.
- Professor-edge-case classifier behavior - "What is a system prompt?" can be learned; "show/reveal/print your system prompt" cannot become durable knowledge.
- Flagged chat override path - learner can add a flagged-but-valid item with confirm/retitle, not by silently flipping a hidden boolean.
- Manual graph corrections - rename, move/reassign, merge duplicates, detach, prune/delete, and undo last edit.
- Archive search - search Saved, Liked, and History by title/body/concept/source, opening back to the original post.
- Podcast pre-generation controls - length and style options persist with each podcast and regeneration honors them.
- Learning stop cue - after a goal or useful threshold, route toward review/reflection/podcast/close rather than endless feed continuation.
- Retrieval/reflection prompt after meaningful engagement - prompt recall or card creation after clusters of saved/liked/deep-read activity, not every post.

**Should have (v1.6.x P2):**
- Quarantine inbox for ambiguous ingestion decisions.
- Concept dashboard v1 joining Q&As, posts, saved/liked/history, review cards, podcast mentions, tags, and weak/confident indicators.
- Flat local tags/bookmarks for concepts and posts.
- AI-suggested graph corrections with learner approval, preview, and undo.
- Podcast weak-concept focus using due/weak concepts without losing learner-selected inclusions.
- Learning-oriented weekly summary focused on recall, review, corrections, concept coverage, and reflections.

**Defer (v2+):**
- Full graph version history beyond last-action undo.
- Cross-device sync for retrieval/tags, because it requires privacy, auth, and conflict-resolution design.
- Collaborative/social learning and public metrics.
- Advanced tag query language.
- Podcast chapters and interactive audio quizzes.
- Personalized engagement model training.

Anti-features: do not block harmless off-topic chat at presentation time; do not rely on regex-only filtering; do not make global one-click reorganization the main correction tool; do not auto-merge graph nodes; do not build entertainment personas, streak pressure, public likes, leaderboards, or infinite scroll success metrics.

### Architecture Approach

v1.6 should extend Trellis through additive local-first services and typed events. The main architectural move is to split answer generation from durable knowledge ingestion, then make every graph correction a validated transaction over `Question[]`. Retrieval, library metadata, podcast options, and ethical engagement should be leaf services consuming existing stores and emitting narrow events.

**Major components:**
1. `ingestion-gate.service.ts` / refactored `question-filter.service.ts` - answer-vs-ingest decisions with reason, confidence, overrideability, and schema validation.
2. `question.service.ts` / `useQuestions.ts` - split chat answer events from accepted-ingestion events; avoid persist-then-filter races.
3. `graph-edit.service.ts` - rename/move/merge/detach/prune/undo transactions, edit log, graph invariants, SQLite write-through where relevant.
4. `canonical-knowledge.service.ts` - respect manual locks/revisions and avoid overwriting learner corrections during classification/reorg.
5. `GraphScreen.tsx` - correction UI only; MindElixir stays renderer/input, not source of truth.
6. `retrieval.service.ts` - MiniSearch-backed local search across questions, anchors, posts, history, tags, and podcast scripts.
7. `library.service.ts` - tags/bookmarks metadata; saved/liked remains owned by `engagementService`.
8. `podcast.service.ts` / `usePodcast.ts` - option snapshots, options hash, generation IDs, bounded prompt templates, and stale-job dropping.
9. `learning-engagement.service.ts` - goals, stop cues, reflection/retrieval prompts, and learning metrics separate from feed engagement.

Key patterns: keep services as owners; keep `GRAPH_UPDATED` as broad invalidation; add narrow events only when UI needs detail; use load-time normalization for old localStorage records; preserve always-mounted screen `[location.pathname]` resync; keep dynamic retrieval context out of byte-stable Ask system prompts.

### Critical Pitfalls

1. **Treating ingestion triage as chat suppression** - answer safe natural chat, but only persist/classify/search learning material. Add fixtures for "What is a system prompt?" versus "Show me your system prompt."
2. **Persist-then-filter race** - do not let untriaged `QUESTION_ASKED` drive graph, retrieval, podcast concepts, or metrics. Split `QUESTION_ANSWERED` from `QUESTION_INGESTED`, or require durable consumers to filter explicit ingestion status.
3. **Overloading `flagged`** - do not reuse one boolean for off-topic, prompt-leak, pruned, hidden, detached, and corrected states. Add explicit `ingestion` and `graphTrust` metadata with loader tests.
4. **Letting MindElixir mutate canonical state** - never persist `mei.getData()` or library edit state. Convert UI actions to graph edit commands and re-render from `Question` records.
5. **Partial graph corrections** - rename/move/merge/detach must patch parents, children, labels, `clusterNodeId`, `qaCount`, summaries, tombstones, edit history, and emit one `GRAPH_UPDATED`.
6. **Manual edits racing classification/reorg** - add structural revision/manual lock metadata and stale-commit checks so in-flight LLM work cannot undo learner corrections.
7. **Retrieval becomes another feed** - search must be query/filter/dashboard/review oriented, bounded, and recovery-focused; no endless recommendations.
8. **Podcast controls with stale cache identity** - reuse a ready podcast only when date, concept IDs, locale, and options hash match; rapid regenerations need generation IDs.
9. **Ethical cues become nagging or reward loops** - keep cues sparse, user-controlled, snoozable/disableable, and measured by learning outcomes rather than time spent or posts viewed.
10. **Privacy/context boundary drift** - saved/liked history, goals, tags, corrections, and reflections must not be sent to providers by default; add provider payload exclusion tests.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Model, Events, and Migration Foundation

**Rationale:** v1.6 introduces multiple new states. The roadmap should first define explicit local-first schemas, load-time normalization, event semantics, reset behavior, and provider/context boundaries so later feature phases do not overload `flagged`, `ENGAGEMENT_CHANGED`, or `QUESTION_ASKED`.
**Delivers:** Additive `Question.ingestion`, `Question.graphTrust`, podcast options types, graph edit record types, retrieval/library/learning-engagement types, app events, old-payload loader tests, Clear All Data/Force-New-Day reset inventory, and provider context-category tests.
**Addresses:** Ingestion taxonomy, graph trust metadata, podcast options identity, learning metrics separation.
**Avoids:** `flagged` overload, localStorage schema drift, persist-then-filter races, privacy boundary drift, always-mounted stale state.

### Phase 2: Ingestion Gate Foundation

**Rationale:** The ingestion gate must come before graph edits, retrieval, podcasts, dashboards, and metrics. Otherwise every downstream surface inherits polluted nodes and false learning signals.
**Delivers:** Deterministic + LLM fallback ingestion evaluator with Zod-validated decisions; explicit answer-vs-ingest events; professor-edge-case fixtures; Ask status chips; visible add-to-map override path; non-ingested chat excluded from graph/review/feed/podcast/retrieval.
**Addresses:** `Added to map`, `Chat only`, `Needs review`, `Security blocked`, override path, prompt-leak distinction.
**Avoids:** Chat suppression, regex-only false positives, untriaged event indexing, prompt stability regression.

### Phase 3: Graph Command Service and Invariant Suite

**Rationale:** Graph command service must exist before UI controls. Correctness belongs below `GraphScreen`, because corrections affect review, feed, retrieval, podcasts, and future dashboards.
**Delivers:** `graph-edit.service.ts`, batch question patch helper, edit log/inverse undo, rename/move/merge/detach/prune commands, tombstone merge behavior, manual locks/revisions, stale classification/reorg protections, invariant tests for parent/cluster/count/summary consistency.
**Addresses:** Manual correction primitives and undo.
**Avoids:** MindElixir-as-source-of-truth, partial corrections, merge data loss, async classifier/reorg overwrites.

### Phase 4: Graph Correction UI

**Rationale:** With tested commands underneath, UI can stay thin and trustable. The screen should expose local, reversible corrections instead of opaque global reorganization as the primary trust mechanism.
**Delivers:** Graph/anchor correction sheet, rename/move/merge/detach/prune flows, merge preview, "why here?" placement explanation, undo affordance, selected-node resync after edits/deletes.
**Addresses:** Learner ownership of graph structure; graph correction as metacognition.
**Avoids:** UI handlers patching `Question` directly; controls that disappear after navigation; stale always-mounted GraphScreen state.

### Phase 5: Retrieval and Library Foundation

**Rationale:** Retrieval should build only after ingestion and graph identity are trustworthy. It should be a recovery/search layer over known local stores, not a feed ranking layer.
**Delivers:** `retrieval.service.ts` with MiniSearch lexical index plus optional embedding rerank; `library.service.ts` for tags/bookmarks; ID+snapshot retention rules for tagged/bookmarked/saved content; `LIBRARY_CHANGED`/index dirty events; bounded result model by item type and source.
**Addresses:** Archive search, tags/bookmarks foundation, podcast transcript search foundation, concept dashboard data.
**Avoids:** Retrieval-as-feed, ID-only missing content, localStorage quota bloat, search jank, silent web/current retrieval.

### Phase 6: Retrieval Surfaces and Concept Dashboard

**Rationale:** UI should consume retrieval/library services instead of embedding multi-store search logic into screens. Start with archive search, then ship concept dashboards once graph IDs and retrieval records are stable.
**Delivers:** Saved/Liked/History search and filters; result source labels; flat tags/bookmarks UI; concept dashboard v1 or enhanced AnchorDetailScreen with Q&As, posts, saved/liked/history, reviews, podcast mentions, weak/due signals, and tags.
**Addresses:** Retrieval after feed discovery; concept-level durable home; local-first trust labels.
**Avoids:** Endless archive browse; recency/engagement-only ranking; "where did I save that?" failures.

### Phase 7: Podcast Options and Quality Guardrails

**Rationale:** Podcast controls are valuable only when concept selection is stable and option identity is explicit. Controls must improve educational quality, not just word count or entertainment tone.
**Delivers:** Typed length/style/detail options, defaults in settings, options snapshot on `DailyPodcast`, options hash reuse/invalidation, generation ID stale-job dropping, bounded prompt templates, concept coverage constraints, regenerate-with-options UI, configurable TTS model/voice/speed where supported.
**Addresses:** Length/style controls, regeneration honoring options, weak/due/saved/manual concept inclusion groundwork.
**Avoids:** Stale podcast cache, freeform style prompt injection, old audio overwrite, style options that drop required concepts.

### Phase 8: Ethical Engagement Foundation and Metrics UI

**Rationale:** Ethical engagement should consume stable ingestion, graph, retrieval, review, post history, and podcast signals. It must not reuse save/like/dismiss as learning success.
**Delivers:** `learning-engagement.service.ts`, goals, stop cues, reflection/retrieval prompts, cue frequency controls, snooze/disable, learning metrics dashboard, "why this?" labels from local reasons, reset semantics.
**Addresses:** Goals, stop cues, reflection/retrieval prompts, learning-oriented success metrics.
**Avoids:** Nagging cues, streak/credit pressure, private engagement signals masquerading as learning, cue telemetry corrupting `engagementService`.

### Phase Ordering Rationale

- Ingestion first: clean durable knowledge prevents review, feed, retrieval, podcast, and metrics pollution.
- Graph service before graph UI: tested command transactions avoid data corruption and make UI work reversible.
- Retrieval after graph trust: concept dashboards and search depend on stable anchor IDs and correct ingestion status.
- Podcast after retrieval/graph identity: selected concepts, weak/due focus, and transcript retrieval are more coherent once graph and library records are stable.
- Ethical engagement last: goals and cues should reuse mature local signals instead of inventing parallel metrics.
- Cross-cutting foundations first: schema normalization, event semantics, prompt-stability tests, and privacy payload tests prevent later phases from creating hidden drift.

### Research Flags

Phases likely needing deeper `/gsd:research-phase` during planning:
- **Phase 3: Graph Command Service and Invariant Suite** - MindElixir remains a renderer, but exact edit affordance inputs and MindElixir 5.11 event hooks need implementation-time validation.
- **Phase 7: Podcast Options and Quality Guardrails** - OpenAI `gpt-4o-mini-tts` model quality/latency and provider-specific style instruction support need device/audio UAT.
- **Phase 8: Ethical Engagement Foundation and Metrics UI** - cue copy, frequency, and learner-agency defaults need careful product validation to avoid nagging/reward-loop drift.

Phases with standard patterns (skip research-phase unless plan scope changes):
- **Phase 1: Data Model, Events, and Migration Foundation** - localStorage additive schemas, loader normalization, event union updates, and source-reading tests follow established Trellis patterns.
- **Phase 2: Ingestion Gate Foundation** - provider layer, Zod validation, and fixture-driven testing are well specified by research.
- **Phase 5: Retrieval and Library Foundation** - MiniSearch plus local store aggregation is well documented; use implementation profiling before considering IndexedDB persistence.
- **Phase 6: Retrieval Surfaces and Concept Dashboard** - SavedScreen and AnchorDetail patterns already exist.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Source research found direct fit with existing React/TS/Vite/Capacitor/local-first stack; only `zod`, `minisearch`, MindElixir, and SQLite minor updates are recommended. |
| Features | HIGH | Feature ordering directly matches professor feedback and current product gaps; P1/P2/P3 split is clear. |
| Architecture | HIGH | Existing codebase already uses service ownership, event-bus invalidation, localStorage/SQLite/IndexedDB boundaries, and always-mounted resync patterns. |
| Pitfalls | HIGH | Pitfalls are grounded in current code paths and prior Trellis incident history; external ecosystem risks are MEDIUM-HIGH. |

**Overall confidence:** HIGH for phase ordering and implementation shape; MEDIUM for experiential quality of podcast audio and ethical cue UX until UAT.

### Gaps to Address

- **Ingestion metadata naming:** Research uses both `learning/chat_only/security_blocked/needs_review` and `ingested/not_ingested/override_ingested`. Phase 1 should settle canonical enum names before implementation.
- **Graph edit storage durability:** Decide whether `trellis_graph_edits_v1` is localStorage-only or also backed by SQLite. Corrected graph state is already backed by `questions`; undo durability is the open question.
- **MiniSearch persistence:** Start in-memory/rebuild-on-demand. Persist serialized index to IndexedDB only if profiling shows visible rebuild latency.
- **Podcast TTS defaults:** Validate `gpt-4o-mini-tts`, voices, speed, and instruction support on device before making it the only OpenAI default.
- **Ethical cue thresholds:** Define sparse defaults and copy through UAT; do not equate saves/likes/dismisses with learning progress.
- **Provider privacy categories:** Each LLM/TTS call site must document which local context categories it sends and tests should assert exclusions for goals, tags, saved/liked history, and correction logs by default.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` - v1.6 milestone goals, local-first decisions, filter-as-ingestion-gate clarification, and prior load-bearing patterns.
- `.planning/research/STACK.md` - package/version recommendations, additions, alternatives, and confidence notes.
- `.planning/research/FEATURES.md` - table stakes, differentiators, anti-features, dependencies, and MVP/P2/P3 split.
- `.planning/research/ARCHITECTURE.md` - service boundaries, data flow, storage/event changes, integration points, anti-patterns, and suggested build order.
- `.planning/research/PITFALLS.md` - critical pitfalls, performance traps, security mistakes, UX risks, checklists, recovery strategies, and pitfall-to-phase mapping.
- Local source references cited by research: `question-filter.service.ts`, `question.service.ts`, `useQuestions.ts`, `canonical-knowledge.service.ts`, `graph.service.ts`, `GraphScreen.tsx`, `podcast.service.ts`, `usePodcast.ts`, `PodcastScreen.tsx`, `SavedScreen.tsx`, `engagement.service.ts`, `post-history.service.ts`, `settings.service.ts`, `legacy-migration.service.ts`, and `db.service.ts`.

### Secondary (MEDIUM-HIGH confidence)
- MiniSearch docs - browser/Node full-text indexing, field boosts, and serialization.
- Zod docs - TypeScript-first runtime schema validation.
- MindElixir docs/GitHub - editable mind-map APIs and renderer behavior.
- Capacitor Community SQLite metadata - Capacitor 8 peer compatibility.
- OpenAI TTS docs - `gpt-4o-mini-tts` and speech options.
- MDN Web Storage / IndexedDB / Storage Quotas - synchronous localStorage limits and IndexedDB suitability.
- React effects docs - subscription cleanup and Strict Mode behavior.
- CMU Eberly Center retrieval practice guidance - learning rationale for recall prompts.
- Digital Promise AI learning framework - agency, opt-out, reflection, learner-facing data, and prompt frequency.
- Miro, Apple Podcasts, Anki, Obsidian docs - ecosystem norms for mind-map controls, podcast controls, search/tags, and graph filters.
- OWASP LLM Top 10, OpenAI prompt-injection guidance, W3C Ethical Web Principles - security, privacy, and user-control guardrails.

---
*Research completed: 2026-05-13*
*Ready for roadmap: yes*
