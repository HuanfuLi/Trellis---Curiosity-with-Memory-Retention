## 1. Define concept-feed data and generation

- [x] 1.1 Add a concept-post data model and update feed item typing so Home concept posts are no longer represented as review flashcards
- [x] 1.2 Create a concept-feed service that builds candidate posts from stored questions, related-question graph data, and recency buckets
- [x] 1.3 Implement feed-mix heuristics that blend recent, related, and resurfaced knowledge while avoiding repetitive consecutive posts
- [x] 1.4 Add fallback handling so Home can still generate concept posts for users with limited stored knowledge

## 2. Refactor Home feed behavior

- [x] 2.1 Update `HomeScreen` to request concept-feed items instead of sourcing concept cards from `useReview().items`
- [x] 2.2 Preserve or adapt connection and milestone cards so they still fit the new low-pressure discovery feed
- [x] 2.3 Ensure Home interactions do not submit review ratings or mutate spaced-repetition schedules

## 3. Redesign concept-post presentation

- [x] 3.1 Refactor `InfoFlow` concept-card rendering to support a hook-first outer state and a deeper explanatory inner state
- [x] 3.2 Remove active-recall labels, flip-to-answer copy, and rating controls from Home concept posts
- [x] 3.3 Tune interaction and layout details so concept posts feel swipe-friendly and social-style rather than like flashcards

## 4. Verify behavior and regression boundaries

- [x] 4.1 Verify Home feed content includes a mix of recent and resurfaced knowledge instead of only due review items
- [x] 4.2 Verify Review screen behavior and review scheduling remain unchanged after the Home refactor
- [x] 4.3 Add or update targeted tests for concept-feed generation and Home feed interaction behavior where the codebase supports them
