## ADDED Requirements

### Requirement: Home SHALL deliver concept posts independent of the review queue
The system SHALL populate the Home concept feed from a concept-feed source that is distinct from today's due flashcards and explicit recall-rating workflows.

#### Scenario: Home feed loads with available knowledge
- **WHEN** the user opens Home and the app has stored question knowledge
- **THEN** the system shows concept posts derived from the concept-feed source instead of using the review queue as the concept-card source

#### Scenario: Review remains separate
- **WHEN** the user interacts with concept posts on Home
- **THEN** the system MUST NOT require recall rating or update spaced-repetition schedules from those interactions

### Requirement: Concept posts SHALL use hook-first educational content
Each concept post SHALL present an outer hook designed to attract attention and an inner explanatory state that provides a deeper educational payoff.

#### Scenario: User previews a concept post
- **WHEN** a concept post first appears in the Home feed
- **THEN** the outer state shows a concise curiosity hook rather than a front/back flashcard prompt

#### Scenario: User opens a concept post
- **WHEN** the user taps or swipes into a concept post's inner state
- **THEN** the system shows a deeper explanation tied to the same concept rather than a recall answer reveal

### Requirement: The feed SHALL mix recent, related, and resurfaced knowledge
The concept-feed ranking logic SHALL combine knowledge from recent user questions, related knowledge graph neighbors, and older resurfaced concepts so the feed feels both familiar and varied.

#### Scenario: User has both recent and older knowledge
- **WHEN** the system assembles concept-feed candidates
- **THEN** it includes content from more than one knowledge recency bucket instead of only the newest items

#### Scenario: Feed prevents pure repetition
- **WHEN** the user has multiple recent questions on a narrow topic
- **THEN** the feed still includes related or resurfaced concepts so consecutive posts are not all drawn from the same immediate source

### Requirement: Concept posts SHALL stay relevant to user knowledge
The system SHALL derive concept posts from the user's stored questions and their relationships so feed content remains connected to what the user has already explored.

#### Scenario: User has related question history
- **WHEN** the user has asked questions that share keywords or graph relationships
- **THEN** the system may create concept posts that bridge those related ideas into a single explanatory post

#### Scenario: User has limited history
- **WHEN** the user has only a small amount of stored question knowledge
- **THEN** the system still generates concept posts from the available knowledge without requiring fresh user input
