# Stack Research

**Domain:** Local-first AI learning app v1.6 stack additions: ingestion triage, graph correction, retrieval, podcast controls, ethical engagement
**Researched:** 2026-05-13
**Confidence:** HIGH for dependency/version recommendations; MEDIUM for OpenAI TTS model migration impact until device audio UAT

## Scope

This research covers only stack additions or changes needed for v1.6. Trellis already has a working React 19 / TypeScript / Vite / Tailwind / Capacitor local-first app with AI Q&A, incremental graph classification, MindElixir rendering, embeddings, SM-2 review, feed engagement, saved/liked/history archives, web search grounding, and TTS podcasts.

The v1.6 stack should stay conservative: keep the existing service-oriented local-first architecture, add a small local search index, add runtime validation at LLM/storage boundaries, upgrade only the graph and SQLite packages that directly support the new work, and avoid backend, analytics, agent-framework, and vector-database additions.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React / React DOM | Keep `^19.2.6` | UI framework | Already validated in v1.5. v1.6 is mostly service/UI composition work, not a React architecture change. |
| TypeScript | Keep `~5.9.3` | Static types | Current build is validated. Keep tilde pin while adding schema-validated boundaries. |
| Vite | Keep `^7.3.1` | Build/dev server | No v1.6 feature needs a build-system migration. Avoid Vite major churn during data-model work. |
| Capacitor | Keep `^8.3.3` | Native shell | Already aligned across core/android/ios/cli. No new native plugin is required for v1.6. |
| `@capacitor-community/sqlite` | Upgrade lockfile/package to `^8.1.0` | Native cold backup and durable graph/search metadata tables | Current lockfile is 8.0.1 while npm latest is 8.1.0 and peer-compatible with Capacitor `>=8.0.0`. Upgrade before adding v1.6 tables/migrations. |
| MindElixir | Upgrade lockfile/package from 5.9.3 to `^5.11.0` | Mind-map rendering and edit affordances | Existing `GraphScreen.tsx` already uses MindElixir. v1.6 should enable controlled edit mode on the same library rather than introducing a second graph renderer. |
| Existing LLM provider layer | No package change | Ingestion classifiers, podcast scripts, reflection prompts | `chatCompletion` already supports OpenAI/Claude/Gemini/local endpoints. Use it with stricter schema validation instead of adding LangChain/Agents. |
| Existing embedding provider layer | No package change | Semantic candidate ranking and graph-trust checks | `embedText` + `cosine` already back query context and anchor pre-checks. Use the same vectors for retrieval ranking and merge suggestions. |
| Existing local-first storage | No wholesale change | Active app state | Keep `localStorage` as active source of truth and SQLite as cold backup per `question.service.ts`. Add narrowly scoped versioned records, not a database rewrite. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `^4.4.3` | Runtime validation for LLM JSON, storage migrations, and edit commands | Add now. Use for ingestion decisions, graph edit operations, podcast option profiles, and engagement-goal records. |
| `minisearch` | `^7.2.0` | Browser-local full-text index | Add now for saved/history/search/tag retrieval across questions, anchors, posts, and podcast scripts. |
| `idb` | `^8.0.3` | Promise wrapper around IndexedDB | Optional but recommended if v1.6 persists MiniSearch indexes, dashboard rollups, or more podcast/audio metadata in IndexedDB. If only audio blobs stay in IDB, existing raw helpers are enough. |
| `lucide-react` | Keep `^0.575.0` | UI icons | Existing icon system is enough for edit/search/tag/goal controls. Do not add another icon library. |
| `framer-motion` | Keep `^12.38.0` | Existing lightweight transitions | Enough for edit confirmations, stop cues, and dashboard transitions. Keep reduced-motion discipline from v1.5. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Node `node:test` | Service and source-reading tests | Continue leaf-module pattern. Add tests for ingestion false positives, edit-command invariants, search index rebuild, and ethical guardrail anti-wire behavior. |
| ESLint / TypeScript | Regression guard | Add source-reading tests where behavior is structural, such as no raw MindElixir export overwrite and no analytics SDK import. |
| OpenSpec / `.planning` | Requirement traceability | v1.6 changes alter behavior and user trust; update specs for ingestion, graph correction, retrieval, and guardrail semantics. |

## Installation

```bash
# Required production additions
npm install zod minisearch

# Recommended package updates before graph/storage work
npm install mind-elixir@^5.11.0 @capacitor-community/sqlite@^8.1.0

# Optional only if v1.6 persists search/dashboard/audio metadata in IndexedDB
npm install idb
```

Do not add dev dependencies for this milestone unless tests reveal a concrete gap.

## Integration Recommendations

### 1. Knowledge-Ingestion Triage

Use the existing answer flow and split it into two decisions:

| Decision | Owner | Storage Effect |
|----------|-------|----------------|
| Answer disposition | `useQuestions.ts` / existing LLM flow | Chat can answer natural conversation. |
| Graph ingestion disposition | New `ingestion-triage.service.ts` | Only durable learning material updates `trellis_questions` and graph hierarchy. |

Add `zod` schemas for a versioned ingestion result:

```ts
const IngestionDecisionV2 = z.object({
  schemaVersion: z.literal(2),
  answerable: z.boolean(),
  ingest: z.boolean(),
  category: z.enum([
    'learning',
    'follow_up_learning',
    'small_talk',
    'app_meta',
    'prompt_leak_attempt',
    'jailbreak',
    'unsafe',
    'low_signal',
  ]),
  rationale: z.string().max(240),
  targetNodeId: z.string().optional(),
});
```

Why: `question-filter.service.ts` currently uses broad regexes that can flag legitimate learning questions like "What is a system prompt?" because the filter conflates prompt-leak attempts with conceptual questions about prompts. v1.6 needs a durable ingestion gate, not a chat presentation filter. Zod gives a strict runtime boundary for LLM JSON while preserving TypeScript inference.

Keep deterministic rules for obvious cases, but route ambiguous cases through the existing `chatCompletion` provider. Do not add OpenAI Moderation as the primary classifier; Trellis supports non-OpenAI and local providers, and the main issue is educational durability, not generic safety classification.

### 2. Editable / Correctable Mind Maps

Keep MindElixir, upgrade to `^5.11.0`, and make edits command-driven:

| Capability | Integration Point | Stack Choice |
|------------|-------------------|--------------|
| Rename anchor/cluster | New `graph-edit.service.ts` calling `questionService.patchQuestion` | No new dependency beyond Zod. |
| Move anchor between clusters | `graphService.moveToParent` plus branch/cluster label patching | Reuse existing graph service. |
| Merge anchors | Existing canonical merge fields: `aliases`, `sourcePrompts`, `sourceQuestionIds`, child Q&A reassignment | Reuse `canonical-knowledge.service.ts` patterns. |
| Detach/correct node | Patch `parentId`, `clusterNodeId`, labels, and trust metadata | Reuse local store + SQLite backup. |
| Undo recent edit | Store inverse `GraphEditCommand` records in `trellis_graph_edits_v1` and optionally SQLite | No graph database. |

Do not let MindElixir become the source of truth. `GraphScreen.tsx` should enable edit affordances only in an explicit edit mode, translate UI actions into validated commands, apply them through services, then rebuild `MindElixirData` from canonical questions. Avoid raw `mei.getData()` overwrite of `trellis_questions`; it would lose Trellis-specific fields such as review schedules, source prompts, embeddings, aliases, and cluster metadata.

### 3. Retrieval / Search / Tags / Dashboards

Add MiniSearch as the local full-text index. It is small, browser-compatible, supports field boosts/search options, and can serialize/deserialize indexes. Use embeddings as a reranker, not as the only retrieval layer.

Recommended index service:

| Document Type | Source | Indexed Fields |
|---------------|--------|----------------|
| Concept/anchor/Q&A | `questionService.getAll({ includeFlagged: true })` | title, content, answer, summary, keywords, aliases, root/branch/cluster labels, user tags |
| Feed posts | `postHistoryService.getPosts()` | title, hook/body, contextLabel, source domains, concept id, saved/liked flags |
| Podcasts | `podcastService.getAll()` | script, questionIds, date, style/length profile |
| Dashboard rollups | `trajectoryAnalyzerService` + graph summaries | concept labels, weak-area ids, review counts |

Suggested pattern:

- New `search-index.service.ts` owns MiniSearch construction, incremental updates, and rebuild.
- New `tag.service.ts` stores explicit user tags as ID-only records: `trellis_tags_v1`.
- Use existing `eventBus` events (`GRAPH_UPDATED`, `ENGAGEMENT_CHANGED`, podcast generation events) to mark the search index dirty.
- Search result ranking should blend lexical score, saved/liked boosts, recent review signals, and optional cosine rerank when embedding vectors exist.
- Persist only lightweight metadata in localStorage. Persist larger serialized MiniSearch indexes in IndexedDB only if rebuild latency becomes visible; otherwise rebuild on app start from local stores.

This avoids overbuilding a database layer while giving users real retrieval across the local corpus.

### 4. Higher-Quality Configurable Podcasts

Keep `podcast.service.ts`, IndexedDB audio blob storage, and the existing TTS provider abstraction. Add configuration fields; do not add a podcast framework.

Recommended data additions:

```ts
type PodcastLength = 'short' | 'standard' | 'deep';
type PodcastStyle = 'calm_tutor' | 'socratic' | 'story_driven' | 'exam_review';

interface PodcastProfile {
  length: PodcastLength;
  style: PodcastStyle;
  includeReviewPrompts: boolean;
  conceptIds?: string[];
}
```

OpenAI TTS change: replace the hard-coded `model: 'tts-1'` in `providers/tts/index.ts` with a configurable model defaulting to `gpt-4o-mini-tts` for OpenAI, and pass style instructions when the provider supports them. Keep the existing fallback behavior where the OpenAI TTS key can reuse the LLM key.

Implementation points:

- `settings.service.ts`: add `tts.model` and podcast defaults.
- `SettingsAIScreen.tsx`: expose model/voice/speed only where provider supports it.
- `podcast.service.ts`: compile script prompts from length/style, target word counts, review prompts, and source concept IDs.
- `providers/tts/index.ts`: include `model`, `voice`, `speed`, and optional provider-specific `instructions`.
- Keep raw IndexedDB blob storage unless `idb` is adopted for shared storage cleanup.

Do not add `ffmpeg.wasm`, audio mixing, background music, or multi-track editing in v1.6. Those add large bundles and distract from learner-directed content quality.

### 5. Ethical Engagement Guardrails

No new third-party stack is required. Build these as local services over existing data:

| Capability | Service | Data Source |
|------------|---------|-------------|
| Learning goals | `learning-goal.service.ts` | localStorage/SQLite backup |
| Stop cues | `engagement-guardrail.service.ts` | feed views, session duration, repeated dismiss/scroll behavior |
| Reflection prompts | `reflection-prompt.service.ts` | recent saved/liked/history + weak areas |
| Retrieval prompts | `retrieval-cue.service.ts` | SM-2 due cards, MiniSearch hits, concept dashboard state |
| Learning metrics dashboard | Extend `trajectoryAnalyzer.service.ts` | review performance, concept coverage, retrieval actions, reflections |

Use the existing `@capacitor/local-notifications` only for user-scheduled learning reminders. Do not add push notifications, remote analytics, growth-event SDKs, A/B testing SDKs, streak engines, or social-feed recommender packages. v1.6 should make engagement legible and bounded, not more addictive.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `minisearch` | `fuse.js` | Use Fuse only for tiny fuzzy picker lists. It is not a full retrieval layer for posts/questions/scripts. |
| `minisearch` | `flexsearch` | Use FlexSearch only if profiling shows MiniSearch too slow at much larger corpus sizes. It is more complex than Trellis needs now. |
| Zod schemas | Hand-written validators | Use hand-written validators only for tiny hot-path shape checks. LLM/storage boundaries need reusable schemas and parse errors. |
| MindElixir controlled edit mode | React Flow / Cytoscape | Use those only if Trellis abandons mind-map layout for freeform graph editing. v1.6 needs correction controls on the current map, not a renderer replacement. |
| Existing provider fetch layer | OpenAI SDK / Agents SDK / LangChain | Use framework SDKs only after Trellis needs multi-step hosted tool orchestration. Current local-first browser provider layer is simpler and provider-neutral. |
| Existing local stores + SQLite backup | Supabase/Firebase/Postgres | Use a backend only for multi-device sync or collaboration. v1.6 is local-first learner control. |
| Existing IndexedDB helpers | `idb` | Add `idb` if more than audio blobs need IndexedDB. Otherwise raw helpers are adequate. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| LangChain, LlamaIndex, OpenAI Agents SDK | Too much orchestration for local-first browser flows; adds abstraction around provider calls Trellis already owns. | Existing `chatCompletion`, `chatStream`, `embedText`, plus Zod schemas. |
| Vector database (`pgvector`, Chroma, LanceDB, Pinecone) | Requires backend/runtime complexity and duplicates existing local embeddings for current corpus scale. | MiniSearch lexical index + existing embedding rerank. |
| Graph database (`neo4j`, `d3-force` rewrite, Cytoscape) | v1.6 needs correction commands, not a graph-storage rewrite. | MindElixir controlled edit mode + canonical question store. |
| Redux/Zustand/Jotai | Existing services + eventBus already work. New global state library would create parallel state ownership. | Local services, eventBus subscriptions, route resync pattern. |
| Analytics SDKs / growth engagement SDKs | Conflicts with local-first privacy and ethical engagement goal. | Local metrics in `trajectoryAnalyzer.service.ts` and user-visible dashboard. |
| Push notification services | Remote nudging undermines learning-first guardrails and requires backend credentials. | Existing local notifications only for user-set reminders. |
| `ffmpeg.wasm` / audio editing stack | Large mobile bundle and unnecessary for configurable spoken recaps. | Better script prompts + higher-quality TTS model + voice/style controls. |
| Raw regex-only ingestion filters | Current broad patterns create false positives for legitimate learning questions. | Two-stage ingestion triage with deterministic rules + Zod-validated LLM decision. |

## Stack Patterns by Variant

**If a feature changes durable learning data:**
- Add a versioned local service and Zod schema.
- Apply changes through `questionService.patchQuestion` or a small service wrapper.
- Emit one semantic event through `eventBus`.
- Add a source-reading or behavioral test for the invariant.

**If a feature is read-only retrieval/dashboard UI:**
- Build from `questionService`, `postHistoryService`, `engagementService`, `trajectoryAnalyzerService`, and MiniSearch.
- Rebuild derived views from source stores rather than duplicating snapshots.

**If a feature affects graph structure:**
- Treat MindElixir as renderer/input surface only.
- Store edit commands and canonical field patches in Trellis data models.
- Keep an undo/inverse command log for recent user corrections.

**If a feature affects podcast quality:**
- Add provider-neutral script/profile settings first.
- Use OpenAI-specific TTS instructions only behind provider capability checks.
- Keep TTS failure non-fatal: script should remain readable if audio generation fails.

**If a feature affects engagement:**
- Prefer stop cues, reflection prompts, and retrieval prompts over streaks or infinite-feed rewards.
- Store all metrics locally and show them as learning outcomes, not growth metrics.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@capacitor-community/sqlite@^8.1.0` | `@capacitor/core@^8.3.3` | npm metadata lists peer dependency `@capacitor/core >=8.0.0`; keep all Capacitor packages on 8.x together. |
| `mind-elixir@^5.11.0` | React wrapper pattern in `GraphScreen.tsx` | MindElixir is not React-native state. Destroy/re-init discipline in `GraphScreen.tsx` should remain. |
| `minisearch@^7.2.0` | Browser + Node | Good fit for app runtime and `node:test`; serialize index only if rebuild cost matters. |
| `zod@^4.4.3` | TypeScript 5.9 | Use schemas in leaf modules to avoid i18n/import chains in tests. |
| OpenAI `gpt-4o-mini-tts` | Existing fetch-based TTS provider | Official OpenAI TTS guide documents `gpt-4o-mini-tts`; test on device because audio latency/voice quality are experiential. |

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Existing stack reuse | HIGH | Required files show mature services for graph, embeddings, podcasts, engagement, storage, and eventing. |
| `zod` addition | HIGH | v1.6 introduces LLM JSON and migration boundaries where runtime validation directly prevents corruption. |
| `minisearch` addition | HIGH | Retrieval/search/tag support needs local indexing; npm/docs confirm browser full-text use and serialization support. |
| MindElixir upgrade/editing | MEDIUM | Staying on MindElixir is clearly right, but exact editing event hooks need implementation-time validation against 5.11.0 docs/source. |
| OpenAI TTS model change | MEDIUM | Official docs support the model, but voice quality, latency, and mobile playback need UAT. |
| SQLite upgrade | HIGH | Minor-compatible with Capacitor 8; do before adding migration surface. |

## Sources

- Local repo: `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `question-filter.service.ts`, `canonical-knowledge.service.ts`, `GraphScreen.tsx`, `podcast.service.ts`, `SavedScreen.tsx`, `question.service.ts`, `db.service.ts`, `engagement.service.ts`, `trajectoryAnalyzer.service.ts`.
- npm registry queried 2026-05-13: `zod@4.4.3`, `minisearch@7.2.0`, `idb@8.0.3`, `mind-elixir@5.11.0`, `@capacitor-community/sqlite@8.1.0`, `fuse.js@7.3.0`, `flexsearch@0.8.212`.
- MiniSearch official docs: https://lucaong.github.io/minisearch/ — browser/Node full-text search, fields, search options, serialization.
- Zod official docs: https://zod.dev/ — TypeScript-first runtime schema validation and parsing.
- idb official README: https://github.com/jakearchibald/idb — IndexedDB promise wrapper and `openDB` pattern.
- MindElixir official site/GitHub: https://mind-elixir.com/ and https://github.com/SSShooter/mind-elixir-core — mind-map core and editable mind-map APIs.
- Capacitor Community SQLite GitHub/npm metadata: https://github.com/capacitor-community/sqlite — Capacitor 8 peer compatibility.
- OpenAI official TTS docs: https://platform.openai.com/docs/guides/text-to-speech — `gpt-4o-mini-tts` and speech generation options.

---
*Stack research for: Trellis v1.6 Control, Graph Trust, Retrieval, and Ethical Engagement*
*Researched: 2026-05-13*
