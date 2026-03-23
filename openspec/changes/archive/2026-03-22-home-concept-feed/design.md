## Context

The current Home feed is assembled inside `HomeScreen` from `useReview().items`, then rendered through `InlineInfoFlow` using concept cards labeled "Active Recall" with flip-and-rate behavior. This makes Home a thin variation of the review queue instead of a low-pressure discovery surface.

This change introduces a new content path for Home. Instead of sourcing concept cards from today's due flashcards, Home will source personalized concept posts built from the user's question history, related-question graph, recency, and rediscovery opportunities. The existing Review flow remains the place for explicit recall and spaced-repetition scoring.

Constraints:
- The app is local-first and currently stores question knowledge on-device.
- Home must stay lightweight and resilient even when no external AI request is available at render time.
- The feed should reuse existing knowledge artifacts when possible rather than requiring new user input.

Stakeholders:
- Users who want a more engaging Home experience that feels like discovery instead of homework.
- The implementation team, which needs a clear separation between feed-generation logic and review logic.

## Goals / Non-Goals

**Goals:**
- Separate Home feed behavior from the review queue at both the data and interaction levels.
- Introduce a concept post model designed for hook-first, swipe-friendly learning content.
- Mix recent, adjacent, and older user knowledge so the feed feels personal and varied.
- Preserve Review as the dedicated place for rating recall and updating spaced-repetition schedules.
- Provide deterministic fallback behavior so Home still renders useful concept posts from stored knowledge.

**Non-Goals:**
- Redesign the Review screen or change the spaced-repetition algorithm.
- Implement a remote recommendation system or server-backed feed.
- Guarantee infinite scrolling or highly personalized ranking beyond local heuristics in this change.
- Replace every existing InfoFlow card type; connection and milestone cards can remain if they fit the new feed.

## Decisions

### Decision: Introduce a concept-post content model separate from `FlashCard`
Home feed items will be generated from a new concept-post shape rather than directly reusing flashcards.

Rationale:
- Flashcards optimize for front/back recall and review scheduling.
- Concept posts optimize for hooks, explanation payoff, and low-pressure engagement.
- Reusing `FlashCard` would keep Home structurally coupled to review semantics and make future ranking harder.

Alternatives considered:
- Re-skin flashcards only. Rejected because it preserves the same pressure-inducing interaction contract.
- Reuse `Question` directly. Rejected because raw questions do not capture hook, explanation body, or feed metadata cleanly.

### Decision: Build the Home feed from a local concept-feed service
A dedicated feed-generation service will assemble candidate concept posts using question history, graph relations, novelty heuristics, and optional review context.

Rationale:
- Keeps ranking and feed composition out of `HomeScreen`.
- Allows the same feed logic to evolve independently from rendering details.
- Makes it easier to test feed generation and candidate mixing.

Alternatives considered:
- Keep assembly inline in `HomeScreen`. Rejected because the current screen is already doing UI orchestration and would become harder to reason about.

### Decision: Preserve a clear product boundary between Home and Review
Home concept posts will not ask for recall ratings or update review schedules. Review remains the explicit memory-training surface.

Rationale:
- Prevents "homework pressure" from returning through feed interactions.
- Gives each surface a clear emotional role: discovery on Home, training in Review.

Alternatives considered:
- Allow optional rating inside Home. Rejected for the initial change because even optional scoring can pull the feed back toward evaluation.

### Decision: Use a controlled old/new knowledge mix instead of only recent content
The feed service will rank and mix content from:
- recent user questions
- graph-adjacent concepts
- older resurfaced knowledge
- occasional slightly novel but still relevant concepts

Rationale:
- Too much recent content feels repetitive.
- Too much old content feels stale.
- A controlled blend supports both familiarity and surprise.

Alternatives considered:
- Pure recency ranking. Rejected because it quickly becomes repetitive.
- Pure graph expansion. Rejected because it may drift away from the user's current interests.

### Decision: Support a two-stage concept post interaction
Concept posts will expose a hook-first outer state and a deeper explanatory inner state, consistent with the intended social-style interaction.

Rationale:
- Matches the desired "post outside, explanation inside" mental model.
- Gives the feed a clear attention hook before asking the user to read more deeply.

Alternatives considered:
- One long card with all content visible. Rejected because it weakens the hook/payoff rhythm and feels heavier.

## Risks / Trade-offs

- [Risk] Feed quality feels random or repetitive if ranking heuristics are too shallow. → Mitigation: define explicit candidate buckets and limit repeated concepts within a short window.
- [Risk] Generating a new concept-post layer increases data-model complexity. → Mitigation: keep the initial model compact and derived from existing local knowledge rather than introducing broad persistence needs immediately.
- [Risk] Home becomes entertaining but less educational if hooks overpromise or explanations underdeliver. → Mitigation: require each concept post to include a concrete explanatory payoff tied to the user's knowledge graph.
- [Risk] Removing rating from Home may reduce total review throughput. → Mitigation: keep Review prominent as the dedicated action path and measure engagement shifts before coupling Home back to review behavior.
- [Risk] Legacy `InfoFlow` component assumptions around concept cards may resist the new model. → Mitigation: refactor feed item typing around capability needs instead of stretching the current flashcard-centric union.

## Migration Plan

1. Add the concept-feed capability and concept-post model behind Home feed generation.
2. Refactor Home to request feed items from the new service instead of `useReview().items`.
3. Update `InfoFlow` rendering so concept posts use hook/deep-explanation interactions without review rating controls.
4. Keep connection and milestone cards compatible where they still reinforce discovery.
5. Validate that Review behavior remains unchanged and that Home still renders sensibly for low-data users.

Rollback strategy:
- Restore Home's previous review-driven feed assembly if the new feed proves unstable or low quality.
- Because this change is local UI and local derivation logic, rollback is a code revert rather than a data migration.

## Open Questions

- Should the "inside" of a concept post be one expanded panel or a short multi-panel carousel?
- Should concept posts be persisted for replay/history, or generated fresh from local knowledge each time Home loads?
- How strongly should weak review topics influence the feed without making Home feel evaluative again?
