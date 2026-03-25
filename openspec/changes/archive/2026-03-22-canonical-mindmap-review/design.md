## Context

EchoLearn currently stores user asks as `Question` records, derives flashcards as separate memory objects, and maintains graph relationships as lightweight links and optional parent pointers. That split makes the system easy to prototype but causes three product problems: duplicate asks create duplicate graph nodes, review scheduling lives separately from graph structure, and the current Graph page asks users to manually organize AI-created nodes in a way that feels like cleanup instead of co-creation.

This change introduces a more central architectural pattern: canonical knowledge nodes become the primary representation of learned concepts, while flashcards, daily review maps, and feed items become projections of those nodes. The design must stay local-first, avoid full-graph LLM reads as the knowledge base grows, and support a phone-first review flow where the mini map evolves naturally beneath flashcards.

## Goals / Non-Goals

**Goals:**
- Establish one canonical knowledge representation that can drive graph structure, review scheduling, and downstream projections.
- Add a hierarchical retrieval/index strategy so ingestion can route through roots, branches, clusters, and candidate leaves before asking the LLM to merge, refine, or create.
- Replace the current independent flashcard-only review queue with a daily due-node set that can drive both flashcard prompts and a mini review map.
- Make review feel like co-creation by revealing the due-node structure as the user progresses through flashcards.
- Preserve the Graph page as a reflection and repair surface rather than the primary place users build structure.

**Non-Goals:**
- Full manual graph-editing redesign in this change.
- Perfect unsupervised ontology generation across all subjects.
- A global whole-graph LLM reasoning step for every ask.
- Replacing post/feed generation in this change beyond switching it to canonical node inputs later.

## Decisions

### Decision: Canonical knowledge nodes replace split question/flashcard authority
The system will treat a canonical knowledge node as the shared source of truth for concept identity, structure, and memory state. Raw asks remain important as provenance, but review schedule, branch placement, aliases, and merge decisions belong to the node layer instead of separate flashcard objects.

Why:
- Duplicate and refinement handling require one concept identity, not many parallel records.
- Daily review maps and flashcards must stay synchronized to feel like one learning loop.
- Feed and post generation can later consume the same canonical nodes instead of question-only heuristics.

Alternative considered:
- Keep questions canonical and let flashcards mirror them. Rejected because repeated asks about the same concept would still create unstable node identity and fragmented review state.

### Decision: Use layered retrieval rather than whole-graph LLM reads
The graph will expose retrieval layers: roots, branches, clusters, and leaves. Cheap retrieval will narrow candidates using normalized text, keyword indexes, structural locality, and embeddings when available. The LLM will only see branch summaries, cluster summaries, and a bounded candidate set of leaf nodes before deciding whether the new ask is a duplicate, a refinement/child, or a new node.

Why:
- Whole-graph reads will become too expensive and too noisy as the graph grows.
- Duplicate detection needs fast candidate narrowing before semantic judgment.
- The same hierarchy can support daily review slicing and future navigation.

Alternative considered:
- Rely only on vector similarity over all leaves. Rejected because it does not give enough branch-level structure, is harder to explain to users, and does not support review-oriented summaries on its own.

### Decision: Branches and clusters have stored summaries
Each root/branch/cluster layer will store a concise summary, representative keywords, and representative node ids. These summaries become the primary semantic routing material for the LLM during ingestion and for lightweight review/context rendering later.

Why:
- LLMs need compressed semantic views, not raw leaves only.
- Summaries make routing cheaper and give the system human-readable structure.
- The same summaries can power UI explanations like “this was placed under Forgetting.”

Alternative considered:
- Derive summaries on the fly every time. Rejected because it shifts cost into critical flows and produces unstable routing descriptions.

### Decision: Daily review is driven by due knowledge nodes and projected into two surfaces
The review engine will build a daily due-node set from canonical node review metadata. From that set it will produce:
- flashcard prompts for active recall
- a daily mini review map made of due nodes, parent anchors, and limited nearby context

During a session, the flashcard surface and mini map stay synchronized. The map starts empty or nearly empty, then reveals nodes as cards are encountered to make progress feel like building today’s knowledge territory.

Why:
- This combines retrieval practice with structural reinforcement.
- It turns review into visible co-creation instead of a disconnected card queue.
- It keeps the lower half of the mobile review screen meaningful rather than decorative.

Alternative considered:
- Keep flashcards as the true review engine and add a decorative map beside them. Rejected because the map would feel fake if it does not come from the same due-node source of truth.

### Decision: Co-creation is expressed through lightweight structural signals
The system will treat user behavior as graph-shaping input. Review ratings, follow-up asks, “same idea” confirmations, connect/refine actions, and later correction gestures will update node memory state and graph structure. Manual graph editing remains available as a secondary repair tool, not the primary creation loop.

Why:
- Users want to learn, not act as librarians.
- The current manual bucket-sorting flow feels like repairing AI output rather than shaping one’s own knowledge.
- Lightweight structural feedback creates visible impact without high-friction graph editing.

Alternative considered:
- Preserve drag-first graph authoring as the main co-creation pattern. Rejected because it asks for too much explicit taxonomy work and weakens the sense of authentic contribution.

## Risks / Trade-offs

- [Canonical-node migration is larger than a prompt tweak] → Mitigation: phase the work by introducing node-backed review and ingestion first, while keeping compatibility shims for existing question and flashcard data.
- [Over-aggressive duplicate merging can erase nuance] → Mitigation: include a distinct “refinement/child” outcome, preserve aliases/source asks, and keep merge operations explainable and reversible.
- [Hierarchy summaries can drift from underlying nodes] → Mitigation: regenerate or mark dirty affected root/branch/cluster summaries whenever node placement or merge state changes.
- [Mini review maps can become visually noisy on mobile] → Mitigation: keep the daily map selective by showing due nodes, anchor parents, and at most limited nearby context.
- [One canonical model may slow near-term feature work] → Mitigation: use projections and adapters so existing feed/review surfaces can transition incrementally rather than rewrite every screen at once.

## Migration Plan

1. Introduce canonical node structures and adapters that can derive them from existing stored questions.
2. Add retrieval-layer metadata and candidate selection without yet changing every downstream screen.
3. Route new asks through duplicate-aware ingestion so newly created knowledge starts using the new model.
4. Switch review scheduling to due nodes and derive flashcard prompts from canonical nodes.
5. Add the daily mini review map to the review flow and de-emphasize manual graph organization as the primary co-creation path.
6. Migrate feed/post inputs to canonical nodes in a later follow-up once the node model is stable.

Rollback strategy:
- Keep legacy question and flashcard data intact during migration so review and ask flows can temporarily fall back to existing behavior if canonical-node projection fails.

## Open Questions

- Should the canonical node represent a single user ask, or a synthesized concept with multiple source asks attached as aliases/provenance?
- Should the daily mini map initially reveal only reviewed-so-far nodes, or show the full due set with unseen nodes dimmed?
- What is the minimum set of lightweight structural actions needed in review before the UI becomes cluttered?
- How aggressively should branch and cluster creation be automated versus stabilized by a smaller set of user-confirmed top-level roots?
