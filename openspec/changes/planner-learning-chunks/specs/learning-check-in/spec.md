## ADDED Requirements

### Requirement: Learning Check-In SHALL accept freeform typed or speech-transcribed learning feedback
The system SHALL let the user submit a freeform learning check-in from Planner using typed text or optional speech-to-text input so the user can describe what felt clear, fuzzy, interesting, or worth revisiting.

#### Scenario: User submits typed check-in
- **WHEN** the user enters natural-language learning feedback into the Learning Check-In input and submits it
- **THEN** the system records the check-in as freeform text without requiring a fixed reflection template

#### Scenario: User uses speech input for check-in
- **WHEN** the user records a spoken Learning Check-In and transcription succeeds
- **THEN** the system uses the resulting transcribed text as the submitted check-in content

### Requirement: Learning Check-In SHALL extract structured learning signals
The system SHALL interpret each check-in to extract structured signals such as confidence, confusion, connection, curiosity, and revisit intent for downstream planner and Home behaviors.

#### Scenario: Check-in includes confidence and unresolved confusion
- **WHEN** a submitted check-in states that one concept feels clear but another relationship or concept still feels fuzzy
- **THEN** the system extracts both the confidence signal and the unresolved learning signal from the same check-in

#### Scenario: Check-in contains no obvious action request
- **WHEN** the user submits a reflective learning-state note rather than a direct question
- **THEN** the system still extracts planner/feed signals instead of requiring an Ask-style prompt

### Requirement: Learning Check-In SHALL create or update planner threads and suggestions from extracted signals
The system SHALL use extracted check-in signals to create or update saved threads and, when appropriate, generate Suggested Moves such as Repair or Connect without requiring the user to manually organize the output.

#### Scenario: User reports an unresolved relationship between concepts
- **WHEN** a check-in says that the relationship between two concepts remains fuzzy
- **THEN** the system creates or updates a thread representing that unresolved comparison and may add a Connect or Repair suggestion derived from it

#### Scenario: Matching thread already exists
- **WHEN** extracted check-in signals map to an existing saved thread
- **THEN** the system updates that thread's activity instead of creating a duplicate thread

### Requirement: Learning Check-In SHALL remain distinct from Ask
Learning Check-In MUST be presented and behave as a learning-state reporting flow rather than an answer-seeking chat flow. Submitting a check-in MUST NOT automatically open a conversational answer or explanatory response path.

#### Scenario: User submits a check-in
- **WHEN** a Learning Check-In is processed
- **THEN** the system responds with structural outcomes such as saved threads, generated suggestions, or feed updates rather than a direct explanatory answer

#### Scenario: User wants an explanation instead
- **WHEN** the user needs an answer or exploration of a question
- **THEN** the system keeps Ask as the explicit surface for that conversational behavior instead of repurposing Learning Check-In
