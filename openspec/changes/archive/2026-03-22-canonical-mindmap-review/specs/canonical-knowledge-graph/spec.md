## ADDED Requirements

### Requirement: Canonical knowledge nodes SHALL be the shared source of truth
The system SHALL store learned knowledge as canonical nodes that carry concept identity, structural placement, provenance, and review metadata. Downstream surfaces such as graph views, flashcard prompts, and feed inputs MUST derive from these nodes instead of maintaining independent concept identity and scheduling state.

#### Scenario: New ask creates canonical node state
- **WHEN** a user asks a question that does not match an existing concept closely enough to merge or refine
- **THEN** the system SHALL create a canonical knowledge node with node identity, timestamp/date provenance, structural metadata, and review metadata suitable for downstream projections

#### Scenario: Existing projections stay tied to node identity
- **WHEN** the system renders graph, review, or other learning surfaces for a stored concept
- **THEN** those surfaces MUST reference the same canonical node identity rather than separate unsynchronized concept records

### Requirement: Ingestion SHALL support duplicate, refinement, and new-node outcomes
Before persisting a new ask as knowledge, the system SHALL evaluate whether it duplicates an existing node, refines an existing node, or represents a new node. The system MUST preserve provenance from the new ask even when the final outcome is merge or refinement.

#### Scenario: Duplicate ask merges into existing concept
- **WHEN** the new ask is determined to represent the same concept as an existing canonical node
- **THEN** the system SHALL update the existing node and attach the new ask as provenance or alias material instead of creating a second canonical node for the same concept

#### Scenario: Refinement ask creates child or subordinate concept
- **WHEN** the new ask extends or narrows an existing concept without being identical
- **THEN** the system SHALL attach the new knowledge as a refinement outcome, such as a child node or subordinate concept linked to the existing node

#### Scenario: Distinct ask creates new concept
- **WHEN** no existing candidate is a sufficient duplicate or refinement match
- **THEN** the system SHALL create a new canonical node and place it within the graph structure using the best available branch context

### Requirement: Candidate retrieval SHALL narrow graph context hierarchically
The system SHALL use a layered retrieval strategy that narrows graph context through roots, branches, clusters, and candidate leaves before any LLM merge decision. The system MUST avoid requiring the LLM to read the entire stored mindmap during ordinary ask ingestion.

#### Scenario: Large graph ingestion uses bounded candidate context
- **WHEN** a user asks a new question while the stored graph contains many nodes
- **THEN** the system SHALL retrieve a bounded set of likely branches, clusters, and leaf candidates and provide only that narrowed context to the LLM or merge-decision layer

#### Scenario: Retrieval remains available without embeddings
- **WHEN** vector embeddings are unavailable for part or all of the graph
- **THEN** the system SHALL still retrieve candidate roots, branches, clusters, or leaves using normalized text, keyword, and structural signals

### Requirement: Hierarchy summaries SHALL support routing and explanation
The system SHALL maintain summaries for roots, branches, or clusters that describe the concepts inside them, representative keywords, and representative members. These summaries MUST be usable for both internal routing and user-facing placement explanations.

#### Scenario: Branch summary supports routing
- **WHEN** the system evaluates where a new ask belongs
- **THEN** it SHALL be able to compare the ask against branch or cluster summaries before descending to leaf nodes

#### Scenario: Placement explanation is available
- **WHEN** the system places or merges a node under a branch or cluster
- **THEN** it SHALL retain enough branch or cluster summary context to explain that placement in product flows that surface the decision
