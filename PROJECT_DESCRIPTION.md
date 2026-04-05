# Project Description: EchoLearn

EchoLearn is an AI-powered personalized learning platform designed to facilitate non-linear knowledge acquisition through AI-driven content generation, visual knowledge mapping, and spaced repetition. It bridges the gap between passive content consumption and active, long-term learning by organizing information into "canonical knowledge," "learning chunks," and "concept clusters."

## Core Vision
EchoLearn aims to provide a "second brain" for learners, where information is not just stored but actively integrated into their mental models. It leverages Large Language Models (LLMs) to generate personalized learning paths, answer complex questions, and create engaging content like AI-generated podcasts, image-forward discovery feeds, and connection cards.

## Key Features

### 1. AI-Powered "ASK" & Contextual QA
- **Contextual Exploration**: Users can ask questions about concepts, and the system provides AI-generated answers grounded in their existing knowledge base.
- **Web-Augmented Answers**: The LLM has access to a `web_search` tool and autonomously decides when to search for current information. Users can also force web search via a globe toggle. Responses include inline citation tags and a sources section.
- **Deep Dives & Threading**: True multi-turn conversation sessions enable deep dives into specific sub-topics, intelligently linking responses to prior interactions without polluting context windows.
- **Persistent Sessions**: The Ask screen is always mounted, preserving session state, streaming progress, and scroll position across navigation.

### 2. Knowledge Graph & Visual Mapping
- **Mind Elixir Integration**: Visualizes the relationships between different concepts using an interactive mind-map interface.
- **Anchors & Clusters**: Large networks are organized into academic anchor nodes and distinct concept clusters. The UI groups questions dynamically into distinct hierarchies, reducing visual noise while permitting infinite drill-down.
- **Non-Linear Navigation**: Traverse your knowledge base spatially via an interactive bottom panel and breadcrumb routing.

### 3. AI-Generated Concept Feed
- **Visual Discovery Posts**: AI generates "posts" that break down complex topics accompanied by contextual AI-generated imagery (infographs, illustrations, or photos).
- **Multi-Style Presentation**: A weighted mix algorithm assigns visual styles — image cards, text-art typography, YouTube video embeds, short video portraits, and newspaper-style news cards — creating a visually diverse feed.
- **Web-Sourced News**: Daily background Tavily-powered news fetch with LLM summarization, rendered as newspaper-style cards with source attribution.
- **YouTube Integration**: Auto-fetched video and Shorts content interleaved into the feed with responsive embeds and portrait-format cards.
- **Carousel & Infinite Scroll**: Posts are digestible through visual carousels with smooth interaction and swipe-gestures.
- **Connection Cards**: Highlights semantic relationships between seemingly unrelated topics to foster multidisciplinary understanding.

### 4. Review & Spaced Repetition (SRS)
- **Automated Flashcards**: The system generates robust flashcards directly from the knowledge graph and cluster summaries.
- **Targeted Cluster Reviews**: Allows users to dynamically study targeted clusters of related knowledge, supported by SQLite-backed trajectory tracking to preserve scheduling across sessions.

### 5. Learning Planner & Chunks
- **Auto-Suggestions Engine**: The Planner intelligence engine suggests highly optimized actions (Review, Explore, Concept Deep Dives) based on performance and trajectory decay.
- **Signal-Aware Priority**: Ranks "Weak Areas" alongside "Overdue" reviews utilizing +30 scale boosting methodologies. Actionable chunk cards denote exact origin intents (e.g. "From your check-in: 'I am confused by...'").

### 6. Developer Token Optimization & Performance
- **Cost Minimization**: LLM interactions support append-only prefix caching and explicitly shed heavy generic behaviors during continuous Q&A to preserve provider KV-cache hits.
- **Token Analytics**: Real-time observability dashboard within Settings monitors exact usage across active services for local or proxy model connections.

## Design Philosophy & UX

EchoLearn prioritizes a high-quality, "native-first" mobile experience, avoiding the "web-wrapped" feel through several key principles:
- **Visual Theme**: Uses a Material You-inspired "Nature & Growth" theme with a consistent semantic palette.
- **Tactile Feedback**: Incorporates physical responses like "active-squish" to buttons and utilizes Capacitor Haptics.
- **Mobile-Optimized Layout**: Implements safe area padding (notches, home bars) and hides content during load to prevent stutter.

## Tech Stack

- **Framework**: [React](https://react.dev/) (v19) with [TypeScript](https://www.typescriptlang.org/)
- **Native Bridge**: [Capacitor](https://capacitorjs.com/) (v8)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4)
- **Database**: [SQLite](https://github.com/capacitor-community/sqlite) with `localStorage` fallback.
- **Knowledge Visualization**: [Mind Elixir](https://mind-elixir.com/)
- **AI Providers**: Core connectors for Anthropic (Claude), Google Gemini, OpenAI, and local backends (LM Studio/Ollama), plus Nano Banana endpoints for visual image generation.

## Project Structure

- `app/src/components/`, `app/src/screens/`, `app/src/services/`, `app/src/providers/`, `app/src/state/`
- `.planning/`: Active iteration roadmaps and specification phases.
- `Documents/`: Historical change logs, evaluations, and archives.

## Current Status (April 2026)
EchoLearn completed **Milestone 1.1: Engagement & Discovery Iteration** and has continued through Phases 17–19. Phase 17 added YouTube video integration into the feed. Phase 18 redesigned the feed with weighted presentation styles (text-art, short videos, image cards). Phase 19 introduced web search capabilities for both the Ask screen (LLM tool-use with inline citations) and the Home feed (daily news posts). Phase 20 (Orchestration Strategy & Diagnostic Dialogue) is in planning.
