# Trellis Roadmap (v2.0 Path)

- [x] [Milestone 1.0: Learning Loop Foundation](.planning/milestones/v1.0-ROADMAP.md) - Shipped 2026-03-25.
- [x] [Milestone 1.1: Engagement & Discovery Iteration](.planning/ROADMAP.md) - Shipped 2026-04-02. Phases 7–16: image-forward feeds, intelligent planner auto-suggestions, cluster-aware anchor graphs, portal navigation, and LLM token pipeline optimizations.
- [x] [Milestone 1.3: Trellis Visuals & i18n](Documents/CHANGELOG_4_16.md) - Shipped 2026-04-16. Phases 17–26: YouTube integration, weighted feed styles, web search with citations, and the SVG-based "Trellis" knowledge tree.

## Milestone 1.1+ (Continued Iteration)

*Phase numbering continues from Milestone 1.1's conclusion at Phase 16.*

- [x] **Phase 17: Auto-Fetch Online Videos for Posts** — Shipped 2026-04-02.
  - YouTube Data API v3 integration with `youtube.service.ts` for video search, caching, and background generation.
  - Video cards interleaved into the concept feed with thumbnail overlays and channel metadata.
  - `YouTubeEmbed` component for responsive 16:9 playback in PostDetailScreen.
  - YouTube API key configurable in Settings.

- [x] **Phase 18: Feed Redesign, Short Videos & Text-Art Posts** — Shipped 2026-04-04.
  - Weighted presentation mix algorithm assigning visual styles (`image`, `text-art`, `video`, `short`, `news`) to posts.
  - Text-art cards with large creative typography, deterministic color themes, and emoji placement.
  - YouTube Shorts integration with portrait-format cards, full-bleed thumbnails, and inline playback.
  - Presentation style persistence in cache to prevent feed reshuffling.

- [x] **Phase 19: Web Search Integration for Ask and Feed** — Shipped 2026-04-05.
  - LLM tool-use pattern: `web_search` tool in system prompt, LLM autonomously decides when to search.
  - Globe toggle for manual web search override in Ask screen.
  - Two-pass streaming with inline "Searching the web..." indicator and citation-augmented responses.
  - Inline `[N]` citation tags as muted superscript with always-visible sources section.
  - News service with daily Tavily-powered background fetch, LLM summarization, and newspaper-style feed cards.
  - Persistent AskScreen (always mounted) preserving session state across navigation.
  - Markdown sanitization with `rehype-sanitize` for defense-in-depth.

## Milestone 2: Dynamic Learning Orchestration & Diagnostic Dialogue

- [ ] **Phase 20: Orchestration Strategy & Diagnostic Dialogue**
  - Define `OrchestrationStrategy` and `LearningOrchestrator` interfaces.
  - Implement `TrajectoryObserver` aggregating data from Review, Question, and Feed services.
  - Replace static Check-In with broader Socratic conversational UI.
  - Refactor Planner to serve rich "Portals" as unified subject gateways.

See `.planning/ROADMAP.md` for granular phase tracking and plan-level progress.
