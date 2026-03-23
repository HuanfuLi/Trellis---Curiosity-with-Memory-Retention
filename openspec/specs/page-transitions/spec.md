## ADDED Requirements

### Requirement: Route Animations
The system SHALL animate the transition between major application routes to provide spatial context.

#### Scenario: User navigates to a new screen
- **WHEN** user navigates from one primary screen to another (e.g., Home to Graph)
- **THEN** the new screen SHALL animate into view (e.g., sliding or fading) seamlessly

#### Scenario: Route exit animation
- **WHEN** a screen is unmounted due to navigation
- **THEN** the departing screen SHALL complete its exit animation before the new screen fully enters (or they cross-fade smoothly)