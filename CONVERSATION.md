# EchoLearn Bug Report & Technical Debt Assessment

This report identifies critical bugs, logic errors, and integration gaps in the EchoLearn codebase as of March 22, 2026.

## 1. Critical Behavioral Bugs

### A. Flashcard Shadowing & Knowledge Loss
*   **Location:** `app/src/services/flashcard.service.ts` (`getAll()`, `getDue()`) and `app/src/services/canonical-knowledge.service.ts` (`getProjectedFlashcards()`).
*   **Issue:** The `flashcardService` prioritizes "projected" cards (dynamically created from Mind Map/Question nodes) over "extracted" cards (manually saved from chat sessions). If a user has even a single Question in their knowledge base, `getProjectedFlashcards` returns data, causing `loadAll()` (which reads extracted cards from `localStorage`) to be entirely ignored.
*   **Impact:** All flashcards generated from chat sessions become invisible as soon as the first question is asked. This breaks the core "Integrated Knowledge Loop."

### B. Interrupted Session Processing
*   **Location:** `app/src/screens/AskScreen.tsx` (`startNewSession()`).
*   **Issue:** Flashcard extraction (`processSession`) is only triggered for the *previous* session when a user explicitly clicks "New Chat" or navigates from a prompt. 
*   **Impact:** If a user finishes a chat and simply closes the app, navigates to "Home", or switches screens, the session is never processed. This leads to silent knowledge loss from chat interactions.

### C. Fragile SQLite Persistence
*   **Location:** `app/src/services/question.service.ts` and `app/src/services/db.service.ts`.
*   **Issue:** `localStorage` is treated as the primary store, with SQLite as a fire-and-forget write-through helper (`void persistToSQLite(...)`). `hydrateFromSQLite()` is only called on app mount. 
*   **Impact:** If `localStorage` is cleared while the app is running, or if the background write fails, data becomes inconsistent. There is no centralized migration strategy; `CREATE TABLE` calls are scattered across multiple services.

### D. LocalStorage Quota Risk (Podcasts)
*   **Location:** `app/src/services/podcast.service.ts` (`generatePodcast()`).
*   **Issue:** Podcasts are persisted as base64 `dataUri` strings in `localStorage` to survive reloads. The code guards for 3MB per podcast, but `localStorage` is typically limited to 5MB total.
*   **Impact:** Saving just two podcasts can crash `localStorage` for the entire app, preventing new questions, sessions, or settings from being saved.

## 2. Logic Errors & Inconsistencies

### A. Dead Code: Embeddings
*   **Location:** `app/src/services/graph.service.ts` and `app/src/services/question.service.ts`.
*   **Issue:** `graphService.similarity` contains logic for Cosine Similarity using embeddings, but `questionService` never generates or stores embeddings. The LLM prompts do not request them.
*   **Impact:** The graph always falls back to Jaccard keyword overlap. The embedding logic is currently dead code and misleading.

### B. Post-Context Q&A Disconnect
*   **Location:** `app/src/screens/AskScreen.tsx` (`generateAiReply()`).
*   **Issue:** When a user chats about a Daily Post, the app uses `postContextQaService.askStreaming`. Unlike `questionService.ask`, this path does not create `Question` nodes.
*   **Impact:** Insights gained during post-context Q&A are never integrated into the Mind Map or the Review system.

### C. Race Conditions in AskScreen
*   **Location:** `app/src/screens/AskScreen.tsx` (`handleSend` / `didAutoSend`).
*   **Issue:** `generateAiReply` is not awaited in several callers. While a `generatingRef` guard exists, the lack of proper async orchestration can lead to stale state updates if navigation or unmounting occurs during a stream.

## 3. Unconnected Methods & Missing Integrations

*   **Graph Reinforcement:** `graphService.reinforceEdge` (the "Aha!" reinforcement) is implemented but never called by any UI component.
*   **Automatic Flashcard Refresh:** `useReview` subscribes to `FLASHCARDS_CREATED`, but `AskScreen` doesn't consistently trigger `processSession` at the right lifecycle points.
*   **Centralized Derivation:** `deriveTitleFromQuestion` is exported from `questionService` but manually called in `AskScreen`. It should probably be part of a unified ingestion pipeline.

## 4. Proposed Fixes for Implementation Agents

1.  **Refactor `flashcard.service.ts`**: Merge projected and extracted cards in `getAll()` and `getDue()` instead of choosing one.
2.  **Move `processSession`**: Trigger flashcard extraction on `useEffect` cleanup or when a session is marked inactive, rather than waiting for a "New Chat" click.
3.  **Centralize DB**: Move all DDL/Migration logic into `db.service.ts`.
4.  **Integrate Post Q&A**: Ensure `postContextQaService` can optionally promote a thread to a `Question` node.
5.  **Fix Podcast Storage**: Use `Capacitor.Filesystem` for audio blobs on native instead of `localStorage`.

---

## Fix Plan

### Fix 1: Flashcard Shadowing — Merge projected + extracted cards

**Bug:** `flashcardService.getAll()` (line 94–97) and `getDue()` (line 99–104) use an either/or pattern: if `getProjectedFlashcards()` returns any cards, `loadAll()` (extracted cards from localStorage) is entirely ignored.

**Root cause:** The ternary `projected.length > 0 ? projected : loadAll()` was written assuming projected and extracted cards were mutually exclusive. They aren't — users can have both question-derived cards and chat-session-extracted cards.

**Plan:**
1. In `app/src/services/flashcard.service.ts`, change `getAll()` to merge both sources:
   ```ts
   getAll(): FlashCard[] {
     const projected = getProjectedFlashcards(questionService.getAll());
     const extracted = loadAll();
     // Deduplicate by id (projected cards use `node-` prefix, so no collision expected)
     const seen = new Set(projected.map(c => c.id));
     return [...projected, ...extracted.filter(c => !seen.has(c.id))];
   },
   ```
2. Apply the same merge logic to `getDue()`:
   ```ts
   getDue(): FlashCard[] {
     const t = today();
     const projected = getDueProjectedFlashcards(questionService.getAll());
     const extracted = loadAll().filter(c => c.pinned || c.reviewSchedule.nextReviewDate <= t);
     const seen = new Set(projected.map(c => c.id));
     return [...projected, ...extracted.filter(c => !seen.has(c.id))];
   },
   ```

**Files:** `app/src/services/flashcard.service.ts` (lines 94–104)

---

### Fix 2: Interrupted Session Processing — Trigger on navigation/unmount

**Bug:** `processSession` is only called inside `startNewSession()` (line 37–52 of AskScreen.tsx), which only fires when the user clicks "New Chat" or auto-sends from navigation state. If the user navigates away via BottomNavigation, closes the app, or goes to Home, the session is never processed for flashcard extraction.

**Root cause:** The processing lifecycle is tied to a UI action ("New Chat") instead of to the session lifecycle (session becoming inactive).

**Plan:**
1. Add a `useEffect` cleanup in `AskScreen` that processes the current session on unmount:
   ```ts
   // In AskScreen component body, after sessionRef setup:
   useEffect(() => {
     return () => {
       const current = sessionRef.current;
       if (
         !current.processed &&
         current.messages.some(m => m.type === 'user') &&
         !processingSessionIds.has(current.id)
       ) {
         processingSessionIds.add(current.id);
         void flashcardService.processSession(current).then(() => {
           const refreshed = sessionService.getById(current.id);
           if (refreshed) {
             sessionService.save({ ...refreshed, processed: true });
           }
         }).finally(() => {
           processingSessionIds.delete(current.id);
         });
       }
     };
   }, []);  // Empty deps — runs only on unmount
   ```
2. Also process when switching sessions via `handleSelectSession`:
   - Before loading the new session, call the same processing logic on the current session (if unprocessed).

**Files:** `app/src/screens/AskScreen.tsx`

---

### Fix 3: Fragile SQLite Persistence — Centralize DDL in db.service.ts

**Bug:** `CREATE TABLE` statements are duplicated — `db.service.ts:SQLiteBackend._runMigrations()` (lines 34–48) creates `questions` and `edge_weights` tables, while `question.service.ts:ensureQuestionsTable()` (lines 22–30) independently creates the same `questions` table. There's no migration versioning.

**Root cause:** Each service was built independently with its own table-creation guard, without a central migration registry.

**Plan:**
1. Move all DDL into `db.service.ts:_runMigrations()` (already partially there). Add any missing tables.
2. In `question.service.ts`, remove the standalone `ensureQuestionsTable()` function and its `sqliteReady` guard. Replace calls to it with a simple `await getDB()` which already runs migrations on init.
3. Update `persistToSQLite` and `deleteFromSQLite` in `question.service.ts` to call `getDB()` directly instead of `ensureQuestionsTable()`:
   ```ts
   function persistToSQLite(question: Question) {
     void dbExecute('INSERT OR REPLACE INTO questions (id, data) VALUES (?, ?)', [
       question.id,
       JSON.stringify(question),
     ]);
   }
   ```
4. Add a `DB_VERSION` constant and a `migrations` table in `db.service.ts` for future-proofing:
   ```ts
   // In _runMigrations():
   await this.execute(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)`);
   // Check current version, run incremental DDL as needed
   ```

**Files:** `app/src/services/db.service.ts`, `app/src/services/question.service.ts`

---

### Fix 4: localStorage Quota Risk — Move podcast audio to Capacitor Filesystem

**Bug:** Podcast audio is stored as base64 `dataUri` in localStorage (`podcast.service.ts` line 177–179). Each podcast can be ~3MB; localStorage is typically 5MB total. Two podcasts can crash all localStorage writes app-wide.

**Root cause:** localStorage was used as a quick cross-reload persistence mechanism without accounting for the shared quota.

**Plan:**
1. On native (Capacitor), use `@capacitor/filesystem` to write audio blobs to the app's data directory:
   ```ts
   import { Filesystem, Directory } from '@capacitor/filesystem';
   import { Capacitor } from '@capacitor/core';

   async function persistAudio(podcastId: string, blobUrl: string): Promise<string | undefined> {
     if (!Capacitor.isNativePlatform()) {
       // Web: still use dataUri but with a smaller threshold, or skip persistence
       return undefined;
     }
     const resp = await fetch(blobUrl);
     const blob = await resp.blob();
     const buffer = await blob.arrayBuffer();
     const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
     const path = `podcasts/${podcastId}.mp3`;
     await Filesystem.writeFile({ path, data: base64, directory: Directory.Data });
     return path;
   }
   ```
2. Replace the `audioDataUri` field in stored podcasts with an `audioFilePath` field on native.
3. On load, reconstruct blob URLs from file paths instead of from dataUri.
4. On web, either skip audio persistence entirely (ephemeral blob URLs only) or use IndexedDB as a fallback (no localStorage quota issue).
5. Update `deletePodcast` to also delete the file from Filesystem.

**Files:** `app/src/services/podcast.service.ts`, `app/src/types/index.ts` (DailyPodcast type)

---

### Fix 5: Dead Code — Remove embedding logic from graph.service.ts

**Bug:** `cosineSimilarity()` and the embedding branch in `similarity()` (`graph.service.ts` lines 8–49) are dead code. The `Question` type may declare an optional `embedding` field, but `questionService.ask()` never populates it — the LLM prompt doesn't request embeddings.

**Plan:**
1. Remove `cosineSimilarity()` function entirely.
2. Simplify `similarity()` to just call `keywordSimilarity()` directly.
3. Remove the `embedding` field from the `Question` type if it exists, or leave it as a no-op optional field if other code references it.
4. Add a `// TODO:` comment if embedding support is intended for the future.

**Files:** `app/src/services/graph.service.ts`, potentially `app/src/types/index.ts`

---

### Fix 6: Post-Context Q&A Disconnect — Create Question nodes from post threads

**Bug:** `postContextQaService.askStreaming()` returns raw streamed text but never creates `Question` nodes. Insights from post Q&A threads are invisible to the Mind Map and Review systems.

**Root cause:** `postContextQaService` was designed as a lightweight streaming wrapper without knowledge-graph integration.

**Plan:**
1. After a post-context AI reply is finalized in `AskScreen.generateAiReply()` (lines 114–118), call `questionService.buildAndSave()` to create a Question node:
   ```ts
   if (postOrigin) {
     for await (const token of postContextQaService.askStreaming(postOrigin.context, userContent)) {
       lastContent += token;
       setStreaming({ placeholderId, content: lastContent });
     }
     // Promote to knowledge graph
     if (lastContent) {
       question = questionService.buildAndSave(userContent, lastContent);
     }
   }
   ```
2. This ensures post-thread answers get keywords, related-question links, and review scheduling — the same as direct Ask questions.

**Files:** `app/src/screens/AskScreen.tsx` (lines 114–124)

---

### Fix 7: Race Conditions in AskScreen — Proper async orchestration

**Bug:** `generateAiReply` is fire-and-forget in `didAutoSend` useEffect (line 193: `void handleSend(prompt)`) and suggested-prompt buttons (line 395: `void handleSend(prompt)`). The `generatingRef` guard prevents concurrent calls, but stale closures and unmount-during-stream can cause React state updates on unmounted components.

**Plan:**
1. Add an `AbortController` pattern to `generateAiReply`:
   ```ts
   const abortRef = useRef<AbortController | null>(null);
   ```
   - Create a new controller at the start of each call; abort the previous one.
   - Check `signal.aborted` before each `setStreaming` / `setSession` call.
2. Cancel on unmount:
   ```ts
   useEffect(() => {
     return () => { abortRef.current?.abort(); };
   }, []);
   ```
3. This is a defense-in-depth measure — the persist-to-sessionService-first pattern (line 143–144) already ensures data safety. The abort just prevents React warnings.

**Files:** `app/src/screens/AskScreen.tsx`

---

### Fix 8: `graphService.reinforceEdge` never called from Review

**Bug:** `reinforceEdge` is implemented in `graph.service.ts` but only called from `HomeScreen.tsx` (line 100). The Review screen, where users actively demonstrate knowledge connections, never reinforces edges.

**Plan:**
1. In `ReviewScreen.tsx`, after a successful review (user rates a card), call `graphService.reinforceEdge()` between the reviewed card's question and its related questions:
   ```ts
   // After SM-2 schedule update:
   if (card.nodeId) {
     const question = questionService.getAll().find(q => q.id === card.nodeId);
     if (question) {
       question.relatedQuestionIds.forEach(relatedId => {
         graphService.reinforceEdge(question.id, relatedId);
       });
     }
   }
   ```

**Files:** `app/src/screens/ReviewScreen.tsx`

---

### Priority Order

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| P0 | Fix 1 (Flashcard shadowing) | Core feature broken — all extracted cards invisible | Small |
| P0 | Fix 2 (Session processing on unmount) | Silent knowledge loss on every normal app exit | Small |
| P1 | Fix 4 (Podcast localStorage quota) | Can crash all persistence app-wide | Medium |
| P1 | Fix 6 (Post Q&A → Question nodes) | Knowledge from post threads lost | Small |
| P2 | Fix 3 (Centralize DDL) | Data inconsistency risk, maintenance burden | Medium |
| P2 | Fix 7 (Race conditions / abort) | React warnings, minor stale-state risk | Small |
| P3 | Fix 5 (Dead embedding code) | Misleading code, no user impact | Small |
| P3 | Fix 8 (reinforceEdge in Review) | Missing feature, not a regression | Small |

---

## Fix Plan Analysis (March 22, 2026)

After reviewing the project documentation (`Documents/` and `openspec/`), I have analyzed the alignment of the proposed bug fixes with EchoLearn's core architectural goals.

### 1. Alignment with the "Integrated Knowledge Loop"
The project's primary aim is to turn ephemeral chat interactions into a **Canonical Knowledge Graph** that drives all other surfaces (Feed, Review, Podcast). 
- **Fix 1 (Flashcard Merging)** and **Fix 2 (Session Unmount Processing)** are **mission-critical**. The current shadowing and interrupted processing bugs directly break the "shared source of truth" requirement (from `canonical-knowledge-graph/spec.md`). Without these fixes, the "loop" is broken, and user effort is lost.
- **Fix 6 (Post Q&A Integration)** aligns with the requirement that "Post-origin Q&A SHALL be archived into Ask history" (`post-context-qa/spec.md`). By promoting these threads to Question nodes, we ensure that follow-up curiosity also feeds the long-term Mind Map.

### 2. Structural & Persistence Integrity
- **Fix 3 (Centralize DDL)** is necessary to fulfill the "Canonical knowledge nodes SHALL be the shared source of truth" requirement. Duplicated DDL and scattered persistence logic currently make the "Canonical" nature of the data fragile.
- **Fix 4 (Podcast Filesystem)** is a vital stability fix. The "Daily Podcast" feature (`ai-post-feed/spec.md`) is a key differentiator, but its current storage implementation poses a systemic risk to the entire `localStorage`-based persistence layer.

### 3. Feature Polish vs. Specification
- **Fix 5 (Remove Dead Embedding Code)** simplifies the codebase in line with the "Retrieval remains available without embeddings" requirement. While embeddings are a "nice-to-have," the current broken implementation adds unnecessary complexity.
- **Fix 8 (reinforceEdge in Review)** directly supports the "Review SHALL support co-creation through learning actions" requirement (`review-map/spec.md`). It turns memory ratings into "graph-shaping signals," fulfilling the vision that the knowledge map evolves through natural use.

### Conclusion
The proposed fix plan does not "break" any intended designs; rather, it **restores the intended architecture** that has been partially compromised by implementation gaps. These fixes are required to move the project from a set of disconnected features to the unified "Learning Assistant" envisioned in the documentation.
