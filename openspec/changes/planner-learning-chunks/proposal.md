## Why

The current Calendar behaves like a generic block-and-todo surface, which weakens its connection to EchoLearn's learning loop. Renaming it to Planner and restructuring it around optional learning chunks, saved threads, and learning check-ins makes the surface support learning intention and continuity instead of task completion.

## What Changes

- Rename the Calendar surface to Planner and replace time-block todo management with a hybrid planner structure built around Continue, Suggested Moves, Saved Threads, and a Learning Check-In entry point.
- Introduce optional learning chunks as lightweight learning actions such as Retrieve, Repair, Connect, and Create instead of generic task items or time-boxed assignments.
- Add Learning Check-In capture so users can type or speak freeform notes about what felt clear, fuzzy, interesting, or worth revisiting after review or exploration.
- Extract structured signals from each Learning Check-In to create or update planner threads, generate planner suggestions, and inform Home feed relevance.
- Update Home concept-feed behavior so relevant posts can be boosted from check-in-derived signals without turning check-ins into direct Ask-style answers.

## Capabilities

### New Capabilities
- `learning-planner`: A planner workspace that organizes active learning through optional chunks, resumable items, and saved learning threads rather than time blocks and todos.
- `learning-check-in`: A freeform typed or speech-to-text check-in flow that captures the user's perceived learning state and converts it into planner and feed signals.

### Modified Capabilities
- `concept-feed`: Home feed relevance is expanded to consume check-in-derived signals such as unresolved comparisons, active threads, and current interests.

## Impact

- Affected screens and navigation: Planner/Calendar screen, Home screen, bottom navigation labels, and related empty/loading states.
- Affected domain models and services: calendar/planner state, planner chunk/thread/check-in persistence, signal extraction pipeline, and concept-feed ranking inputs.
- Affected integrations: existing speech-to-text capture flows can be reused for optional check-in voice input.
- Existing mock calendar service and todo-oriented UI/state will be replaced or substantially reworked into planner-oriented data structures and behavior.
