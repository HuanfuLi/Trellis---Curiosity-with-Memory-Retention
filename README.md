# EchoLearn: AI-Powered Personalized Learning

EchoLearn is a serverless, privacy-first mobile knowledge management application built with **React 19**, **TypeScript**, **Vite**, and **Capacitor 8**. It helps users transform fragmented information into a structured knowledge base using AI-driven contextual Q&A, interactive mind maps, auto-generated flashcards, and spaced repetition.

## Key Features

- **Web-Augmented Q&A:** Ask questions with optional web search — the LLM autonomously decides when to search or users can force it via a globe toggle. Responses include inline citation tags and a sources section with links.
- **Rich Concept Feed:** AI-generated posts with multiple visual styles — image cards, text-art typography, YouTube video embeds, short video portraits, and newspaper-style news cards from daily web headlines.
- **Cluster-Aware Knowledge Graph:** Mind maps organized into aggregated cluster nodes and anchors for navigating complex domains.
- **Intelligent Planner:** Auto-suggests optimal learning actions based on trajectory data, weak areas, and check-in context.
- **Contextual Q&A Threading:** Multi-turn session history for continuous learning without redundant context.
- **Token Optimization Tracking:** Real-time LLM cost analytics per service in Developer settings.
- **Spaced Repetition (SRS):** Automated flashcard generation, scheduling, and targeted cluster reviews.
- **Persistent Sessions:** Ask screen preserves conversation state across navigation — no lost sessions mid-stream.

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 19 (Hooks-based), React Router 7, Tailwind 4.
- **Native Bridge:** Capacitor 8 (Cross-platform Android/iOS/Web).
- **Persistence:** Local-first SQLite (`capacitor-community/sqlite`) plus localStorage fallbacks.
- **Animations:** Custom CSS keyframes and Framer Motion context layouts.
- **AI Providers:** Modular wrappers for OpenAI, Claude, Gemini, Local models (LM Studio), and image-generation endpoints.

## 📂 Project Structure

- `/app/src/components`: UI components and shared structures.
- `/app/src/services`: Business logic (Ask, Review, Planner, Podcast, Web Search, News, Token Tracker).
- `/app/src/providers`: LLM, STT, TTS, Images, and Embedding.
- `.planning`: Active roadmaps, phase specifications, and milestone logs.
- `Documents`: Validation logs, UAT testing scripts, and historic change logs.

## 🛠️ Development

### Prerequisites
- Node.js (v18+)
- Android Studio / Xcode (for mobile builds)

### Core Commands
```bash
cd app
npm install         # Install dependencies
npm run dev         # Start web development server
npm run build       # Build for production
npx cap sync        # Sync web build to native platforms
```

## Roadmap
The project has shipped **v1.1 (Engagement & Discovery Iteration)** and continued through Phases 17–19 adding YouTube video integration, text-art/short video feed redesign, and web search capabilities. Phase 20 (Orchestration Strategy & Diagnostic Dialogue) is planned next.

See [ROADMAP.md](ROADMAP.md) for macro-level planning or `.planning/ROADMAP.md` for granular phase tracking.

---
*Built with ❤️ for lifelong learners.*
