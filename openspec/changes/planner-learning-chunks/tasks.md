## 1. Planner Domain And State

- [x] 1.1 Define planner domain models for chunks, threads, check-ins, and soft chunk states in `app/src/types/index.ts`
- [x] 1.2 Add planner persistence and service logic to replace the current calendar-focused mock data flow with planner-specific storage keys and CRUD operations
- [x] 1.3 Create or update planner state hooks so Continue, Suggested Moves, Saved Threads, and Learning Check-In data can be loaded and mutated reactively

## 2. Planner Surface Migration

- [x] 2.1 Replace Calendar navigation labels and route-facing copy with Planner language across bottom navigation, screen headers, and empty states
- [x] 2.2 Rebuild the current Calendar screen into the hybrid Planner layout with Continue, Suggested Moves, Saved Threads, and Learning Check-In sections
- [x] 2.3 Replace todo/time-block controls with planner chunk cards that support lightweight actions such as start, save for later, in progress, and done

## 3. Learning Check-In Pipeline

- [x] 3.1 Add the Learning Check-In input flow with typed entry and optional speech-to-text capture from Planner
- [x] 3.2 Implement check-in signal extraction for confidence, confusion, connection, curiosity, and revisit intent from freeform user input
- [x] 3.3 Map extracted check-in signals into thread creation or updates and chunk suggestion generation while avoiding duplicate threads
- [x] 3.4 Return structural check-in outcomes in Planner UI without producing Ask-style explanatory responses

## 4. Home Feed And Cross-Surface Integration

- [x] 4.1 Extend concept-feed ranking inputs to consider active planner threads and recent check-in-derived signals
- [x] 4.2 Update Home planner-related summaries so they reflect planner-oriented signals instead of pending task counts
- [x] 4.3 Ensure check-in-informed Home updates remain curiosity-first and avoid explicit weakness or assessment messaging

## 5. Validation And Cleanup

- [x] 5.1 Verify Planner, Ask, Review, and Home boundaries remain clear in labels, prompts, and user flows
- [x] 5.2 Validate local persistence behavior for planner data and confirm legacy calendar storage is not lossy-migrated into planner items
- [x] 5.3 Remove or isolate obsolete calendar-specific UI/state paths once Planner behavior is working end to end
