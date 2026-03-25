## 1. Define post data and daily generation

- [x] 1.1 Add a richer AI-authored post model that separates feed teaser content from full post-page content and includes narrative metadata plus quick ask prompts
- [x] 1.2 Create a daily knowledge-context builder that collects recent questions, relevant older knowledge, and graph relationships for feed generation
- [x] 1.3 Implement LLM-backed daily post generation that produces a bounded set of posts with varied narrative modes from the daily knowledge bundle
- [x] 1.4 Add local caching and deterministic fallback behavior so Home remains usable when AI generation is unavailable

## 2. Build the post feed and post page flow

- [x] 2.1 Refactor Home to render AI-authored teaser cards instead of heuristic concept summaries
- [x] 2.2 Add navigation from teaser cards into a dedicated full post page
- [x] 2.3 Implement the full post page layout to display the complete essay-like post content and supporting context

## 3. Add contextual post Q&A

- [x] 3.1 Add quick ask chips and freeform input beneath the full post page
- [x] 3.2 Implement post-context prompt construction so follow-up answers continue from the post instead of starting generic chat
- [x] 3.3 Render Q&A inline beneath the post page as a persistent thread for that post

## 4. Archive and resume post-origin threads

- [x] 4.1 Extend session/history models to preserve post-origin metadata for inline post Q&A threads
- [x] 4.2 Archive post-origin threads into Ask history and surface them as resumable conversations
- [x] 4.3 Support reopening a post-origin thread from Ask history and continuing it with the preserved post context

## 5. Verify quality and boundaries

- [x] 5.1 Verify generated posts are longer and richer than the current heuristic summaries while still producing lightweight feed teasers
- [x] 5.2 Verify the daily feed uses broader knowledge context and narrative variation rather than single-question truncation
- [x] 5.3 Verify podcast and calendar remain supporting loops rather than becoming primary Home entry points in this change
- [x] 5.4 Add or update targeted tests for daily post generation, post-context prompt construction, and post-origin session archival where the codebase supports them
