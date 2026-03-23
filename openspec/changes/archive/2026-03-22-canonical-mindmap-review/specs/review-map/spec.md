## ADDED Requirements

### Requirement: Daily review SHALL be derived from due canonical knowledge nodes
The system SHALL build each day’s review set from canonical knowledge nodes whose review metadata makes them due. Flashcard prompts, review counts, and daily review-map content MUST be derived from that same due-node set.

#### Scenario: Daily due set drives review surfaces
- **WHEN** the user opens the review experience for a day
- **THEN** the system SHALL derive both the flashcard review material and the mini review mindmap from the same due canonical knowledge nodes

#### Scenario: Review scheduling updates canonical state
- **WHEN** the user reviews a flashcard and submits a memory rating
- **THEN** the resulting next-review schedule MUST update the canonical node’s review metadata so future review surfaces stay synchronized

### Requirement: Review SHALL combine flashcards with a synchronized mini mindmap
The review experience SHALL present flashcard-based active recall together with a mini mindmap that reflects the due-node structure for the session. The mini map MUST update as the user progresses so the structure of reviewed knowledge becomes visible during the session.

#### Scenario: Mini map grows during review
- **WHEN** the user advances through flashcards in a review session
- **THEN** the mini map SHALL insert the current due node and its necessary parent anchors into the visible daily review structure

#### Scenario: Mini map stays structurally relevant
- **WHEN** the system expands the mini map for a reviewed node
- **THEN** it SHALL include anchor parents and only limited nearby context needed to orient the user rather than rendering the full global graph

### Requirement: Review SHALL support co-creation through learning actions
The system SHALL treat review behavior as a graph-shaping signal. Memory ratings and lightweight structural feedback from review flows MUST be able to reinforce, refine, or question the system’s proposed structure without requiring the user to perform manual graph editing as the primary workflow.

#### Scenario: Review behavior affects graph understanding
- **WHEN** the user reviews or follows up on a concept during a review-linked flow
- **THEN** the system SHALL preserve those actions as signals that can influence future node reinforcement, relationship confidence, or structural refinement

#### Scenario: Graph editing is not required for core co-creation
- **WHEN** a user completes review sessions without opening the dedicated Graph page
- **THEN** the system SHALL still allow the knowledge map to evolve through the review flow rather than depending on manual bucket-sorting as the main co-creation path

### Requirement: Daily review map SHALL represent a subset of the global mindmap
The mini review mindmap SHALL be a daily subset of the canonical global mindmap rather than an unrelated temporary visualization. It MUST be possible to identify which reviewed nodes belong to the day’s review slice and how they connect back to the broader knowledge structure.

#### Scenario: Daily map nodes correspond to global nodes
- **WHEN** the user sees a node in the mini review map
- **THEN** that node SHALL correspond to a canonical node that also exists in the global knowledge graph

#### Scenario: Daily map can be reconstructed for the day
- **WHEN** the system needs to rebuild the day’s review slice
- **THEN** it SHALL be able to reconstruct the mini review map from due-node selection and graph relationships stored in the canonical knowledge system
