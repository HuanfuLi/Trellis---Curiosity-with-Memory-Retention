# Domain Pitfalls: Engagement Features in Learning Apps

**Project:** EchoLearn v1.1 (Rednote-style feed, image generation, auto-suggestions)
**Domain:** Learning + Social + Mobile + AI Integration
**Researched:** 2024-12
**Focus:** Image generation, infinite scroll, suggestions, mobile performance, privacy

---

## Critical Pitfalls (Cause Rewrites or Major Regressions)

### 1. Infinite Scroll Infinite Loading Loop (No Bottom Detection)

**What goes wrong:** The feed never terminates. Users scroll, new items load, they scroll more, more items load — but the app has no mechanism to detect "end of available data." Results in wasted bandwidth, memory growth, and frozen UX as the app tries to paginate beyond what exists.

**Why it happens:**
- Missing sentinel value in query (last-loaded-id or offset/limit pagination)
- Server/query returns empty array but client treats it as "keep going"
- No tracking of "seen items" — accidental duplicates in infinite loop
- Confusing "loading state" with "error state" — keeps retrying

**Consequences:**
- Memory exhaustion on older phones (v1.1 targets Android 8+, iOS 11+)
- Battery drain (constant network requests)
- Janky UX (frame drops as DOM grows to thousands of items)
- User inability to reach end-of-feed states (breaks planner workflows)

**Prevention:**
- Implement explicit sentinel: `hasMore` flag from backend, or `items.length < pageSize` (end of data)
- Track `lastSeenId` or `nextCursor` — never load the same page twice
- On empty page response, set `hasMore = false` immediately
- Deduplicate client-side using Set of IDs before rendering
- Add hard limit: max 300-500 items in DOM, virtualizing beyond that

**Detection:**
- Monitor: "User scrolled >20 screens with >0 load requests per screen"
- Alert: Feed DOM has >1000 items
- Metric: If `pageSize = 10` and user scrolled 50 screens, query results should show items 0-500 (not repeating)

**Prevention Phase:** Phase 1 (Feed Infrastructure) — unit test with endpoint returning empty vs. partial results

---

### 2. Image Generation Rate Limiting Breaks User Flow Without Fallback

**What goes wrong:** Nano Banana or Gemini image generation hits rate limit mid-session. UI shows "Loading..." forever, user retries, more requests queue, system backs off, and users see loading spinners for 10+ minutes. No cached fallback, no graceful degradation, no clear error messaging.

**Why it happens:**
- Using single API key (quota shared across user base or time window)
- No queue/backoff strategy — naive retry loops hammer API
- No caching layer — every suggestion triggers a fresh image generation request
- Error state not distinct from loading state (UI says "Loading..." for both)
- Assuming image generation is always fast (<2 seconds) during development

**Consequences:**
- User frustration with perceived app "hanging"
- Cascading failures (user retries → more requests → longer backoff → cascading retries)
- Suggestion feature feels unreliable
- Mobile users on slow networks give up (no timeout handling)
- Battery drain from stuck async operations

**Prevention:**
- Implement tiered strategy:
  1. Try live generation (Gemini/Nano Banana with 3-second timeout)
  2. On rate limit: Return placeholder + queue for background generation (success notification later)
  3. Never block the UI — show skeleton + "Will be ready soon" message
- Cache generated images by prompt hash (SQLite BLOB storage on device)
- Detect and reject duplicate requests within 30 seconds
- Clear, distinct error UI: "Image generation paused. Retry?" (vs. loading spinner)
- Use exponential backoff with jitter: wait 1s, 2s, 4s, then give up after 16s
- Respect rate-limit headers: `Retry-After` header tells you exactly when to try again
- Batch requests: if user generates 3 suggestions, don't fire 3 image requests simultaneously

**Detection:**
- Alert: More than 3 retries for single image in 60 seconds
- Metric: `image_generation_timeout_rate > 5%`
- Metric: Uncached image requests for same prompt within 10 minutes
- Log: Every image generation request (timestamp, prompt, provider, latency, status)

**Implementation Pattern:**
```typescript
// GOOD: Timeout + queue fallback
async function generateImage(prompt: string, card: Card) {
  const cached = await imageCache.get(hashPrompt(prompt));
  if (cached) return cached;

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Generation timeout')), 3000)
  );

  try {
    const image = await Promise.race([
      geminiClient.generateImage(prompt),
      timeoutPromise
    ]);
    await imageCache.set(hashPrompt(prompt), image);
    return image;
  } catch (error) {
    // Queue for background retry, don't block UI
    backgroundQueue.enqueue({ prompt, cardId: card.id });
    return null; // Let UI show placeholder
  }
}

// BAD: Blocking loop
while (!imageReady) {
  try {
    imageReady = await generateImage(prompt);
  } catch (e) {
    // Infinite retries, no backoff, blocks UI
  }
}
```

**Prevention Phase:**
- Phase 1 (Feed + Image Gen): Implement caching layer in database schema
- Phase 1: Add timeout constants and error state to UI components
- Phase 2: Add background queue infrastructure (Capacitor Background Tasks or similar)

---

### 3. Poor Suggestion Algorithm Recommendations Erode Trust Quickly

**What goes wrong:** Auto-generated planner suggestions are boring (always "review old cards"), irrelevant (suggesting topics user already mastered), or repetitive (same suggestions every day). Users see "suggested by AI" and ignore it, then stop trusting any automated recommendations. Trust erosion is fast (2-3 bad suggestions), recovery is slow (requires weeks of good suggestions).

**Why it happens:**
- Algorithm only looks at "due for review" → always suggests review
- Ignores user's learning velocity or mastery signals
- No diversity heuristic — suggests same topic multiple times
- No freshness signal — always picks "oldest unreviewed item"
- Suggestion doesn't account for time of day or session context
- Suggesting advanced topics to beginners, vice versa
- No A/B test baseline: no measurement of suggestion quality

**Consequences:**
- Users disable auto-suggestions
- Planner feature perceived as "not smart"
- No engagement lift from auto-suggestions (defeats v1.1 goal)
- Users revert to manual planner moves (breaks orchestration strategy)
- User churn if suggestions feel repetitive/stale

**Prevention:**
- Multi-signal ranking:
  1. **Diversity (40%)**: If you suggested "Biology" yesterday, bias toward different category
  2. **Relevance (30%)**: Score by user engagement history — suggest what user actually engages with
  3. **Spaced interval (20%)**: Prefer items at "optimal review interval" (SRS logic) over arbitrary recency
  4. **Challenge (10%)**: Add 1-2 "stretch" items (harder topics) to mix, but not >20% of suggestions
- Freshness: Never suggest same item twice within 7 days
- Time-of-day: Suggest lighter reviews at 8am (easier wake-up), deeper dives at 8pm (focused time)
- Track suggestion quality metric: `(suggestions_user_engaged_with / total_suggestions)` — aim for >40%
- Manual override: Show "Why was this suggested?" + easy "Not for me" feedback
- A/B test: Random 20% of users get "best guess" algorithm, 80% get "safe review" — measure engagement

**Detection:**
- Alert: Same suggestion appears twice in 7-day window
- Metric: Suggestion acceptance rate (did user click and interact?) — track weekly
- Metric: Suggestion category distribution — ensure variety, not just "review"
- User feedback: "Show me why" button on every suggestion captures qualitative data

**Anti-Pattern Example (What to Avoid):**
```typescript
// BAD: Always suggests oldest unreviewed
function suggestCard() {
  return cards.filter(c => !c.reviewedToday)
    .sort((a, b) => a.lastReviewAt - b.lastReviewAt)
    [0]; // Always picks oldest
}

// GOOD: Multi-signal scoring
function suggestCard(user: User) {
  const scores = cards.map(card => ({
    card,
    score:
      diversityScore(card, lastSuggestions) * 0.4 +
      relevanceScore(card, user) * 0.3 +
      spacedIntervalScore(card) * 0.2 +
      challengeBoost(card, user.mastery) * 0.1
  }));
  const topCard = scores.sort((a, b) => b.score - a.score)[0];
  
  // Ensure variety
  if (scores[0].score - scores[1].score < 0.1) {
    return scores[Math.floor(Math.random() * 3)]; // Randomize close scores
  }
  return topCard;
}
```

**Prevention Phase:**
- Phase 2 (Planner Suggestions): Define scoring algorithm before implementation
- Phase 2: Add suggestion quality tracking from day 1
- Phase 3+: Add user feedback loop ("Why this?" + reactions)

---

### 4. Breaking Existing Workflows: Planner Auto-Refresh During Active Review

**What goes wrong:** Planner suggestions auto-refresh every day at 3am UTC (or some fixed time). User is in the middle of a review session at 2:59am, system refreshes, suggestions change mid-session, user's planned learning path is now different. Or: user was reviewing "Biology" and suddenly sees "History" suggestions pop in, breaking focus.

**Why it happens:**
- Suggestion refresh is time-based (cron job), not lifecycle-aware
- No concept of "active learning session" — system doesn't know user is in the middle of something
- Suggestion refresh doesn't throttle while app is in foreground
- No debouncing: if user opens Planner 10 times in 5 minutes, system refreshes 10 times

**Consequences:**
- User loses context ("Wait, where was I?")
- User confusion about what they were supposed to learn
- Breaks spaced repetition flow (the core learning mechanism)
- Users manually revert to old suggestions (defeating automation)
- User frustration with "app changed my plan"

**Prevention:**
- Never refresh suggestions while:
  - User is in active Review or ASK session (track session state)
  - App is in foreground (check `AppState.currentAppState` in Capacitor)
- Use lifecycle-aware refresh:
  - Only refresh on app launch (not mid-session)
  - Or refresh at idle time (no activity for 2+ minutes)
  - Or refresh when user explicitly opens Planner (user-triggered)
- Add "Suggestion refresh" event logging: log when/why suggestions changed
- Debounce: if suggestions refresh trigger fires multiple times in 5 min, batch into single refresh
- User communication: If suggestions do change during session, show toast: "Suggestions updated. Continue learning or view changes?"

**Implementation Pattern:**
```typescript
// BAD: Cron-based, doesn't know about user state
setInterval(async () => {
  await plannerService.refreshSuggestions(); // Fires even during review!
}, 24 * 60 * 60 * 1000);

// GOOD: Lifecycle-aware
async function refreshSuggestionsIfSafe() {
  const appState = await App.getState();
  if (appState.isActive && !learningSession.isActive) {
    await plannerService.refreshSuggestions();
  }
}

// On app resume
App.addListener('appStateChange', async (state) => {
  if (state.isActive && !learningSession.isActive) {
    await refreshSuggestionsIfSafe();
  }
});

// Or: user-triggered only
function openPlanner() {
  // Refresh ONLY if user opened Planner, not automatically
  refreshSuggestions();
}
```

**Prevention Phase:**
- Phase 1 (Architecture): Define "learning session" state in AppProvider
- Phase 2 (Planner Suggestions): Implement lifecycle-aware refresh checks
- Phase 2: Add session state to logging/analytics

---

### 5. Cached Images Cause Storage Bloat and Battery Drain

**What goes wrong:** Every suggested card includes an AI-generated image. Images cached to SQLite BLOB or device filesystem. After 1 week: user has 500+ cached images (50-200 MB). After 1 month: 1-2 GB. Device storage warnings appear. App slow. Battery drain from I/O. System eventually deletes app cache without warning.

**Why it happens:**
- No image size limits — full resolution Gemini images (1000x1000+px) cached naively
- No cache eviction policy — images never deleted
- No storage quota checks — app doesn't know how much space is left
- Assuming unlimited device storage (ignores low-end phones with 32-64 GB)
- Caching without deduplication — same image stored multiple times under different IDs

**Consequences:**
- User uninstalls app due to storage warning
- App slowness (DB queries scan large BLOB table)
- Battery drain (Android/iOS background task scanning cache)
- App crashes on cache queries (OOM on low-memory devices)
- User data loss if OS clears app cache without permission

**Prevention:**
- Implement strict image policy:
  - Resize to max 400x400px (sufficient for card display, 80% size reduction)
  - Use WEBP format (30% smaller than PNG)
  - Compress to quality 75-80 (imperceptible on mobile, 40% smaller)
- Add cache size limit: max 50MB (roughly 200 images at 250KB each)
- Implement LRU eviction:
  - Track `lastAccessedAt` for each cached image
  - On cache size >50MB, delete oldest 10% of images
  - Fallback: regenerate on-demand (cached prompt + generation is fast if deduplicated)
- Check available storage before caching:
  - If <100MB free, skip caching (regenerate later)
  - Warn user if cache >30MB
- Deduplicate: Store image once per prompt hash, reference by ID (not duplicate copies)
- Database cleanup task: Daily, remove unused images (not referenced by any card in last 30 days)

**Implementation Pattern:**
```typescript
// Image storage with size limits
const IMAGE_CACHE_LIMIT_MB = 50;
const IMAGE_MAX_SIZE = 400;
const IMAGE_QUALITY = 80;

async function cacheImage(prompt: string, imageBlob: Blob) {
  // Check space
  const cacheSize = await getImageCacheSizeBytes();
  if (cacheSize + imageBlob.size > IMAGE_CACHE_LIMIT_MB * 1024 * 1024) {
    // Evict oldest
    const oldest = await db.query(
      `SELECT id FROM images ORDER BY lastAccessedAt ASC LIMIT 0,10`
    );
    for (const img of oldest) {
      await db.run(`DELETE FROM images WHERE id = ?`, [img.id]);
    }
  }

  // Compress before storage
  const compressed = await compressImage(imageBlob, {
    maxWidth: IMAGE_MAX_SIZE,
    maxHeight: IMAGE_MAX_SIZE,
    quality: IMAGE_QUALITY,
    format: 'webp'
  });

  // Store with deduplication
  const promptHash = sha256(prompt);
  await db.run(
    `INSERT OR REPLACE INTO images (promptHash, data, createdAt, lastAccessedAt)
     VALUES (?, ?, datetime('now'), datetime('now'))`,
    [promptHash, compressed]
  );
}
```

**Prevention Phase:**
- Phase 1 (Image Gen): Define image size/format strategy before first image generation
- Phase 1: Add cache size monitoring to analytics
- Phase 2: Implement LRU eviction policy (can be added anytime without breaking changes)

---

### 6. Privacy Bleed: Image Generation Prompts Sent to APIs Without Sanitization

**What goes wrong:** Prompt contains sensitive user data (medical symptoms, personal struggles, names of people). Prompt sent to Gemini or Nano Banana unencrypted (or worse, logged by API provider). User learns that their private learning data is being sent to third-party APIs. Trust violation.

**Why it happens:**
- Image generation prompt is just raw card content + suggestion context
- No sanitization: card might say "Remember: John's phone number is 555-1234"
- No user consent: feature added without explaining data flow
- No local-first fallback: required to use third-party API for every image
- Assuming "it's just images" — but prompts are full learning context

**Consequences:**
- User trust violation (specifically problematic for "privacy-first" brand)
- Potential data breach if API provider is compromised
- Regulatory issue (GDPR, CCPA if user is EU/CA resident)
- User disables feature or leaves app
- Reputational damage ("Privacy-first app sends private data to Google")

**Prevention:**
- Sanitization strategy:
  1. Never include names, identifiers, or sensitive keywords in prompt
  2. Use only card title + category + vague concept description
  3. Example: ❌ "Draw image for John's heart surgery notes" → ✅ "Draw image for medical procedure learning card"
- Add privacy shield:
  - Offer local-only image option: use default illustrations instead of generated images
  - Or use on-device image generation (if feasible) for sensitive topics
  - Or let users opt-out of image generation per card/topic
- Consent + transparency:
  - First time user enables image generation, show: "Images generated using Gemini AI. Your learning content will be sent to Google. [Learn more] [Enable] [Skip]"
  - In settings, show which APIs data is sent to, allow per-API toggle
  - In privacy policy, explicitly list "Image generation" as data-sharing practice
- API provider safety:
  - Use APIs that don't log prompts (or have logging disabled in contract)
  - Check provider's privacy policy before using
  - For Nano Banana: verify no persistent logging
  - For Gemini: use non-Business key if available (different terms)
- No API keys in client code:
  - Use backend proxy (server-to-server API calls)
  - Prevents key leakage in app source code

**Detection:**
- Audit: Every image generation prompt that's logged — manually review for sensitive data
- Automated check: Scan prompts for PII patterns (names, phone numbers, emails, medical terms)
- User feedback: "I'm not comfortable sending this data" button on image generation
- Metric: Image generation opt-out rate — if >5%, investigate privacy concerns

**Prevention Phase:**
- Phase 0 (Architecture): Design image generation to use backend proxy, not client API keys
- Phase 1 (Image Gen): Add sanitization function to prompt builder
- Phase 1: Add privacy consent screen before first image generation
- Phase 1: Document data flow in privacy policy

---

## Moderate Pitfalls (Cause Significant UX Issues, Not Total Rewrites)

### 7. Infinite Scroll: Missing/Skipped Items Due to Race Conditions

**What goes wrong:** User scrolls fast, loads page 2, item loads, scrolls back up, items have shifted position. Scrolls back down, page 3 loads at same time as page 2 response arrives (race condition). Duplicate items appear, or items mysteriously skip.

**Why it happens:**
- Multiple concurrent pagination requests (user scrolls faster than responses arrive)
- No request deduplication — if user triggers page 2 load twice, both requests fire
- No sequencing: page 3 response arrives before page 2, items rendered out of order
- State management doesn't track pending requests — doesn't know if page 2 is already loading

**Consequences:**
- User confusion ("Did I see this card before?")
- Missed learning content (user doesn't notice cards got skipped)
- Janky UX (items appear, disappear, reorder)
- Breaking trust in data integrity (feels buggy)

**Prevention:**
- Add request queue + deduplication:
  - Track `currentPageLoading` and `nextPageToLoad`
  - If user scrolls while page 2 is loading, don't fire another page 2 request
  - Only fire next request after current completes
- Add abort controller:
  - If user scrolls back up fast, abort page 3 request in progress
  - Let completed responses settle before allowing new requests
- Add sequence numbers:
  - Tag each page response with sequence ID
  - On receive, if sequence ID < current, discard (out of order)
- No race conditions:
  ```typescript
  let currentPage = 1;
  let isLoading = false;
  
  async function loadNextPage() {
    if (isLoading) return; // Prevent concurrent requests
    isLoading = true;
    const response = await fetch(`/feed?page=${currentPage + 1}`);
    currentPage += 1;
    isLoading = false;
  }
  ```

**Prevention Phase:**
- Phase 1 (Feed Infrastructure): Add request deduplication from start
- Phase 1: Unit test concurrent scroll + race conditions

---

### 8. Accessibility: Image-Heavy Feed Excludes Visually Impaired Users

**What goes wrong:** Rednote-style feed is image-forward, minimal text. Screen readers see images with no alt text. Users with visual impairments can't participate in engagement feature (defeat purpose of "accessible learning").

**Why it happens:**
- Prioritizing visual design over accessibility
- AI image generation prompts don't translate to good alt text
- No text fallback: if image fails to load, user sees nothing
- Animated cards/transitions cause motion sickness for vestibular sensitivity
- Color-only design (e.g., status by color) fails for colorblind users

**Consequences:**
- Legal: Potential ADA violation (if in US)
- Ethical: Exclude users who depend on accessibility features
- Practical: Users with accessibility needs uninstall
- Brand damage ("Inclusive app" claim undermined)

**Prevention:**
- Alt text strategy:
  - Generate meaningful alt text from card content, not image
  - Example: Card title + category + suggestion reason
  - Bad: `<img alt="generated image" src="..." />`
  - Good: `<img alt="Photosynthesis concept card. Suggested for biology review." src="..." />`
- AI-generated alt text:
  - If image generated from prompt, use prompt as base for alt text
  - Or use vision API to describe image and generate alt text
- Text fallback:
  - If image fails: show text summary of card instead of blank
  - Never show broken image icon without fallback content
- Motion considerations:
  - Add `prefers-reduced-motion` media query detection
  - Disable animations if user has `prefers-reduced-motion: reduce`
  - Example: Card entrance animation can be disabled
- Color + contrast:
  - Never convey status by color alone (e.g., red = due, green = mastered)
  - Add text labels or icons in addition to colors
  - Ensure text contrast ratio ≥4.5:1 (WCAG AA standard)
- Screen reader testing:
  - Test feed with VoiceOver (iOS) and TalkBack (Android)
  - Ensure card order makes sense when read aloud
  - Check link/button focus order

**Prevention Phase:**
- Phase 1 (Feed Design): Define accessibility requirements in spec
- Phase 1: Add screen reader testing to QA checklist
- Phase 1: Add `prefers-reduced-motion` support to all animations

---

### 9. Design Fatigue: Visual Variety Runs Out, Feed Feels Repetitive

**What goes wrong:** Expanded card designs include 3-4 layouts (title + image, image-first, text-focused, etc.). First 50 cards, users enjoy variety. After 100 cards, pattern becomes obvious. After 200 cards, same layouts repeat. Users say "feed feels the same every day" despite algorithmic diversity.

**Why it happens:**
- Limited layout variations (only 3-4 patterns)
- Same visual hierarchy repeats (title always top-left, image always right)
- No semantic variety: all cards are "study suggestions" (same intent)
- No content type variety: all are learning cards (no quiz, no milestone, no achievement)
- Color palette too limited or repetitive
- No time-based variation (Monday != Friday, morning != evening)

**Consequences:**
- User engagement plateau (initial spike, then drop)
- Perceived "staleness" despite fresh content
- Users stop opening engagement feed
- Less time in app (goal of engagement feature fails)

**Prevention:**
- Extend layout variety:
  - Don't just change image placement; vary card height, typography, density
  - Example patterns: "Title first + image", "Image full-width", "Side-by-side + metadata", "Minimal text + large visual"
  - Aim for 6-8 distinct layouts, rotated throughout feed
- Add semantic variety:
  - Mix content types: 70% learning suggestions, 20% milestones/achievements, 10% discovery items
  - Example: "Completed 50 reviews in Biology this week" → celebration card
  - Or: "Suggested learning path" (not single card) → collection view
- Time-based variation:
  - Morning (6am-12pm): Lighter, briefer cards + motivational messaging
  - Afternoon (12pm-6pm): Deeper cards, connections, multi-step suggestions
  - Evening (6pm-10pm): Review-focused, recap suggestions
- Color strategy:
  - Use category colors (not just card colors) to vary feed
  - If card is Biology, use green accents; History = orange, etc.
  - Prevents "all blue cards" fatigue
- Randomized non-visual breaks:
  - Occasionally show empty state or "Take a break" message
  - Or show "What to do next" prompt (interactive engagement)
- Measurement:
  - Track "feed open frequency" weekly
  - If drop >20% week-to-week after launch, investigate design fatigue
  - Survey: "Does the feed feel repetitive?" — track sentiment

**Prevention Phase:**
- Phase 2 (Card Design Expansion): Define 6+ layout variations in design spec
- Phase 2: Implement time-of-day and content-type variation logic
- Phase 3: Add engagement metrics to detect fatigue trends

---

### 10. Mobile Performance: Virtual Scroll Not Implemented, Infinite Scroll Tanks FPS

**What goes wrong:** Infinite scroll loads 50+ cards into DOM without virtualization. Each card has image, text, interactions. React renders all 50. Frame rate drops to 10 FPS. Phone heats up. Users can't scroll smoothly. Older phones (Android 8) lag significantly.

**Why it happens:**
- Naive rendering: `cards.map(card => <Card key={id} />)` renders all cards
- No windowing: all cards in viewport, not just visible ones
- Image rendering: Each card loads image without lazy loading
- Event listeners: Every card has click handlers + touch handlers, 50+ listeners added to DOM
- JavaScript memory: Card state duplicated in React tree + Redux/Context

**Consequences:**
- Unusable on low-end phones (defeats "mobile-first" goal)
- Battery drain (sustained high GPU usage)
- Jank perception (users think app is buggy, not just slow)
- User frustration leads to uninstall

**Prevention:**
- Implement virtual scrolling:
  - Use library like `react-window` or `recyclerlistview`
  - Only render cards visible in viewport + buffer (e.g., ±3 cards above/below)
  - For 50 cards in feed, render only 8-10 at once
  - Massive FPS improvement (60 FPS on mid-range phones)
- Lazy load images:
  - Use `Loading.lazy` or Intersection Observer
  - Don't load image until card about to appear in viewport
  - Defer heavy image rendering until needed
- Optimize rendering:
  - Memoize Card component: `React.memo(Card)` prevents re-renders if props unchanged
  - Use `useCallback` for event handlers (don't create new function on each render)
  - Profile with React DevTools: check for unnecessary re-renders
- Reduce bundle size:
  - Each card component should be <10KB (including styles)
  - Lazy load image library if using (e.g., Blurhash for placeholders)
- Testing:
  - Test on real device: Android 8 (Pixel 2) or iPhone SE (1st gen)
  - Use Chrome DevTools Performance tab or React Profiler
  - Target: 60 FPS for scroll, <100ms interaction latency

**Implementation Pattern:**
```typescript
// GOOD: Virtual scroll with React Window
import { FixedSizeList } from 'react-window';

function FeedList({ cards }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={cards.length}
      itemSize={200}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <Card card={cards[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}

// GOOD: Lazy load images
function CardImage({ src }) {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef();

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting)
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return isVisible ? (
    <img ref={ref} src={src} />
  ) : (
    <div ref={ref} className="placeholder" />
  );
}

// BAD: No virtualization, renders all 50 cards
function FeedList({ cards }) {
  return (
    <div>
      {cards.map(card => <Card key={card.id} card={card} />)}
    </div>
  );
}
```

**Prevention Phase:**
- Phase 1 (Feed Infrastructure): Use virtualization library from start (not bolt-on)
- Phase 1: Performance testing on target low-end device
- Phase 1: Set FPS budget (target 60 FPS for scroll)

---

### 11. UX Feedback: No Clear Loading/Error States for Async Image Generation

**What goes wrong:** Image generation takes 2-5 seconds (API latency). Card shows skeleton, then image appears. But no loading indicator, no "Generating..." message. User thinks image failed to load. Or: API errors (rate limit), UI shows skeleton forever, user doesn't know if it's loading or broken.

**Why it happens:**
- Skeleton screen designed but no loading state messaging
- No distinct error states: blank = loading = error (all look the same)
- No timeout messaging: if generation takes >5 seconds, no feedback to user
- No retry affordance: user doesn't know they can tap to retry

**Consequences:**
- User confusion about app state
- User attempts to retry manually (hammers API)
- Perceived sluggishness (no feedback = feels broken)
- User frustration leads to poor review/rating

**Prevention:**
- Clear state hierarchy:
  - **Loading**: Skeleton + "Generating image..." (subtle animation)
  - **Success**: Image appears with smooth fade-in
  - **Error**: Skeleton replaced with icon + "Image not available" + [Retry] button
  - **Timeout**: Show placeholder + "Image generation delayed" + [Try Again]
- Timeout messaging:
  - If generation >3 seconds: show "Still generating..."
  - If generation >10 seconds: show "This is taking longer than expected" + suggest offline placeholder
- Retry affordance:
  - Always show [Retry] button in error state
  - Or allow tap-to-retry on placeholder
- Distinct visual states:
  - Don't use same skeleton for loading and error
  - Use colored indicators: gray = loading, red = error, green = success
- Messaging clarity:
  - "Loading..." is vague. Better: "Generating image..." (explains what's happening)
  - Helps user understand why wait time exists

**Implementation Pattern:**
```typescript
function CardWithImage({ card, prompt }) {
  const [state, setState] = React.useState('loading');
  const [image, setImage] = React.useState(null);

  React.useEffect(() => {
    let timeout;
    generateImage(prompt)
      .then(img => {
        setState('success');
        setImage(img);
      })
      .catch(err => {
        setState('error');
        // Show error after 10 seconds of loading
        timeout = setTimeout(() => {
          setState('timeout');
        }, 10000);
      });
    return () => clearTimeout(timeout);
  }, [prompt]);

  return (
    <div className="card">
      {state === 'loading' && (
        <div className="skeleton">
          <div className="pulse">Generating image...</div>
        </div>
      )}
      {state === 'timeout' && (
        <div className="placeholder">
          <p>Image generation delayed</p>
          <button onClick={() => setState('loading')}>Try Again</button>
        </div>
      )}
      {state === 'error' && (
        <div className="error">
          <p>Image unavailable</p>
          <button onClick={() => setState('loading')}>Retry</button>
        </div>
      )}
      {state === 'success' && <img src={image} alt={card.title} />}
    </div>
  );
}
```

**Prevention Phase:**
- Phase 1 (Card UI): Design all 4 states (loading, success, error, timeout) in Figma
- Phase 1: Implement state machine in card component (use XState if complex)

---

## Mobile-Specific Pitfalls

### 12. Network Interruption: No Offline Handling for Infinite Scroll

**What goes wrong:** User on cellular connection scrolls feed, network drops briefly. Pagination request hangs. UI shows loading spinner indefinitely. User scrolls more, more requests queue. Network returns, all requests retry at once, causing cascade of requests and memory spike.

**Why it happens:**
- No network state detection (doesn't know connection dropped)
- No request timeout: waits forever for response
- No retry strategy: dropped requests just hang
- No offline cache: can't show previously loaded items while offline

**Consequences:**
- Broken UX during network hiccup
- User frustration (nothing loads)
- Wasted data if user gives up and retries manually

**Prevention:**
- Detect network state:
  ```typescript
  import { Network } from '@capacitor/network';
  
  Network.addListener('networkStatusChange', status => {
    if (!status.connected) {
      showOfflineMessage();
      pauseFeedLoading();
    } else {
      hideOfflineMessage();
      resumeFeedLoading();
    }
  });
  ```
- Add request timeout:
  - Set max 10-second timeout for pagination requests
  - On timeout, show "Network error, please try again" (not infinite spinner)
  - Abort controller prevents queuing
- Retry strategy with backoff:
  - Retry once immediately on network error
  - Then wait 2 seconds + show retry message
  - Don't retry automatically, let user tap [Retry]
- Offline cache:
  - Cache feed items to SQLite on successful load
  - Show cached items while offline (label as "Cached")
  - Disable retry when offline (show "Your device is offline")
- Batch retry:
  - If multiple requests failed while offline, batch into single retry (not multiple)
  - Prevents cascade when network returns

**Prevention Phase:**
- Phase 1 (Feed Infrastructure): Add Network listener + state management
- Phase 1: Add request timeout to all API calls
- Phase 2: Implement offline cache (can be added later)

---

### 13. Battery Drain: Background Image Regeneration Tasks Never Finish

**What goes wrong:** Image generation rate-limited mid-session, queued for background retry. App put in background. Background task scheduled but never executes (iOS limitations, Android Doze mode). Task retry loop somehow wakes device repeatedly. User notices 50% battery drain in 2 hours.

**Why it happens:**
- Background task scheduling not respecting OS constraints
- iOS: background tasks must complete in <30 seconds
- Android: Doze mode (API 21+) restricts background execution
- Retry loops that wake device without condition
- No cancellation: queued tasks pile up, never cleared

**Consequences:**
- Battery drain user complaint
- User disables image generation feature
- App uninstalled if battery drain is severe
- Poor app store rating ("Drains my battery")

**Prevention:**
- Use proper background task API:
  - iOS: Use `BGProcessingTaskRequest` with `requiresNetworkConnectivity`
  - Android: Use `WorkManager` (respects Doze mode)
  - Capacitor: `@capacitor/background-tasks` plugin
- Constraints:
  - Only retry if device has good battery (>20%)
  - Only retry if connected to WiFi or good cellular signal
  - Only retry if not in Doze mode
- Task limits:
  - Max 3 retries per image (then give up)
  - Max 5 background tasks active at once
  - Cancel old tasks if they've been pending >24 hours
- Monitoring:
  - Log all background task execution (timestamp, duration, outcome)
  - Alert if background task takes >10 seconds (might be waking device repeatedly)
  - User opt-out: "Skip background image generation" setting

**Prevention Phase:**
- Phase 2 (Background Sync): Use proper OS background task API
- Phase 2: Add battery/network constraint checks
- Phase 3: Add background task monitoring + logging

---

### 14. Low Memory: App Crashes After Scrolling 100+ Cards on Mid-Range Device

**What goes wrong:** Mid-range Android phone (2GB RAM) with EchoLearn + other apps running. User scrolls feed for 10 minutes, loads 150+ cards. Each card loaded into memory. JavaScript heap grows to 500MB. System kills app (OOM). User loses session progress.

**Why it happens:**
- No virtual scrolling (all 150 cards in memory)
- Image caching without cleanup (150 images × 250KB = 37.5MB)
- Card state duplicated in React + Redux/Context
- No garbage collection hinting
- Memory leak in image loading (event listeners not cleaned up)

**Consequences:**
- App crash mid-session (user loses progress)
- User frustration (especially on low-end phones)
- Data loss if session state not persisted

**Prevention:**
- Virtual scrolling (highest priority):
  - Reduces active cards in memory from 150 to ~10
  - Massive memory savings
- Image memory management:
  - Limit image resolution (400x400px max)
  - Use compressed format (WEBP, not PNG)
  - Implement cache eviction (delete oldest images if >50MB)
- State optimization:
  - Don't store full card objects in Redux
  - Store IDs, lazy-load details on render
  - Use React Context only for small data (not entire feed)
- Cleanup on unmount:
  - Cancel in-flight requests
  - Remove event listeners
  - Clear timers
  ```typescript
  React.useEffect(() => {
    return () => {
      abortController.abort();
      imageElement?.removeEventListener('load', handleLoad);
      clearTimeout(loadTimeout);
    };
  }, []);
  ```
- Monitor memory:
  - Periodic `performance.memory` check (Chrome DevTools)
  - Alert if heap >200MB
  - Log OOM crashes to analytics

**Prevention Phase:**
- Phase 1 (Feed): Virtual scroll from start (not retrofit)
- Phase 1: Memory profiling on mid-range device (target: <150MB heap)
- Phase 2: Implement image cache eviction

---

## Accessibility & Inclusive Design Pitfalls

### 15. Color-Only Status Indicators: Colorblind Users Can't Tell Card Status

**What goes wrong:** Cards use color to show status: red = due for review, green = mastered, blue = new. User with red-green colorblindness can't distinguish due vs. mastered cards. Feature becomes inaccessible.

**Why it happens:**
- Visual design prioritizes color coding for aesthetic
- No text labels or icons (relies solely on color)
- Assumption that color is universally understood

**Consequences:**
- Feature completely inaccessible to ~8% of male population (color blindness prevalence)
- User frustration: can't distinguish cards by status
- Legal risk (ADA violation if in US)

**Prevention:**
- Always add text + icon in addition to color:
  - Red card: Red badge + "Due Today" text + due icon (📌)
  - Green card: Green badge + "Mastered" text + checkmark icon (✓)
  - Blue card: Blue badge + "New" text + star icon (⭐)
- Use colorblind-safe palette:
  - Avoid pure red/green combinations
  - Use colors like blue, orange, purple (distinguishable for all colorblindness types)
- Test with colorblind simulator:
  - Use Chrome DevTools "Render" tab → "Emulate CSS media feature prefers-color-scheme"
  - Or use external tool: https://www.color-blindness.com/coblis-color-blindness-simulator/

**Prevention Phase:**
- Phase 1 (Card Design): Always include text + icon + color (no color-only states)
- Phase 1: Add colorblind testing to design review checklist

---

## Data & State Management Pitfalls

### 16. Stale Suggestion State: User Disables Auto-Suggestions, Still Appears Because State Not Cleared

**What goes wrong:** User goes to settings and disables "Daily suggestions". Next day, suggestions still appear in planner. Or: user provides feedback "Don't suggest this topic", but same topic suggested again next week.

**Why it happens:**
- User preference not propagated to suggestion algorithm
- Stale cache: suggestions computed before user changed setting
- No invalidation trigger: setting change doesn't clear cached suggestions
- Different component/service owns "user preferences" vs. "suggestion computation"

**Consequences:**
- User thinks setting doesn't work
- Frustration with app ("I turned it off but it keeps showing")
- User distrust of settings/customization

**Prevention:**
- Centralized preference management:
  - Single source of truth: `userPreferences.autoSuggestionsEnabled`
  - All suggestion services check this flag before showing
  - Don't cache preferences in multiple places
- Cache invalidation:
  - On setting change, emit event: `PreferenceUpdated('autoSuggestionsEnabled')`
  - All subscribers refresh: clear cached suggestions, recompute if needed
  - Example: PlannnerService listens, clears suggestion cache
- Explicit apply:
  - Settings change doesn't auto-apply for "dangerous" changes
  - Show confirmation: "Turn off daily suggestions? You can enable anytime."
  - Clear cached suggestions on confirmation
- Persistence:
  - Save preference to SQLite immediately on change
  - On app restart, load preference and validate
  - Example: localStorage can be cleared by OS, SQLite persists

**Prevention Phase:**
- Phase 1 (Architecture): Define preference storage + event system
- Phase 1: Add invalidation pattern to suggestion service

---

## Pitfall Prevention Checklist

| Pitfall | Phase | Responsible | Prevention Method |
|---------|-------|-------------|-------------------|
| 1. Infinite scroll loop | P1 (Feed) | Eng | Implement `hasMore` flag, deduplicate by ID, hard limit on DOM items |
| 2. Image generation rate limit | P1 (Image Gen) | Eng | Timeout 3s, queue fallback, cache by prompt hash, distinct error UI |
| 3. Poor suggestions | P2 (Planner) | Product/Eng | Multi-signal ranking, diversity heuristic, A/B test baseline, quality metric |
| 4. Planner refresh during session | P2 (Planner) | Eng | Lifecycle-aware refresh, only on app launch or user trigger |
| 5. Image storage bloat | P1 (Image Gen) | Eng | Max 50MB cache, resize to 400x400, WEBP format, LRU eviction |
| 6. Privacy data leak | P0 (Architecture) | Security/Eng | Sanitize prompts, backend proxy, user consent, no API keys in client |
| 7. Infinite scroll race conditions | P1 (Feed) | Eng | Request deduplication, abort controller, sequence numbers |
| 8. Accessibility: No alt text | P1 (Design) | Design/Eng | Generate alt text from card content, test with screen reader |
| 9. Design fatigue | P2 (Card Design) | Design | 6+ layout variations, semantic variety, time-based variation |
| 10. Mobile performance | P1 (Feed) | Eng | Virtual scroll from start, lazy load images, memoize components, target 60 FPS |
| 11. UX feedback (loading/error) | P1 (Card UI) | Design/Eng | 4 distinct states: loading, success, error, timeout; clear messaging |
| 12. Network offline | P1 (Feed) | Eng | Network state listener, 10s timeout, offline cache, retry strategy |
| 13. Battery drain | P2 (Background) | Eng | Use WorkManager/BGTask, battery + network constraints, max 3 retries |
| 14. Low memory OOM | P1 (Feed) | Eng | Virtual scroll, image cache limit, state optimization, garbage collection |
| 15. Color-only status | P1 (Card Design) | Design | Add text + icon + color, test colorblind simulation |
| 16. Stale suggestion state | P1 (Architecture) | Eng | Centralized preferences, cache invalidation events, explicit confirm |

---

## Testing Strategy

### Unit Tests
- Infinite scroll: test duplicate detection, `hasMore` logic, empty response handling
- Image cache: test size limits, eviction policy, compression
- Suggestions: test multi-signal scoring, diversity, freshness
- Preference system: test state changes, cache invalidation

### Integration Tests
- Feed load → image generation → scroll → rate limit → retry
- Planner suggestion → user rejects → next day refresh (does it appear again?)
- Network interruption → resume → no cascade retry
- App background → refresh scheduled → app foreground (does it interfere?)

### Performance Tests
- Virtual scroll: scroll 200 cards, target <100ms layout time, 60 FPS
- Image cache: 300 cards with images, max 500MB heap
- Memory: load feed for 10 min, no OOM on mid-range device
- Battery: 1 hour background task, <5% battery drain

### Accessibility Tests
- Screen reader: Navigate feed with VoiceOver/TalkBack, all cards readable
- Colorblind: Use simulator, all status indicators distinguishable
- Motion sensitivity: Disable animations with `prefers-reduced-motion`, animations don't play
- Contrast: Text color contrast ≥4.5:1 (WCAG AA)

### User Testing
- Suggestion quality: Show 10 users 20 suggestions, measure engagement rate
- Design fatigue: Daily active users trend over 4 weeks (should plateau, not drop)
- Privacy concerns: Ask 5 users if comfortable with image API calls
- Offline experience: Test on slow 3G, simulate network dropout

---

## References & Context

- **Spaced Repetition Risk**: Learning is the core EchoLearn feature. Any engagement feature that disrupts SRS workflows undermines product value. Test that suggestions don't interfere with active review sessions.
- **Privacy-First Brand**: EchoLearn positions as "privacy-first, local-first." Image generation that sends data to APIs directly contradicts brand promise. Privacy must be baked into design, not retrofit.
- **Mobile-First**: Target low-end phones (Android 8, 2GB RAM). Performance issues on low-end = failure. Virtual scroll and cache management not optional.
- **AI Integration Risk**: Image generation failure modes (rate limits, timeouts, sanitization) are new to the codebase. Treat as high-risk feature. Extra testing required.
- **User Trust in Algorithms**: Suggestion algorithm quality directly impacts trust in orchestration engine (Milestone 2 goal). Boring/irrelevant suggestions poison the well for future features.

