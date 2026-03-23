## ADDED Requirements

### Requirement: Home SHALL deliver AI-authored daily posts
The system SHALL generate a daily Home feed of AI-authored posts from the user's daily knowledge context instead of relying only on heuristic field assembly from individual stored questions.

#### Scenario: Daily feed generation
- **WHEN** the user opens Home and AI generation is available
- **THEN** the system generates or loads a set of authored posts derived from the user's daily knowledge bundle

#### Scenario: Fallback when AI is unavailable
- **WHEN** AI generation is unavailable or fails
- **THEN** the system still provides a usable Home feed through deterministic fallback content rather than leaving the feed empty

### Requirement: Posts SHALL contain both teaser and full-page content
Each authored post SHALL include a feed teaser representation and a fuller essay-like representation for the dedicated post page.

#### Scenario: Feed browsing
- **WHEN** the user is on the Home feed
- **THEN** the system shows teaser-level content that invites the user deeper without rendering the entire essay inline

#### Scenario: Opening a post
- **WHEN** the user selects a post from Home
- **THEN** the system navigates to a dedicated post page showing the complete post content

### Requirement: Posts SHALL use varied narrative styles
The system SHALL generate posts with controlled narrative variation so the feed does not present all content in the same structure or tone.

#### Scenario: Different post forms
- **WHEN** the system generates multiple posts for the same day
- **THEN** the resulting posts may use distinct forms such as example-first explanation, historical story, contrast, analogy, or mnemonic framing

#### Scenario: Variation remains instructional
- **WHEN** a post uses a playful or unusual narrative device
- **THEN** the post still grounds its explanation in the supplied knowledge context and preserves learning value

### Requirement: Daily feed generation SHALL use a broader knowledge picture
The system SHALL generate posts using a structured daily knowledge context that includes recent questions, related older knowledge, and relevant knowledge links instead of only a single source question.

#### Scenario: Recent and older knowledge combine
- **WHEN** the user has both recent questions and older relevant knowledge
- **THEN** the generation context may combine them into a single post or coordinated set of posts for the day

#### Scenario: Daily feed coherence
- **WHEN** the system generates a day's feed
- **THEN** posts are selected and authored with awareness of the broader daily context so they feel coordinated rather than independent random summaries
