## 1. Introduce canonical knowledge-node foundations

- [x] 1.1 Add canonical knowledge-node types and storage adapters that can project existing question data into node-shaped records without breaking current local data
- [x] 1.2 Extend stored knowledge metadata to support aliases/provenance, canonical review schedule, and structural placement fields needed by graph and review flows
- [x] 1.3 Add compatibility helpers so existing graph, ask, and feed code can read canonical-node projections during migration

## 2. Build hierarchical retrieval and duplicate-aware ingestion

- [x] 2.1 Add retrieval-layer metadata for roots, branches, clusters, and candidate leaves, including persisted summaries and representative keywords
- [x] 2.2 Implement cheap candidate narrowing using normalized text, keyword overlap, structural locality, and embeddings when available
- [x] 2.3 Update ask ingestion to route through bounded branch/cluster/leaf context before deciding merge, refinement, or new-node outcomes
- [x] 2.4 Preserve new ask provenance and alias data when a duplicate or refinement outcome reuses an existing canonical node

## 3. Switch review scheduling to canonical nodes

- [x] 3.1 Refactor review scheduling so due-date calculation and memory-state updates live on canonical knowledge nodes rather than standalone flashcard objects
- [x] 3.2 Derive review flashcard prompts from due canonical nodes while preserving the current active-recall interaction model
- [x] 3.3 Add a daily due-node selector that can reconstruct the day’s review slice from canonical node review metadata and graph relationships

## 4. Add the synchronized mini review map

- [x] 4.1 Design a mobile review-map projection that includes due nodes, parent anchors, and limited nearby context without rendering the whole graph
- [x] 4.2 Update the Review screen so the mini map appears beneath flashcards and grows as the user progresses through the session
- [x] 4.3 Keep flashcard progress, node reveal state, and review-map updates synchronized within a single daily review session

## 5. Shift co-creation toward learning-driven signals

- [x] 5.1 Add lightweight structural feedback points in review or adjacent flows for future “same idea”, “connect”, or refinement-style corrections without requiring full graph editing
- [x] 5.2 Reframe the Graph page as a reflection and repair surface that reads canonical node state rather than the primary co-creation workflow
- [x] 5.3 Surface enough placement/review-map context in product copy or UI state so users can understand how their actions are shaping the mindmap

## 6. Verify migration and product behavior

- [x] 6.1 Verify duplicate asks no longer create uncontrolled duplicate graph nodes when the system can merge or refine them
- [x] 6.2 Verify large-graph ingestion uses bounded hierarchical retrieval context instead of whole-graph LLM reads
- [x] 6.3 Verify daily review flashcards and the mini review map come from the same due-node source and stay synchronized through rating updates
- [x] 6.4 Add or update targeted tests for canonical-node projection, duplicate/refinement decisions, daily due-node selection, and review-map session growth
