## Why

The current Home concept feed is a useful directional step, but it still feels obviously heuristic because posts are assembled from trimmed local fields instead of being authored as substantial, intriguing pieces of content. If Home is meant to optimize for "one more swipe," the app needs richer AI-written posts and a direct path from each post into contextual follow-up questions.

## What Changes

- Replace heuristic concept-post assembly with an LLM-authored post pipeline that generates teaser cards plus fuller essay-like post pages.
- Generate each day's posts from the user's broader knowledge picture for the day, including recent questions, related older knowledge, and graph connections, so the feed feels coherent and personalized.
- Support narrative variation in generated posts so they do not all read the same way; posts may use examples, mini historical stories, contrasts, jokes, or memory aids where appropriate.
- Add low-effort "quick ask" prompts to each post and support inline contextual Q&A beneath the full post page rather than sending users to a separate blank chat flow.
- Archive post-origin Q&A threads into Ask history so users can revisit and continue them later.

## Capabilities

### New Capabilities
- `ai-post-feed`: Deliver a daily AI-authored feed of teaser cards and full post pages generated from the user's daily knowledge context with varied narrative styles.
- `post-context-qa`: Let users ask contextual follow-up questions from a post page via quick prompts or freeform input, with inline answers that are archived into Ask history.

### Modified Capabilities

## Impact

- Affected product surfaces: Home feed, full post page experience, Ask history, and the relationship between feed browsing and conversational learning.
- Affected code areas: concept-feed generation, `InfoFlow`, Home navigation, Ask/session models, and LLM prompt construction.
- Affected AI pipeline: adds a richer generation step that creates full posts, feed teasers, and post-specific quick asks from the user's daily knowledge bundle.
