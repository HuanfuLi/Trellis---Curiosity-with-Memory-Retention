# Project Description: Trellis

**Trellis** is an AI-powered personalized learning platform designed to facilitate non-linear knowledge acquisition through AI-driven content generation, visual knowledge mapping, and spaced repetition. It bridges the gap between passive content consumption and active, long-term learning by organizing information into a living "Knowledge Garden."

## Core Vision
Trellis aims to provide a "second brain" for learners, where information is not just stored but actively integrated into their mental models. It leverages Large Language Models (LLMs) to generate personalized learning paths, answer complex questions, and create engaging content like AI-generated podcasts, image-forward discovery feeds, and the interactive Trellis Tree.

## Key Features

### 1. AI-Powered "ASK" & Contextual QA
- **Contextual Exploration**: Users can ask questions about concepts, and the system provides AI-generated answers grounded in their existing knowledge base.
- **Web-Augmented Answers**: The LLM has access to a `web_search` tool and autonomously decides when to search for current information. Users can also force web search via a globe toggle. Responses include inline citation tags and a sources section.
- **Deep Dives & Threading**: True multi-turn conversation sessions enable deep dives into specific sub-topics, intelligently linking responses to prior interactions without polluting context windows.
- **Persistent Sessions**: The Ask screen is always mounted, preserving session state, streaming progress, and scroll position across navigation.

### 2. The Trellis Tree & Visual Mapping
- **Anime Knowledge Tree**: A dynamic, SVG-based "Trellis" that visualizes the health of your knowledge. Each concept is a plant on a vine whose leaf state (`bud`, `green`, `dying`, `falling`, `dead`, `blossom`, `fruit`) reflects engagement and retention.
- **Anchors & Clusters**: Large networks are organized into academic anchor nodes and distinct concept clusters. The UI groups questions dynamically into distinct hierarchies, reducing visual noise while permitting infinite drill-down.
- **Botanical Actions**: Users can `Heal`, `Re-plant`, or `Prune` nodes to maintain their garden, with a `Harvest` mechanic for rewarding mastery.

### 3. AI-Generated Concept Feed
- **Visual Discovery Posts**: AI generates "posts" that break down complex topics accompanied by contextual AI-generated imagery (infographs, illustrations, or photos).
- **Multi-Style Presentation**: A weighted mix algorithm assigns visual styles — image cards, text-art typography, YouTube video embeds, short video portraits, and newspaper-style news cards — creating a visually diverse feed.
- **Web-Sourced News**: Daily background Tavily-powered news fetch with LLM summarization, rendered as newspaper-style cards with source attribution.
- **YouTube Integration**: Auto-fetched video and Shorts content interleaved into the feed with responsive embeds and portrait-format cards.

### 4. Review & Spaced Repetition (SRS)
- **Automated Flashcards**: The system generates robust flashcards directly from the knowledge graph and cluster summaries.
- **Targeted Cluster Reviews**: Allows users to dynamically study targeted clusters of related knowledge, supported by SQLite-backed trajectory tracking.

### 5. Learning Planner & Chunks
- **Auto-Suggestions Engine**: The Planner intelligence engine suggests highly optimized actions (Review, Explore, Concept Deep Dives) based on performance and trajectory decay.
- **Signal-Aware Priority**: Ranks "Weak Areas" alongside "Overdue" reviews utilizing +30 scale boosting methodologies.

### 6. Developer Token Optimization & Performance
- **Cost Minimization**: LLM interactions support append-only prefix caching and explicitly shed heavy generic behaviors during continuous Q&A to preserve provider KV-cache hits.
- **Token Analytics**: Real-time observability dashboard within Settings monitors exact usage across active services.

## Tech Stack

- **Framework**: [React](https://react.dev/) (v19) with [TypeScript](https://www.typescriptlang.org/)
- **Native Bridge**: [Capacitor](https://capacitorjs.com/) (v8)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4)
- **Database**: [SQLite](https://github.com/capacitor-community/sqlite) with `localStorage` fallback.
- **Animations**: [Framer Motion](https://www.framer.com/motion/) for organic swaying and tactile UI.
- **AI Providers**: Core connectors for Anthropic (Claude), Google Gemini, OpenAI, and local backends (LM Studio/Ollama).

## Current Status (May 2026)
Trellis has completed **Milestone 1.3: Trellis Visuals & i18n**. The app now features a fully interactive SVG knowledge tree, web search with citations, and a multi-style discovery feed. Milestone 2 (Dynamic Learning Orchestration) is currently in the planning and early implementation phase.
