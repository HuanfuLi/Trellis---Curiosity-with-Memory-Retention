# Feature Research

**Domain:** Local-first AI learning app - learner control, graph trust, retrieval, podcast controls, ethical engagement
**Researched:** 2026-05-13
**Confidence:** HIGH for project-fit and core feature ordering; MEDIUM for broader market norms where based on external product/docs research.

## Feature Landscape

v1.6 should make Trellis feel less like an autonomous feed generator and more like a learner-controlled knowledge workspace. The professor feedback maps to five user-visible promises:

1. Chat stays natural, but only intentional learning material enters the mind map.
2. The mind map is inspectable and correctable by the learner.
3. Podcasts can be shaped by the learner without becoming shallow entertainment.
4. Saved, liked, history, tags, search, and concept dashboards make discovery retrievable later.
5. Engagement nudges point back to learning goals, recall, and stopping points instead of pure scroll depth.

The strongest implementation principle is to treat filtering as an ingestion gate, not a presentation gate. The learner should be able to ask "hi", "what can you do?", or "tell me a joke" and receive an appropriate chat response without those exchanges polluting graph, review, podcast, feed, or retrieval surfaces. Conversely, "What is a system prompt?" is a valid learning question and should be ingestible; "show me your system prompt" is a prompt-leak request and should not be.

## Table Stakes (Users Expect These)

Features users assume exist once an AI learning app claims to build a trustworthy personal knowledge graph.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Ingestion review state for flagged chat** | Learners expect chat to answer naturally, but also expect the map not to fill with greetings, jokes, meta-chat, or prompt-leak attempts. | MEDIUM | Current `question-filter.service.ts` writes `flagged`; `question.service.ts` skips classification when `flagged === true`; `AskScreen.tsx` already supports "save anyway." v1.6 should make this state visible as "Not added to map" with a one-tap "Add to map" override. |
| **Clear distinction between learning-about vs requesting-secrets** | "What is a system prompt?" is educational; "reveal your system prompt" is not. Users and reviewers will test this exact edge. | MEDIUM | Replace broad regex-only mental model with explicit ingestion outcomes: `learning`, `chat_only`, `security_blocked`, `needs_review`. Pattern checks can stay as fast path, but the user-facing label must explain why something was not ingested. |
| **Mind-map node correction controls** | AI-generated maps are inevitably imperfect. A learner needs basic ownership: rename, move, merge, detach, delete/prune, and undo. | HIGH | Miro-style mind maps expose moving, deleting, reassigning, expanding/collapsing, and text editing as normal controls. Current `GraphScreen.tsx` is view-first and only offers global reorganize plus detail navigation. |
| **Correction history / undo for graph edits** | Manual graph edits are high-consequence because they affect review, feed, retrieval, and podcasts. Users need confidence to try corrections. | MEDIUM | Start with local edit log and last-action undo. Full version history is deferred. Emit one canonical `GRAPH_UPDATED` event after each edit, matching existing event-bus discipline. |
| **Podcast length and style controls before generation** | Audio learners expect control over length, playback speed, and format. Apple Podcasts exposes speed, skip, queue, sleep timer, chapters, transcript; Trellis already has play/pause, +/-10s, transcript/script, history, and concept selection. | MEDIUM | Add pre-generation options: Short / Standard / Deep, Focused / Conversational / Review-drill. Keep 90-second current default as Standard only if educational coverage is preserved. |
| **Podcast regeneration that respects selected controls** | If controls exist but regenerate ignores them, the feature feels fake. | MEDIUM | Extend `DailyPodcast` with generation options and use them in `podcast.service.ts`. Regenerate should invalidate script/audio and preserve chosen concept set. |
| **Unified retrieval search across archive and knowledge** | After feed discovery, users expect to find things again by concept, title, source, tag, and history. Existing `SavedScreen.tsx` has Saved / Liked / History; `questionService.search` is content-only and not exposed as a unified retrieval experience. | MEDIUM | Add search to the archive first, then concept-level dashboards. Use local indexes over posts/questions. No backend needed. |
| **User tags/bookmarks for posts and concepts** | Saved/liked is not enough once the archive grows. Learners need lightweight categorization such as `exam`, `paper`, `confusing`, `listen later`. | MEDIUM | Tags should attach to both `DailyPost` snapshots and `Question`/anchor IDs. Keep them local. Support nested tags later, but v1.6 can ship flat tags. |
| **Concept dashboard for each anchor** | Learners expect a concept page to answer: what have I asked, what posts did I read, what is due, what podcast covered it, what is weak? | HIGH | Builds on `AnchorDetailScreen`/graph detail pattern. This is the core retrieval surface for professor feedback. |
| **Learning-goal and stop cues** | A learning feed should say when enough was done and route to recall/review, not just continue serving content. | MEDIUM | Digital Promise recommends learner agency, reflection, data reporting, and customizable prompt frequency. v1.6 should add goal, progress, and stop states without punitive streak mechanics. |
| **Reflection/retrieval prompts after engagement** | Reading should convert into recall. Retrieval practice evidence is strong; users expect learning apps to help them remember, not just consume. | MEDIUM | After reading/saving/liking several posts, prompt: "What do you remember?" or "Make this a card?" Do not interrupt every post. |

## Differentiators (Competitive Advantage)

These features should make Trellis feel distinct from a generic chatbot, podcast generator, or social feed.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Two-lane chat outcome: answered vs ingested** | Preserves natural conversation while protecting graph quality. The learner sees that "answered" and "learned into my map" are different states. | MEDIUM | Best user-facing model: every AI response may show a small status chip: `Added to map`, `Chat only`, `Needs review`, or `Not saved`. Avoid modal friction during normal ask flow. |
| **Graph correction as learning, not admin** | Renaming/merging/moving nodes forces learners to articulate structure. That is valuable metacognition, not just cleanup. | HIGH | Add brief "why placed here" text already available via `placementReason`, then let the learner accept/correct. Use correction events to improve future placement locally. |
| **AI-suggested corrections with learner approval** | The current Reorganize button is global and opaque. A better v1.6 experience suggests "These two anchors may be duplicates" or "This Q&A may belong under X" and waits for learner approval. | HIGH | Start with suggestions generated from embeddings/current labels. Never auto-merge without confirmation. |
| **Retrieval dashboard that joins graph + feed + review + podcast** | Competitors often separate notes, flashcards, podcasts, and feeds. Trellis can make a concept the durable unit across all surfaces. | HIGH | Anchor dashboard should list: summary, Q&As, posts, saved/liked/history items, review cards, podcast mentions, tags, weak/confident indicators. |
| **Podcast as adaptive review session** | Most podcast controls optimize listening convenience. Trellis can optimize for learning: "quiz me between segments", "focus weak concepts", "include today's saved items". | HIGH | Add after basic length/style controls. Use SM-2 due list and concept selection. Keep script transcript editable/visible. |
| **Ethical engagement metrics visible to learner** | Instead of "you scrolled 20 posts," show "3 concepts recalled", "2 weak concepts practiced", "1 node corrected", "time to stop or review". | MEDIUM | Replace vanity engagement with learning-oriented success metrics. This directly addresses professor concern about social-feed engagement. |
| **Local-first trust labels** | Users can see why content appears: due for review, weak area, saved topic, connected anchor, or user-added tag. | MEDIUM | "Why this?" labels should be short and deterministic from local state. Do not imply server/social ranking. |
| **Quarantine inbox for ambiguous ingestion** | Prevents silent false positives/false negatives in filtering. Ambiguous exchanges live in an inbox where the learner can add, discard, or retitle them. | MEDIUM | Useful for legitimate borderline cases such as "system prompt" as a concept, self-referential AI literacy questions, or incomplete follow-ups. |

## Anti-Features (Commonly Requested, Often Problematic)

Features that seem attractive but would undermine the v1.6 goals.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Blocking off-topic chat at presentation time** | It seems cleaner to refuse small talk or meta-chat. | This misreads the requirement. The issue is graph pollution, not chat response. Blocking harmless chat makes the assistant feel brittle and does not solve durable storage quality. | Answer normally when safe; mark as `Chat only` and exclude from graph/review/feed/podcast. |
| **Regex-only ingestion filter** | Fast, simple, already exists. | Current patterns are too broad for professor-tested examples. They can confuse learning-about-system-prompts with prompt leakage. Regex also cannot reliably handle context-dependent follow-ups. | Keep regex as a fast signal, but add explicit outcome taxonomy and LLM fallback for ambiguous cases. |
| **Auto-delete flagged exchanges from chat** | Keeps history clean. | Hides the distinction between "not ingested" and "not answered"; removes learner agency; breaks auditability. | Keep in chat history with `Chat only` status; offer delete separately. |
| **Global one-click mind-map reorganize as the main correction feature** | Easy to expose and already exists. | Opaque global reorganization can overwrite learner intent and does not teach the user how the map is structured. | Keep as advanced maintenance; prioritize local corrections: rename, move, merge, detach, prune, undo. |
| **Auto-merge nodes without confirmation** | Reduces clutter quickly. | Wrong merges are costly and hard to notice; they contaminate review schedules, podcasts, retrieval, and source prompts. | Suggest merge candidates with preview and undo. Require learner confirmation. |
| **Presentation filters on graph view to hide bad nodes** | Makes the map look clean quickly. | It leaves polluted data in the underlying graph, so review/podcast/retrieval still inherit the problem. | Fix at ingestion and correction data layer. Graph view filters can exist for navigation, not data hygiene. |
| **Podcast controls that only change word count** | Simple implementation. | Learners asked for control over podcast quality, not just duration. A short podcast that drops weak concepts is worse than no control. | Length controls should change pacing/depth while preserving required concepts or explaining what was omitted. |
| **Entertainment-style podcast personas** | "Make it fun" is appealing. | Over-personalized personas can distract, anthropomorphize, or reduce learning density. | Use restrained styles: Focused, Conversational, Review-drill. Avoid celebrity/character roleplay. |
| **Public likes, leaderboards, streak pressure** | Familiar engagement mechanics. | Conflicts with local-first privacy and professor concern about social-feed dynamics. Can reward app opens instead of recall. | Private learning metrics: recall attempts, weak concepts practiced, concepts corrected, goal completed. |
| **Infinite scroll as primary success metric** | Easy to measure. | Optimizes consumption, not learning. | Use stop cues and route to review/reflection after a goal is met. |
| **Server-side sync/social graph for v1.6 retrieval** | Would enable cross-device search and social proof. | Contradicts current local-first milestone scope and creates privacy/security requirements. | Use localStorage/SQLite indexes. Defer sync as a separate milestone with explicit privacy design. |

## Feature Dependencies

```text
[Ingestion outcome taxonomy]
    └──requires──> [Question flagged/chat-only persistence]
    └──unblocks──> [Graph pollution prevention]
    └──unblocks──> [Quarantine inbox]
    └──unblocks──> [Accurate retrieval index]
    └──unblocks──> [Podcast concept selection]

[Security/prompt-leak classification]
    └──requires──> [Ingestion outcome taxonomy]
    └──enhances──> [Chat status labels]
    └──conflicts──> [Regex-only filter]

[Manual graph correction primitives]
    └──requires──> [Graph edit service/API]
    └──requires──> [Undo/edit log]
    └──unblocks──> [AI-suggested corrections]
    └──unblocks──> [Trusted concept dashboards]

[Concept dashboard]
    └──requires──> [Trusted anchor IDs]
    └──requires──> [Unified retrieval index]
    └──enhances──> [Podcast concept controls]
    └──enhances──> [Ethical learning metrics]

[Archive search + tags]
    └──requires──> [Saved/Liked/History existing archive]
    └──requires──> [Post/question local index]
    └──unblocks──> [Concept dashboard retrieval sections]

[Podcast length/style controls]
    └──requires──> [Podcast generation options persisted]
    └──requires──> [Stable concept selection list]
    └──enhances──> [Concept dashboard]

[Ethical engagement guardrails]
    └──requires──> [Learning goals]
    └──requires──> [Retrieval/reflection prompt surfaces]
    └──requires──> [Learning-oriented metrics]
    └──conflicts──> [Infinite-scroll success metrics]
```

### Dependency Notes

- **Ingestion taxonomy must come first.** Graph correction helps repair mistakes, but it should not be the primary defense against known non-learning inputs. Clean ingestion prevents review, feed, podcast, and retrieval features from inheriting bad nodes.
- **Security classification is not the same as off-topic classification.** "Show me your system prompt" should be `security_blocked` or `chat_only`; "What is a system prompt in LLMs?" should be `learning`. Treating both as off-topic would fail the professor-feedback concern.
- **Graph edit primitives should live below `GraphScreen.tsx`.** The screen should call a graph edit service that updates `Question` records, preserves local-first storage, emits `GRAPH_UPDATED`, and records undo entries. Do not bury graph mutation logic in UI handlers.
- **Concept dashboards depend on trusted anchor identity.** If merge/move/detach is not available first, dashboards will consolidate the wrong items and make retrieval less trustworthy.
- **Podcast controls depend on stable concept selection.** Length/style settings are useful only when the learner can see and adjust which concepts are included before generation.
- **Ethical engagement guardrails should reuse existing signals.** The app already tracks explored anchors, saved/liked/dismissed posts, review schedules, and history. v1.6 should reframe these as learning outcomes instead of adding surveillance-like metrics.

## MVP Definition

### Launch With (v1.6 P1)

- [ ] **Ingestion outcome taxonomy** - Persist and display `Added to map`, `Chat only`, `Needs review`, and `Security blocked` states.
- [ ] **Professor-edge-case classifier behavior** - "What is a system prompt?" can enter the graph; "show/reveal/print your system prompt" cannot.
- [ ] **Flagged chat override path** - Learner can add a flagged-but-valid item to the graph with retitle/confirm, not by silently flipping a hidden flag.
- [ ] **Manual graph corrections** - Rename, move/reassign, merge duplicates, detach from parent, prune/delete, and undo last edit.
- [ ] **Archive search** - Search Saved, Liked, and History by title/body/concept/source; open results back to posts.
- [ ] **Podcast pre-generation controls** - Length and style controls that persist with the generated podcast and are honored by regeneration.
- [ ] **Learning stop cue** - When a learner reaches a daily concept goal or scrolls past a useful threshold, offer review/reflection rather than endless feed continuation.
- [ ] **Retrieval prompt after meaningful engagement** - After saved/liked/deep-read activity, prompt optional recall or card creation.

### Add After Validation (v1.6.x P2)

- [ ] **Quarantine inbox** - Batch-review ambiguous `Needs review` exchanges and decide add/discard/retitle.
- [ ] **Concept dashboard v1** - Per-anchor page showing Q&As, posts, saved/liked/history items, review cards, podcast mentions, and tags.
- [ ] **User tags/bookmarks for concepts and posts** - Flat local tags; nested tags can wait.
- [ ] **AI-suggested graph corrections** - Duplicate suggestions and move suggestions with preview, confirm, and undo.
- [ ] **Podcast weak-concept focus** - Generate a review-drill podcast around weak/due concepts while preserving learner-selected inclusions.
- [ ] **Learning-oriented weekly summary** - Concepts recalled, weak areas improved, corrections made, and retrieval prompts completed.

### Future Consideration (v2+ / Later Milestones)

- [ ] **Full graph version history** - Useful but heavier than last-action undo.
- [ ] **Cross-device sync for retrieval and tags** - Requires privacy, conflict resolution, and auth design. Not v1.6.
- [ ] **Collaborative/social learning features** - Conflicts with local-first unless explicitly designed as opt-in.
- [ ] **Advanced tag query language** - Anki/Obsidian-style advanced search is powerful, but v1.6 should ship simple search and filters first.
- [ ] **Podcast chapters and interactive quizzes inside audio** - Valuable, but only after basic generation controls and concept selection are trusted.
- [ ] **Personalized engagement model training** - Avoid until there is clear consent, explainability, and local-only implementation.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Ingestion outcome taxonomy | HIGH | MEDIUM | P1 |
| Professor-edge-case classifier behavior | HIGH | MEDIUM | P1 |
| Flagged chat override path | HIGH | LOW-MEDIUM | P1 |
| Manual graph rename/move/merge/detach/prune | HIGH | HIGH | P1 |
| Graph edit undo | HIGH | MEDIUM | P1 |
| Archive search | HIGH | MEDIUM | P1 |
| Podcast length/style controls | HIGH | MEDIUM | P1 |
| Learning stop cue | HIGH | MEDIUM | P1 |
| Retrieval/reflection prompt | HIGH | MEDIUM | P1 |
| Quarantine inbox | MEDIUM | MEDIUM | P2 |
| Concept dashboard | HIGH | HIGH | P2 |
| Tags/bookmarks for concepts/posts | MEDIUM | MEDIUM | P2 |
| AI-suggested graph corrections | MEDIUM-HIGH | HIGH | P2 |
| Podcast weak-concept focus | MEDIUM-HIGH | HIGH | P2 |
| Learning-oriented weekly summary | MEDIUM | MEDIUM | P2 |
| Full graph version history | MEDIUM | HIGH | P3 |
| Cross-device retrieval sync | HIGH | HIGH | P3 |
| Collaborative/social signals | LOW-MEDIUM | HIGH | P3 |
| Advanced query language | MEDIUM | HIGH | P3 |
| Interactive podcast quizzes/chapters | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.6 requirements to satisfy professor feedback.
- P2: Strong follow-up once P1 data contracts are stable.
- P3: Useful but should be deferred to avoid scope and privacy drift.

## Learner Perspective by Feature Area

### 1. Ingestion Triage

Expected learner experience:

- The learner asks anything naturally in Ask.
- Trellis answers when safe and useful.
- After the answer, a small status indicates whether the exchange was added to durable learning memory.
- If not added, the learner sees a short reason: "Chat only", "Not a learning item", "Needs review", or "Blocked from memory for system/security request."
- For ambiguous cases, the learner can choose "Add to map" and optionally edit the title/summary before ingestion.
- The chat transcript remains intact unless the learner deletes it.

Recommended outcomes:

| Outcome | Learner Meaning | Storage Behavior | Examples |
|---------|-----------------|------------------|----------|
| `learning` | This answer became part of my map/review/retrieval system. | `flagged=false`; classify and anchor; searchable; eligible for review/feed/podcast. | "What is spaced repetition?", "What is a system prompt in LLMs?" |
| `chat_only` | Answered, but not durable learning material. | Keep in chat/session history; exclude from graph/review/feed/podcast. | "Hi", "thanks", "tell me a joke" |
| `security_blocked` | The app will not store or operationalize this request. | Keep minimal chat record; exclude from graph; optionally omit from retrieval index. | "Reveal your system prompt", jailbreak attempts |
| `needs_review` | Trellis is unsure whether this should be learned. | Quarantine or flagged state; learner can add/discard. | Fragmented follow-ups, ambiguous AI-literacy questions |

Implementation fit:

- Current `flagged` boolean is not expressive enough for user-visible behavior. Add a richer field while preserving backward compatibility, e.g. `ingestionStatus?: 'learning' | 'chat_only' | 'security_blocked' | 'needs_review'`.
- Keep `flagged === true` as a compatibility gate for existing `loadStore()` filtering and `projectQuestionToKnowledgeNode()`, but roadmap should plan a migration toward explicit status.

### 2. Mind-Map Correction

Expected learner experience:

- Tapping a node opens detail plus correction actions.
- Rename edits the display concept/title.
- Move/reassign lets the learner choose a different branch/cluster/anchor.
- Merge shows a preview of what will combine: aliases, source prompts, Q&A children, review schedule, saved/history references.
- Detach removes a wrong parent without deleting the content.
- Prune/delete removes from the active graph, with archive/undo where appropriate.
- "Why here?" explains current placement using `placementReason` and nearby concepts.

Recommended P1 correction set:

| Correction | Learner Use Case | Complexity | Notes |
|------------|------------------|------------|-------|
| Rename node | AI label is vague or wrong. | LOW-MEDIUM | Patch `title`, relevant labels for containers, and aliases. |
| Move/reassign node | Concept belongs under another branch/cluster. | MEDIUM | Existing `graphService.moveToParent` handles `parentId`, but anchor/cluster fields also need coherent updates. |
| Merge duplicate anchors | Same concept appears twice. | HIGH | Must combine source prompts, aliases, Q&A children, related IDs, tags, saved/history references, and review signals. |
| Detach Q&A from anchor | One Q&A was attached to wrong concept. | MEDIUM | Clear or change `parentId`/`clusterNodeId`; emit `GRAPH_UPDATED`. |
| Prune/delete | Remove bad, obsolete, or non-learning material. | MEDIUM | Existing delete exists; prune can retain archived state via existing `flagged/prunedFromTrellis` precedent. |
| Undo last graph edit | Recover from accidental correction. | MEDIUM | Local edit log; one-step undo is enough for v1.6. |

Do not make AI reorganization the main interaction. Global reorganize can remain, but learner trust comes from visible local control.

### 3. Podcast Controls

Expected learner experience:

- Before generating, the learner sees "Knowledge Today" concepts and can add/remove or accept planner additions.
- The learner chooses length and style.
- Trellis communicates tradeoffs: shorter means fewer examples, not skipped required concepts unless the learner confirms.
- Regenerate uses the same options or lets the learner adjust them.
- Player keeps table-stakes controls: play/pause, skip, transcript/script, history, delete. Add speed/sleep timer later if needed.

Recommended controls:

| Control | Options | Complexity | Notes |
|---------|---------|------------|-------|
| Length | Short, Standard, Deep | MEDIUM | Map to target script duration and required concept count. |
| Style | Focused, Conversational, Review-drill | MEDIUM | Avoid entertainment personas. |
| Concept inclusion | Due, weak, saved, manually added | MEDIUM-HIGH | Builds on current `todayConcepts` and planner insertion. |
| Regenerate with options | Same options or edit before regenerate | MEDIUM | Persist options on `DailyPodcast`. |
| Playback speed | 0.8x, 1x, 1.25x, 1.5x, 2x | LOW-MEDIUM | Table-stakes in podcast apps, but can follow generation controls. |

P1 should focus on generation controls, not building a full podcast app clone.

### 4. Retrieval

Expected learner experience:

- The archive is not just a graveyard. It is searchable and filterable.
- Search results can include saved posts, liked posts, history, Q&As, anchors, and podcast scripts.
- A concept dashboard gives a stable home for everything related to a concept.
- Tags and bookmarks let the learner impose personal meaning beyond AI-generated categories.
- Search explains where a result came from: Saved, Liked, History, Graph, Review, Podcast.

Recommended retrieval layers:

| Layer | What It Solves | Complexity | Priority |
|-------|----------------|------------|----------|
| Archive search | "I remember seeing a post about X." | MEDIUM | P1 |
| Source/type filters | Narrow by saved/liked/history/post/question/podcast. | LOW-MEDIUM | P1 |
| Concept dashboard | "Show me everything about this concept." | HIGH | P2 |
| Flat tags | "Mark this as exam/paper/confusing." | MEDIUM | P2 |
| Podcast transcript search | "Find where this was covered in audio." | MEDIUM | P2 |
| Advanced query syntax | Power-user filtering. | HIGH | P3 |

Implementation fit:

- `SavedScreen.tsx` is the right entry point for P1 archive search because it already consolidates Saved, Liked, and History.
- `questionService.search()` exists but only searches question content and answer. It should not become the only retrieval layer; add a retrieval service that can aggregate posts/questions/podcasts and return typed results.
- Anki and Obsidian norms support search plus tags/filters as expected retrieval capabilities, but Trellis should keep the first version simple and mobile-friendly.

### 5. Ethical Engagement

Expected learner experience:

- The app helps the learner decide what to do next, including stopping.
- Success metrics are about learning: recall, review, correction, concept coverage, weak-area progress.
- Likes/saves remain private personal signals.
- Dismiss is respected without treating it as "failure."
- Reflection prompts are adjustable, not nagging.

Recommended guardrails:

| Guardrail | Learner Benefit | Complexity | Notes |
|-----------|-----------------|------------|-------|
| Daily learning goal | Clarifies "enough for today." | MEDIUM | Goal can be concepts explored/recalled, not time-on-app. |
| Stop cue after goal | Prevents endless feed dynamic. | MEDIUM | Offer Review, Reflect, Podcast, or Close. |
| Retrieval prompt after engagement | Converts consumption into memory. | MEDIUM | Prompt after meaningful clusters of activity, not every post. |
| Private metrics only | Protects privacy and reduces social pressure. | LOW | Do not add public counts. |
| "Why this?" label | Preserves agency and explainability. | MEDIUM | Use local reasons: due, weak, saved, connected, planner. |
| Prompt frequency control | Avoids annoyance. | MEDIUM | User can reduce/disable reflection nudges. |

Ethical engagement should be framed as learner agency, not paternalistic blocking. The app should make the next learning action obvious and make stopping feel complete.

## Competitor / Ecosystem Feature Analysis

| Feature | Ecosystem Pattern | Our Approach |
|---------|-------------------|--------------|
| Mind-map correction | Miro supports moving/reassigning, editing, deleting, layout, and expand/collapse as normal mind-map controls. | Add local correction controls directly to Graph/anchor detail. Keep AI reorganize as secondary. |
| Retrieval search/tags | Anki supports search across notes/cards plus tag/deck filters; Obsidian graph supports filtering, tags, groups, and display controls. | Unified local search across archive + graph + podcast, with simple filters first. Flat tags in v1.6.x. |
| Podcast controls | Apple Podcasts exposes playback speed, skip, queue, sleep timer, transcript, and chapters. | P1 generation controls for educational length/style; playback speed can be P2 because current player already has basic controls. |
| Retrieval practice | CMU Eberly Center summarizes robust evidence that retrieval practice supports learning beyond rereading. | Add recall/reflection prompts after engagement and route stop cues toward review. |
| Learner agency and reflection | Digital Promise recommends learner choice over adaptive AI supports, opt-out, reflection opportunities, learner-facing data, and control over feedback prompt frequency. | Make goals, stop cues, reflection prompts, and "why this?" labels configurable and local-first. |
| Prompt/security handling | OWASP and OpenAI highlight prompt injection/system leakage as active LLM app risks and recommend limiting consequences rather than assuming perfect detection. | Separate security-blocked and chat-only outcomes from learning ingestion. Never let prompt-leak attempts become durable knowledge nodes. |

## Sources

Project sources:

- `.planning/PROJECT.md` - v1.6 milestone goal and professor-feedback context.
- `.planning/MILESTONES.md` - prior shipped v1.5 archive and current milestone sequencing context.
- `app/src/services/question-filter.service.ts` - current pattern + LLM fallback filter.
- `app/src/services/question.service.ts` - current `flagged` persistence, classification skip, search, patch/delete APIs.
- `app/src/screens/AskScreen.tsx` - current flagged override path and chat persistence behavior.
- `app/src/screens/GraphScreen.tsx` - current view-first graph UI and global reorganization affordance.
- `app/src/services/graph.service.ts` - current graph move/link/delete-adjacent mutation primitives.
- `app/src/services/podcast.service.ts` and `app/src/screens/PodcastScreen.tsx` - current daily podcast generation, concept list, insertion, playback, transcript, and history.
- `app/src/screens/SavedScreen.tsx` - current Saved/Liked/History archive entry point.
- `app/src/services/engagement.service.ts` - current local-only saved/liked/dismissed state and event semantics.

External sources:

- Carnegie Mellon Eberly Center, [Retrieval Practice for Improved Learning](https://www.cmu.edu/teaching/resources/instructionalstrategies/activelearningstrategies/retrievalpractice/index.html) - HIGH confidence for retrieval-practice rationale.
- Digital Promise, [A Framework for Powerful Learning with Emerging Technology](https://digitalpromise.org/wp-content/uploads/2024/04/A-Framework-for-Powerful-Learning-with-Emerging-Technology.pdf) - HIGH confidence for agency, opt-out, reflection, learner-facing data, and prompt-frequency guidance.
- Miro Help Center, [Mind map](https://help.miro.com/hc/en-us/articles/360017730753-Mind-map) - MEDIUM confidence for current mind-map control expectations.
- Apple Support, [Watch and listen to podcasts on iPhone](https://support.apple.com/en-nz/guide/iphone/iph3a22707a5/26/ios/26) - HIGH confidence for podcast player control norms.
- Anki Manual, [Searching](https://docs.ankiweb.net/searching.html) - HIGH confidence for retrieval search/tag expectations in spaced-repetition tools.
- Obsidian Help, [Graph view](https://obsidian.md/help/plugins/graph) - MEDIUM confidence for graph filtering/display expectations.
- OWASP, [Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) - HIGH confidence that prompt injection/system leakage are recognized LLM-app risks.
- OpenAI, [Designing AI agents to resist prompt injection](https://openai.com/index/designing-agents-to-resist-prompt-injection/) - HIGH confidence for treating detection as imperfect and limiting consequences.

---
*Feature research for: Trellis v1.6 learner control, graph trust, retrieval, podcast controls, and ethical engagement*
*Researched: 2026-05-13*
