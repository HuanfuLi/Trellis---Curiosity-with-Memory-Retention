## Why

EchoLearn currently stores questions, flashcards, and graph structure as overlapping but separate representations, which leads to duplicate knowledge nodes, fragmented review state, and a Graph page that feels more like manual cleanup than genuine co-creation. The product now needs one canonical knowledge system so ingestion, review, and feed generation all operate on the same mindmap and let the user's learning behavior visibly shape it.

## What Changes

- Introduce a canonical knowledge-node model so the mindmap becomes the shared source of truth for stored knowledge, review metadata, and downstream learning surfaces.
- Add duplicate-aware ingestion that retrieves likely branches and candidate nodes before persistence, then decides whether a new ask should merge into an existing node, attach as a refinement, or create a new node.
- Add a hierarchical retrieval/index layer over the graph so LLM decisions can route through roots, branches, and clusters instead of reading the entire mindmap.
- Generate a daily review subset from due knowledge nodes and project it into both flashcard review and a mini review mindmap.
- Update the review experience so the mini map grows alongside flashcards during a session, making review a visible co-creation loop rather than a separate graph-editing task.
- Treat flashcards, review sessions, and curiosity surfaces as projections of canonical knowledge nodes rather than independent memory objects.

## Capabilities

### New Capabilities
- `canonical-knowledge-graph`: Define canonical knowledge nodes, hierarchical graph indexing, and duplicate-aware ingestion that can merge, refine, or create nodes without reading the full graph every time.
- `review-map`: Define daily due-node selection and a combined review experience where flashcards and a growing mini mindmap stay synchronized from the same knowledge source.

### Modified Capabilities

## Impact

- Affected product surfaces: Ask ingestion flow, Review screen, Graph page role, and any feed or recommendation flows that currently rely on standalone question/flashcard objects.
- Affected code areas: `app/src/services/question.service.ts`, `app/src/services/graph.service.ts`, `app/src/services/flashcard.service.ts`, `app/src/services/review.service.ts`, review UI screens/components, and type definitions for knowledge, review, and session state.
- Affected data model: review scheduling, node identity, duplicate handling, and graph structure move toward one shared canonical representation.
- Affected AI pipeline: LLM prompts for ingestion and downstream content generation will need retrieval-aware branch/node context instead of whole-graph or recent-only context.
