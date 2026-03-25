## ADDED Requirements

### Requirement: Global Touch Optimizations
The system SHALL prevent native web touch artifacts globally to maintain a native app feel.

#### Scenario: User attempts to select non-content text
- **WHEN** user long-presses on a UI element (button, nav bar, header)
- **THEN** the system SHALL NOT display a text selection magnifier or context menu

#### Scenario: User taps an interactive element
- **WHEN** user taps a button or link
- **THEN** the system SHALL NOT display a default grey/blue tap highlight overlay

### Requirement: Viewport Scaling Lock
The system SHALL prevent users from accidentally zooming the viewport.

#### Scenario: User attempts to pinch or double-tap to zoom
- **WHEN** user uses a pinch gesture or rapidly double-taps on the screen
- **THEN** the system SHALL NOT zoom the interface in or out

### Requirement: Content Text Selection
The system SHALL allow users to select text within specifically designated content areas.

#### Scenario: User selects text in a chat message or post
- **WHEN** user long-presses on text inside a Markdown block or Chat Message
- **THEN** the system SHALL allow the text to be selected and copied

### Requirement: Tactile Feedback (Squish)
The system SHALL provide immediate visual feedback for interactive elements before JavaScript execution.

#### Scenario: User presses a button
- **WHEN** user touches and holds a button or interactive card
- **THEN** the element SHALL visually scale down slightly (squish) and reduce opacity while pressed

### Requirement: Scroll Restoration
The system SHALL ensure the user starts at the top of a page when navigating to a new route.

#### Scenario: User navigates between pages
- **WHEN** user scrolls down on the Home screen and taps a navigation link to Settings
- **THEN** the Settings screen SHALL render at the top scroll position, not the scroll depth of the Home screen