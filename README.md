# 🌿 Trellis

**Trellis** (formerly EchoLearn) is a privacy-first, serverless mobile knowledge engine that transforms fragmented information into a living, growing garden of knowledge. Built with **React 19**, **TypeScript**, **Vite**, and **Capacitor 8**, it bridges the gap between passive consumption and active, long-term learning through AI-driven Q&A, visual mapping, and spaced repetition.

## 🍃 The Knowledge Garden
Trellis reimagines your personal knowledge base as a dynamic ecosystem. Every concept you explore becomes a plant on your **Trellis Tree**, where its visual health reflects your engagement and retention.

- **Dynamic States:** Leaves evolve from `bud` to `green`, `blossom`, and finally `fruit` as you master them. Neglected concepts turn `dying` or `dead`, signaling a need for review.
- **Botanical Actions:** Maintain your garden with `Heal` (reviewing overdue nodes), `Re-plant` (refreshing context), or `Prune` (archiving outdated concepts).
- **Harvest Mechanics:** Collecting ripe `fruit` from your tree awards credits, turning learning into a tangible "harvest" of expertise.

## ✨ Key Features

- **🌐 Web-Augmented "Ask":** Deep Q&A with an LLM that autonomously decides when to use the `web_search` tool for real-time grounding. Features include inline citations, source links, and a persistent session state that stays mounted across navigation.
- **📱 Discovery Feed:** A social-media-style feed of AI-generated "Concept Cards." Uses a weighted mix of visual styles: image-forward cards, creative text-art typography, YouTube video embeds, portrait-format Shorts, and daily newspaper-style news summaries.
- **📊 Cluster-Aware Knowledge Graph:** Interactive mind maps powered by **Mind Elixir**, organizing thousands of nodes into academic anchors and distinct concept clusters.
- **🎙️ Daily Podcast:** Automatically generates a personalized learning podcast summarizing your day's reviews and new discoveries.
- **⚡ Token Analytics:** Real-time observability dashboard for tracking LLM cost and performance per service.
- **🛠️ Intelligent Planner:** A "Signal-Aware" priority engine that suggests optimized learning actions (Review, Explore, Deep Dive) based on your unique learning trajectory.

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 19 (Hooks-based), React Router 7, Tailwind CSS 4.
- **Native Bridge:** Capacitor 8 (High-performance Android/iOS/Web).
- **Persistence:** Local-first SQLite (`capacitor-community/sqlite`) with localStorage fallbacks.
- **Animations:** Organic "ambient sway" and tactile feedback using **Framer Motion** and **Capacitor Haptics**.
- **AI Ecosystem:** Modular providers for OpenAI, Claude, Gemini, and Local LLMs (LM Studio/Ollama), plus Nano Banana for image generation.

## 📂 Project Structure

- `/app/src/components`: Atomic UI components and feature-specific structures.
- `/app/src/services`: Business logic (Ask, Review, Trellis Tree, Planner, YouTube, News).
- `/app/src/providers`: LLM, STT, TTS, Images, and Embedding connectors.
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
npx cap open android # Open Android Studio
```

## 🗺️ Roadmap
Trellis has successfully shipped **v1.3 (Milestone: Trellis Visuals & i18n)**. Current efforts are focused on **Milestone 2: Dynamic Learning Orchestration**, including the `LearningOrchestrator` and advanced Socratic diagnostic dialogues.

See [ROADMAP.md](ROADMAP.md) for macro-level planning or `.planning/ROADMAP.md` for granular phase tracking.

---
*Built with ❤️ for lifelong learners.*
