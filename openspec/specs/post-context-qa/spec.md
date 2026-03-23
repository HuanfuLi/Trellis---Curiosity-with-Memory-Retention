## ADDED Requirements

### Requirement: Post pages SHALL support low-effort contextual asking
The system SHALL let users ask follow-up questions from a post page using both quick ask prompts and freeform input.

#### Scenario: Quick ask prompts are available
- **WHEN** the user opens a post page
- **THEN** the page shows preset low-effort follow-up prompts related to that specific post

#### Scenario: Freeform follow-up is available
- **WHEN** the user wants to ask a custom question about the post
- **THEN** the page provides a freeform input for contextual Q&A beneath the post

### Requirement: Post follow-ups SHALL use post-context prompts
The system SHALL send the LLM a contextual continuation prompt that includes the post's content and provenance so follow-up answers continue from the post rather than restarting as generic chat.

#### Scenario: Asking from a post
- **WHEN** the user asks a follow-up question from a post page
- **THEN** the system includes the post's hook, thesis, full content, and relevant source context in the prompt bundle

#### Scenario: Contextual continuity
- **WHEN** the AI replies to a post follow-up
- **THEN** the reply deepens or clarifies the specific post context instead of responding as an unrelated new session

### Requirement: Post follow-ups SHALL appear inline on the post page
The system SHALL render post-origin questions and answers inline beneath the post so the interaction feels like a continuation of the post page.

#### Scenario: Inline thread updates
- **WHEN** the user submits a post follow-up question
- **THEN** the page shows the resulting Q&A inside the post page's inline thread area

#### Scenario: Multiple follow-ups
- **WHEN** the user asks more than one post follow-up
- **THEN** the page preserves the sequence of inline Q&A exchanges for that post thread

### Requirement: Post-origin Q&A SHALL be archived into Ask history
The system SHALL preserve post-origin Q&A as resumable sessions in Ask history so users can revisit and continue them later.

#### Scenario: Session is archived
- **WHEN** the user creates a Q&A thread from a post page
- **THEN** the system stores it as a session with post-origin metadata that later appears in Ask history

#### Scenario: Resuming from Ask history
- **WHEN** the user opens a post-origin session from Ask history
- **THEN** the system restores the thread with enough metadata to continue the conversation coherently
