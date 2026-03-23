## MODIFIED Requirements

### Requirement: Concept posts SHALL stay relevant to user knowledge
The system SHALL derive concept posts from the user's stored questions, relationships, active planner threads, and check-in-derived learning signals so feed content remains connected to what the user has already explored and what currently feels unresolved or interesting.

#### Scenario: User has related question history
- **WHEN** the user has asked questions that share keywords or graph relationships
- **THEN** the system may create concept posts that bridge those related ideas into a single explanatory post

#### Scenario: User has limited history
- **WHEN** the user has only a small amount of stored question knowledge
- **THEN** the system still generates concept posts from the available knowledge without requiring fresh user input

#### Scenario: Check-in surfaces an unresolved comparison
- **WHEN** a recent Learning Check-In indicates that the relationship between concepts remains fuzzy
- **THEN** the concept feed may boost posts and connections relevant to that unresolved comparison

#### Scenario: Active thread reflects current curiosity
- **WHEN** the user has an active or recently updated planner thread
- **THEN** the concept feed may rank related posts higher so Home reflects that current learning trajectory without turning the feed into a direct answer surface

## ADDED Requirements

### Requirement: Concept-feed updates from Learning Check-In SHALL remain curiosity-first
The system SHALL use check-in-derived signals as relevance inputs for Home without surfacing judgmental weakness messaging or converting Planner feedback into Ask-like answers.

#### Scenario: Home adapts after a learning check-in
- **WHEN** a Learning Check-In creates or updates planner signals
- **THEN** Home adjusts future concept-feed relevance through post ranking or candidate selection rather than showing a direct explanatory reply inside Planner

#### Scenario: Check-in indicates uncertainty
- **WHEN** a Learning Check-In reveals confusion or uncertainty
- **THEN** Home may surface clarifying or connection-oriented concept posts without presenting the user with explicit "you are weak at" language
