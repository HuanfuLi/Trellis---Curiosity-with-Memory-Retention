# EchoLearn Roadmap (v2.0)

- [x] [Milestone 1: Learning Loop Foundation (v1.0)](.planning/milestones/v1.0-ROADMAP.md) - Shipped 2026-03-25.

## Milestone 2: Dynamic Learning Orchestration & Diagnostic Dialogue
- [ ] **Phase 7: The Orchestration Engine (Architecture)**
  - [ ] Define `OrchestrationStrategy` and `LearningOrchestrator` interfaces.
  - [ ] Implement `TrajectoryObserver` to aggregate data from Review, Question, and Feed services.
  - [ ] Create decoupled plug-and-play structure in `src/services/orchestrator/`.
- [ ] **Phase 8: Diagnostic Dialogue & Content Portals**
  - [ ] Replace static Check-In with Socratic conversational UI.
  - [ ] Refactor Planner UI to render rich "Portals" that redirect to content.
  - [ ] Implement "Redirect" logic for Recommendations (Post/Question/Review).
- [ ] **Phase 9: Multi-Device Sync & Trajectory Persistence**
  - [ ] Implement robust sync for trajectory and orchestrator state.
  - [ ] Final Milestone 2 polish and verification.
