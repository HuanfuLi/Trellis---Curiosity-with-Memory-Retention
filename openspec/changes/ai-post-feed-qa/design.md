## Context

The current `home-concept-feed` change moved Home away from direct review pressure, but its concept posts are still assembled heuristically from local question fields such as hook, summary, and answer slices. This keeps the feed lightweight, but it also makes the content feel short, visibly derived, and too uniform in structure to sustain the "one more swipe" behavior the Home surface is now expected to drive.

The next step is to treat Home as an AI-authored daily post feed rather than a thin feed of summarized concepts. Each feed item should have:
- a teaser representation for the swipe feed
- a fuller essay-like post page
- low-effort quick ask prompts
- inline contextual Q&A that can later be resumed from Ask history

Constraints:
- The app remains local-first; the knowledge source is primarily on-device questions, graph relations, and prior derived knowledge.
- Post generation may depend on the configured LLM, so the system needs deterministic fallback behavior when AI is unavailable.
- The feed should feel varied without becoming random or inconsistent in trustworthiness.
- Post Q&A must preserve enough origin context to feel like a continuation of the post, not a generic blank chat.

Stakeholders:
- Users who want Home to feel compelling and immersive instead of summary-driven.
- The implementation team, which needs a clean separation between post generation, post viewing, and archived conversation state.

## Goals / Non-Goals

**Goals:**
- Generate richer, varied AI-authored posts from the user's daily knowledge picture rather than from single-question truncation.
- Represent each post as a first-class object with teaser, full body, narrative metadata, and quick ask prompts.
- Add a dedicated full post page where users can read the complete context and ask follow-up questions inline.
- Preserve post-origin Q&A threads in Ask history so users can continue them later.
- Keep podcast and calendar as supporting loops rather than primary Home drivers.
- Provide a graceful fallback path when AI generation is unavailable.

**Non-Goals:**
- Redesign podcast or calendar into primary feed surfaces.
- Build a remote server-side recommendation system in this change.
- Support arbitrary social features such as public comments, reactions, or sharing.
- Implement fully open-ended infinite content generation beyond the daily feed scope.

## Decisions

### Decision: Treat the post as a richer primary content object
The system will generate and handle a post object that contains both feed-facing and detail-page content, rather than using a minimal concept-post shape optimized only for inline feed rendering.

Rationale:
- A richer post object prevents the current problem where the content itself is short and appears intentionally truncated.
- It allows the teaser card to be derived from a fuller post, rather than the full post being constrained by teaser length.
- It creates a natural place to attach quick ask prompts, source provenance, and narrative mode.

Alternatives considered:
- Keep the current concept-post schema and only remove truncation. Rejected because it does not solve the lack of narrative structure or contextual Q&A scaffolding.
- Make the feed card itself the full essay. Rejected because it weakens swipe rhythm and makes the feed visually heavy.

### Decision: Generate posts from the user's daily knowledge bundle
The LLM will receive a structured daily context containing recent questions, related older questions, graph-adjacent knowledge, and feed-composition constraints, then generate a coherent set of posts for the day.

Rationale:
- Good posts often require multiple source questions rather than one isolated prompt.
- A daily bundle allows the feed to feel editorially coherent rather than like unrelated isolated outputs.
- It supports deliberate variety across the day's posts by telling the model what has already been selected or shown.

Alternatives considered:
- Generate each post independently from a single question. Rejected because it tends to produce repetitive and shallow outputs.
- Generate posts entirely from heuristic clustering with no LLM authoring. Rejected because it preserves the same "obviously assembled" feel.

### Decision: Support narrative variation through explicit generation modes
Each post generation request will ask the model to choose or receive a narrative mode such as example-first, historical story, contrast, analogy, false intuition, or mnemonic/joke.

Rationale:
- Controlled variation prevents the feed from becoming mechanically uniform.
- Explicit modes let the generator vary structure while still staying within an authored system.
- This is closer to how short-form educational content sustains attention.

Alternatives considered:
- Let the model vary structure implicitly with no requested modes. Rejected because variation becomes less predictable and harder to tune.

### Decision: Use a dedicated post page with inline Q&A, not direct feed-to-chat navigation
Tapping a teaser card will open a full post page. The user reads the essay, then can ask via quick ask chips or freeform input in an inline Q&A area beneath the post.

Rationale:
- Preserves feed momentum while still delivering a substantial payoff.
- Keeps contextual follow-up tied to the post rather than collapsing immediately into a generic chat screen.
- Matches the "post + comments" mental model the product is aiming for.

Alternatives considered:
- Let cards expand in-feed only. Rejected because the content is expected to be longer and more essay-like.
- Send users directly to Ask for post follow-ups. Rejected because it breaks immersion and loses the sense of continuity with the post.

### Decision: Archive inline post Q&A as resumable Ask history sessions
Inline post Q&A will create or attach to a session that preserves post origin metadata and later appears in Ask history as a resumable thread.

Rationale:
- Supports continuity across surfaces without forcing users to choose between post comments and long-term chat history.
- Allows Ask history to remain the place for ongoing conversations while preserving the post as the conversation origin.
- Prevents inline Q&A from becoming ephemeral or siloed state.

Alternatives considered:
- Keep post Q&A ephemeral and separate. Rejected because users explicitly want to revisit and continue those conversations later.

### Decision: Use a contextual continuation prompt for post follow-ups
Post-origin questions will send the model a prompt bundle containing the post's hook, thesis, full body, quick-ask context, and provenance from source questions.

Rationale:
- Makes the AI continue from the post instead of restarting from scratch.
- Grounds answers in the exact content the user just saw.
- Preserves tone and continuity across follow-up exchanges.

Alternatives considered:
- Send only the user's follow-up text. Rejected because it would make "ask about this post" feel like generic chat.

## Risks / Trade-offs

- [Risk] Daily LLM-generated posts may increase latency or token cost noticeably. → Mitigation: generate a bounded daily batch, cache results locally, and use heuristic fallback posts when generation is unavailable.
- [Risk] Strong narrative variation may drift into inconsistency or weak factual grounding. → Mitigation: provide structured source context and require the model to ground the post in supplied knowledge snippets.
- [Risk] Post pages plus inline Q&A add state complexity across Home and Ask history. → Mitigation: define explicit session origin metadata and reuse session persistence rather than inventing a second archive system.
- [Risk] Longer posts may slow swipe behavior if the teaser is too dense. → Mitigation: separate teaser generation from full post generation and keep the feed card lightweight.
- [Risk] A daily knowledge bundle may grow too large as user history expands. → Mitigation: introduce a daily context builder that selects salient recent, related, and resurfaced knowledge rather than dumping all history into the prompt.

## Migration Plan

1. Introduce the richer post model and a daily context builder for AI post generation.
2. Add LLM-backed generation for daily posts and local caching/fallback behavior.
3. Refactor Home to display feed teasers that navigate to a full post page.
4. Add quick ask prompts and inline Q&A on the post page using post-context prompts.
5. Extend session/history handling so post-origin threads appear in Ask history and can be resumed later.
6. Validate that Home remains usable when AI generation is unavailable and that supporting loops remain secondary.

Rollback strategy:
- Revert to the current heuristic concept-feed implementation if the new generation flow proves unstable or too slow.
- Because this change is local state, navigation, and prompt logic, rollback can be handled as a code revert with local cache invalidation if needed.

## Open Questions

- Should daily posts be pre-generated on app open, at a scheduled moment, or lazily on first Home visit?
- How many posts per day best balance quality and novelty without making Home feel infinite?
- Should a post's inline Q&A thread be visible directly in the Ask screen preview, or only once the user opens the thread?
- How aggressively should the generator use playful devices such as jokes or mnemonics before trust starts to erode?
