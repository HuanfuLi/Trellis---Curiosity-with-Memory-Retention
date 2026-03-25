## ADDED Requirements

### Requirement: Planner SHALL replace Calendar as the app's learning-organization surface
The system SHALL present Planner as the navigation and screen identity for organizing active learning, replacing Calendar's task-oriented positioning.

#### Scenario: User opens the planning surface
- **WHEN** the user navigates to the current Calendar tab or route
- **THEN** the system shows Planner language and planner-oriented content instead of calendar/todo terminology

#### Scenario: Home links into Planner
- **WHEN** the user opens the planning surface from Home or bottom navigation
- **THEN** the system routes the user into Planner rather than a task-count calendar screen

### Requirement: Planner SHALL use a hybrid structure of active chunks, suggestions, and saved threads
Planner SHALL organize content into Continue, Suggested Moves, and Saved Threads so users can resume active learning, accept system-suggested next moves, and preserve longer-running interests without requiring a day-based schedule.

#### Scenario: User has active and saved planner data
- **WHEN** the user opens Planner with in-progress chunks and saved threads
- **THEN** the system separates resumable chunks from saved threads instead of rendering them as one undifferentiated list

#### Scenario: User has no active chunks
- **WHEN** the user opens Planner without in-progress chunks
- **THEN** the system still shows Suggested Moves and Saved Threads without implying overdue or missed work

### Requirement: Planner chunks SHALL be lightweight learning actions rather than timed tasks
The system SHALL represent planner chunks as optional learning actions such as Retrieve, Repair, Connect, and Create. Chunks MUST NOT require time durations, time blocks, or generic task checklists as part of the core workflow.

#### Scenario: User creates or receives a chunk
- **WHEN** a planner chunk is displayed
- **THEN** the system presents a chunk type, learning goal, and linked concepts or thread context rather than a timed todo item

#### Scenario: User views chunk controls
- **WHEN** a chunk card is shown in Planner
- **THEN** the system offers lightweight states such as start, save for later, in progress, or done instead of checkbox-style task completion controls

### Requirement: Planner SHALL preserve low pressure by keeping chunks optional
The system SHALL treat planner chunks and planner completion as optional guidance rather than obligations. Planner MUST NOT frame unfinished chunks as failures, overdue work, or required end-of-day completion.

#### Scenario: User leaves suggested chunks untouched
- **WHEN** the user does not start or complete a suggested chunk
- **THEN** the system preserves the suggestion or lets the user save it for later without showing overdue warnings or missed-task messaging

#### Scenario: User reopens Planner after partial activity
- **WHEN** the user returns to Planner with some untouched or in-progress chunks
- **THEN** the system emphasizes continuity and resumption instead of numeric task-completion pressure
