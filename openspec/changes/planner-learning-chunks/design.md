## Context

EchoLearn's current Calendar surface is implemented as time blocks containing generic todos. That model is structurally separated from the app's learning loop, which today lives across Ask, Home, Review, and Podcast. The result is a surface that encourages completion tracking rather than shaping or continuing learning.

This change replaces the Calendar mental model with a Planner workspace. The Planner is intentionally not a strict scheduler: chunks are optional, timeboxing is removed, and user effort stays low by supporting freeform typed or speech-to-text check-ins. Home remains the discovery surface, while Planner becomes the place where learning intentions, active chunks, and unresolved threads are organized.

The change is cross-cutting because it touches navigation language, screen structure, local persistence models, Home feed ranking inputs, and the boundary between Planner and Ask.

## Goals / Non-Goals

**Goals:**
- Replace task-oriented calendar behavior with a planner-oriented workspace centered on learning chunks and threads.
- Preserve a low-pressure experience by removing required durations, mandatory reflections, and todo-style completion framing.
- Introduce a Learning Check-In flow that captures freeform user feedback and transforms it into structured planner and Home-feed signals.
- Keep the distinction between Ask and Planner visible in both UI copy and system behavior.
- Reuse existing local-first and optional speech-to-text patterns rather than introducing remote orchestration requirements.

**Non-Goals:**
- Building a full conversational follow-up workflow from Planner check-ins.
- Turning Planner into a rigid daily timetable, kanban board, or curriculum-management system.
- Reworking the Review scheduling algorithm itself.
- Adding text-to-speech prompting or mandatory voice interaction.

## Decisions

### Planner uses a hybrid structure instead of day-only or board-only organization
Planner will be organized into four sections: Continue, Suggested Moves, Saved Threads, and Learning Check-In. This preserves immediacy without pushing the user into a daily task list and preserves long-lived curiosity without collapsing into an unstructured board.

Alternatives considered:
- Keep a day-based planner: rejected because it too easily regresses into a disguised todo list.
- Use a pure board-style planner: rejected because it weakens "what can I do now?" guidance and overlaps too much with Home and the knowledge library.

### Learning chunks are lightweight action cards, not timed assignments
Chunks will represent optional learning moves such as Retrieve, Repair, Connect, and Create. They will not require start/end times or duration estimates, and they will use soft states such as suggested, in progress, done, and saved for later.

Alternatives considered:
- Retain time blocks and simply rename todos to learning tasks: rejected because it preserves the same productivity-domain shape.
- Keep duration metadata as optional: rejected for the first version because even optional timing would bias the UI back toward pressure and scheduling.

### Threads and chunks are separate domain objects
Threads represent persistent topics, comparisons, or unresolved areas that the user may want to return to. Chunks represent a concrete next learning move that may be spawned from a thread, from Home-derived signals, or from direct user actions inside Planner.

Alternatives considered:
- Use a single card type for both long-running topics and next actions: rejected because it blurs persistence, state transitions, and recommendation logic.

### Learning Check-In is an interpretation flow, not an answer flow
Planner check-ins will accept typed input or optional speech-to-text transcription, then extract structured signals such as confidence, confusion, connection, curiosity, and revisit intent. The system response will be structural, for example creating or updating a thread, creating a suggestion, and adjusting Home feed relevance. Planner check-ins will not produce direct explanatory answers by default.

Alternatives considered:
- Make check-ins open a chat reply: rejected because that duplicates Ask and weakens the product boundary.
- Restrict check-ins to fixed reflection prompts: rejected because it feels pushy and increases effort.

### Home consumes check-in signals as ranking inputs, not explicit diagnoses
Concept-feed ranking will be extended to incorporate signals derived from check-ins, especially unresolved comparisons, active threads, and current interests. Home should respond by surfacing more relevant posts and connections, not by announcing weakness or assessment labels.

Alternatives considered:
- Show explicit "you are weak at X" cards: rejected because it adds pressure and clashes with the curiosity-first feel of Home.

### Existing calendar data will be treated as legacy and not force-migrated into chunks
The current time-block/todo model does not map cleanly onto planner chunks and threads. For the initial change, planner data will use new persistence keys and structures. Legacy calendar data may be ignored or left dormant rather than transformed heuristically into planner items.

Alternatives considered:
- Auto-convert todos into chunks and block labels into threads: rejected because the semantic mapping is unreliable and risks confusing users with low-quality migrated data.

## Risks / Trade-offs

- [Planner becomes too abstract] → Mitigation: keep a visible Continue section and concise chunk cards so there is always a clear "do this now" path.
- [Planner overlaps with Ask] → Mitigation: use distinct copy, different response behavior, and no direct answer generation from check-ins.
- [Home becomes noisy from too many inferred signals] → Mitigation: treat check-ins as ranking inputs, cap suggestion generation, and update existing threads before creating new ones.
- [Voice input adds friction on unsupported devices] → Mitigation: keep typed entry as the default path and treat speech-to-text as optional enhancement only.
- [Removing time semantics disappoints users who liked scheduling] → Mitigation: keep the surface framed around learning continuity, and reserve time-based planning for a later change if real demand emerges.
- [Legacy calendar state becomes orphaned] → Mitigation: isolate planner persistence under new models and clearly scope migration as out of scope for the first iteration.

## Migration Plan

1. Introduce planner-specific domain models, state hooks, and persistence alongside the existing calendar code.
2. Replace Calendar navigation labels and screen entry points with Planner once the new surface is ready.
3. Swap Home references from task counts to planner-oriented signals.
4. Leave legacy calendar storage untouched for the first rollout rather than performing lossy conversion.
5. Remove obsolete calendar-only UI/state after Planner behavior is verified.

Rollback strategy:
- Re-enable the previous Calendar route and bottom-navigation label while preserving planner persistence as unused local state.

## Open Questions

- Whether Planner should expose dismiss/archive controls for threads in the first version or keep thread management minimal.
- Whether a completed chunk should optionally emit follow-up signals into Review, or remain a Planner/Home concern only for now.
- How aggressively concept-feed ranking should weight check-in signals versus recency and graph adjacency in the first tuning pass.
