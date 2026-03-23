## Why

The current Home info flow is built from due review cards, so even when styled as a feed it still feels like an evaluation surface. That creates pressure at the exact entry point that should instead spark curiosity, lightweight engagement, and repeat app opens.

## What Changes

- Replace Home's review-driven concept cards with a curiosity-driven concept feed that is distinct from the dedicated review queue.
- Introduce a new concept post content model optimized for hook-first discovery rather than front/back active recall.
- Generate Home feed items from a mix of recent questions, older related knowledge, graph adjacency, and novelty so the stream feels personal without feeling repetitive.
- Present concept posts with a social-style card format: an outer hook that invites a tap or swipe, and an inner explanation that delivers a deeper, interesting payoff.
- Keep deliberate rating and spaced-repetition workflows inside the Review experience instead of the Home feed.

## Capabilities

### New Capabilities
- `concept-feed`: Deliver a personalized Home feed of hook-driven concept posts derived from the user's knowledge graph, question history, and novelty mix.

### Modified Capabilities

## Impact

- Affected product surfaces: Home feed, concept card interaction model, and the relationship between Home and Review.
- Affected code areas: `app/src/screens/HomeScreen.tsx`, `app/src/components/InfoFlow.tsx`, `app/src/types/index.ts`, and likely new or updated feed-generation services.
- Affected content pipeline: selection and ranking logic must use both recent and older user knowledge rather than only today's due flashcards.
