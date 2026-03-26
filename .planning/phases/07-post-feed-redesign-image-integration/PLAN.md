# Phase 7 Execution Plan

**Post Feed Redesign & Image Integration**

## Overview

This phase transforms the Home Feed from a text-centric layout to an image-forward, Rednote-style design. We'll integrate AI image generation (Nano Banana + Gemini) with robust error handling and local caching.

**Estimated scope:** 5-7 working days  
**Primary focus:** Image generation pipeline, component redesign, caching layer

---

## Task Breakdown

### Wave 1: Foundation & Infrastructure (Days 1-2)

#### T1.1: Setup Image Generation Service
- Create `src/services/imageGeneration.service.ts`
- Define `ImageGenerationService` interface with methods:
  - `generateImage(prompt: string, style: string): Promise<ServiceResult<GeneratedImage>>`
  - `cacheImage(postId: string, images: GeneratedImage[]): Promise<void>`
  - `retrieveCachedImage(postId: string, style: string): Promise<GeneratedImage | null>`
  - `clearImageCache(): Promise<void>`
- Add to dependency injection / service registry
- **Acceptance:** Service exports all methods, no console errors on import

#### T1.2: Nano Banana API Client
- Create `src/providers/nanoBanana.provider.ts`
- Implement API authentication (API key from user settings)
- Implement image generation with retry logic (3 attempts max)
- Handle rate limiting gracefully (return error, don't crash)
- Return structured response: `{ imageUrl | imageBase64, style, prompt }`
- Add unit tests for success/failure paths
- **Acceptance:** API client successfully generates image with valid key, handles errors without crashing

#### T1.3: Gemini API Client
- Create `src/providers/gemini.provider.ts`
- Implement Google Gemini API integration (official SDK or REST)
- Mirror Nano Banana interface for consistency
- Implement as fallback provider (try Gemini if Nano Banana fails)
- Add unit tests
- **Acceptance:** Gemini client successfully generates images, integrates as fallback

#### T1.4: Image Caching Layer
- Extend `src/services/storage.service.ts` with image caching methods
- Implement localStorage-based cache with metadata:
  - `storageKey: img-cache-{postId}-{style}`
  - `metadata: { provider, generatedAt, expiresAt, size }`
- Implement LRU eviction when cache exceeds 50MB
- Add cache stats: `getCacheStats(): { size, itemCount, oldestItem }`
- **Acceptance:** Images persist across app restarts, cache size stays below limit

### Wave 2: UI Components & Layout (Days 2-3)

#### T2.1: FeedPostImage Component
- Create `src/components/Screens/FeedPostImage.tsx`
- Design component with:
  - Large image (200px+ height, responsive)
  - Emoji + title overlay (white text, semi-transparent background behind text)
  - Loading skeleton while image generates
  - Error state with retry button
  - Optimized for mobile (safe area aware)
- Use Tailwind CSS 4 + Framer Motion for smooth transitions
- **Acceptance:** Component renders correctly on mobile (375px, 600px+ widths), loading/error states visible

#### T2.2: Post Formatting Service
- Create `src/services/postFormatting.service.ts`
- Implement `generateOverlayText(post): { emoji, title }` logic
  - Extract category emoji (e.g., 🧠 for learning, 📚 for books)
  - Shorten title to 50 chars with ellipsis
  - Combine into overlay: `{emoji} {title}`
- Add style inference: `inferImageStyle(post): 'infograph' | 'illustration' | 'photo'`
  - Use post category or content length
  - Alternate styles across posts in feed
- **Acceptance:** Overlay text is readable, styles rotate visibly across feed

#### T2.3: Update FeedPost Component
- Modify `src/components/Screens/FeedPost.tsx`
- Replace text-only preview with `FeedPostImage` component
- Wire up image generation on post load:
  - Check cache first
  - Trigger generation async
  - Show loading state while generating
  - Handle errors gracefully
- Maintain backward compatibility (fallback to text if image fails)
- **Acceptance:** Feed posts display images, no visual regressions

#### T2.4: FeedScreen Integration
- Update `src/screens/FeedScreen.tsx`
- Pass new image props through FeedPost → FeedPostImage
- Add error boundary around image generation failures
- Test with 20+ posts in scroll (performance check)
- **Acceptance:** Feed scrolls smoothly with images, no jank or crashes

### Wave 3: API Integration & Error Handling (Days 3-4)

#### T3.1: Nano Banana Integration
- Add `NANO_BANANA_API_KEY` to user settings (Settings screen)
- Connect `NanoBananaProvider` to `ImageGenerationService`
- Implement request/response validation
- Add logging for debugging (but no sensitive data)
- Test with real API (or mock if quota limited)
- **Acceptance:** Images generate successfully with valid API key, errors handled gracefully

#### T3.2: Gemini Fallback Integration
- Add `GEMINI_API_KEY` to user settings
- Connect `GeminiProvider` as secondary in `ImageGenerationService`
- Implement fallback logic: if Nano Banana fails, try Gemini
- Add timeout handling (max 15s per request)
- **Acceptance:** Gemini generates images when Nano Banana fails/unavailable

#### T3.3: Error Handling & User Feedback
- Implement error states in `FeedPostImage`:
  - "Loading image..." (skeleton)
  - "Image generation failed. [Retry]" (error state)
  - "API key not configured" (if needed keys missing)
- Add toast notification for API errors
- Implement retry logic (exponential backoff)
- Log errors for debugging (non-sensitive)
- **Acceptance:** All error states visible, retry works, user never sees blank posts

#### T3.4: Rate Limiting & Quota Management
- Monitor API usage (requests per minute, daily quota)
- Show warning if approaching limits
- Gracefully handle 429/quota errors
- Add cache stats display in Settings
- **Acceptance:** No crashes from rate limiting, user aware of quota status

### Wave 4: Caching & Performance (Days 4-5)

#### T4.1: Image Cache Persistence
- Implement localStorage fallback + SQLite for larger datasets
- Store image metadata in SQLite:
  - postId, imageUrl, provider, generatedAt, expiresAt, size
- Implement expiration logic (images expire after 30 days TBD)
- **Acceptance:** Images persist across app restarts, metadata tracked

#### T4.2: Cache Optimization
- Compress images for storage (JPEG, 70% quality)
- Implement image lazy-loading (load only on-screen images)
- Pre-cache next 3 posts while scrolling
- Monitor storage usage and warn at 80% capacity
- **Acceptance:** Cache size stays under 50MB, no OOM errors

#### T4.3: Performance Tuning
- Measure image generation time per provider
- Optimize prompts for faster generation (shorter prompts)
- Profile feed scrolling (target 60 fps)
- Test with 100+ posts in cache
- **Acceptance:** Average image gen time < 8 seconds, feed scrolls at 60 fps

#### T4.4: Clear Cache Feature
- Add "Clear Image Cache" button in Settings
- Show cache stats before clearing
- Confirm before deletion
- **Acceptance:** Cache clears without errors, stats update

### Wave 5: Testing & Validation (Days 5-6)

#### T5.1: Unit Tests
- Test `ImageGenerationService` (mock providers)
- Test `NanoBananaProvider` (mock API responses)
- Test `GeminiProvider` (mock API responses)
- Test caching layer (cache hits/misses, LRU eviction)
- Test post formatting (emoji, title, style inference)
- **Acceptance:** All tests pass, >80% coverage

#### T5.2: Integration Tests
- Test end-to-end: post → image generation → cache → display
- Test error scenarios: API failures, rate limiting, network errors
- Test fallback logic: Nano Banana fail → Gemini succeeds
- **Acceptance:** E2E flows work, all error paths covered

#### T5.3: Mobile & Responsive Testing
- Test on iOS (iPhone 12, 14) and Android (Pixel 4, 6)
- Test safe area handling (notches, home bars)
- Test network throttling (slow 3G, offline)
- Verify image quality and aspect ratios on various screen sizes
- **Acceptance:** No crashes, images render correctly on all devices

#### T5.4: UAT & Polish
- Manual testing of complete Home Feed flow
- Verify overlay text readability on various image types
- Confirm no visual regressions from v1.0
- Polish animations and transitions (Framer Motion)
- **Acceptance:** Feed feels polished, professional, engaging

### Wave 6: Documentation & Handoff (Days 6-7)

#### T6.1: Code Documentation
- Add JSDoc comments to all public methods
- Document image generation prompt engineering
- Document cache eviction algorithm
- Create README for image providers (API key setup)
- **Acceptance:** Code is self-documenting, no questions on setup

#### T6.2: API Configuration Guide
- Document Nano Banana API key setup (including cost/quota info)
- Document Gemini API key setup
- Create Settings UI guide for end users
- Add troubleshooting section (common issues & fixes)
- **Acceptance:** Developers and users can configure APIs independently

#### T6.3: Performance Metrics
- Log baseline metrics: image gen time, cache hit rate, feed scroll fps
- Create performance dashboard / report
- Document optimization opportunities for Phase 8+
- **Acceptance:** Metrics captured, actionable insights documented

#### T6.4: Phase Handoff
- Create VERIFICATION.md (success criteria checklist)
- Document any technical debt or follow-ups
- Ensure Phase 8 has clear context (post detail carousel depends on this)
- Update STATE.md with completion notes
- **Acceptance:** Phase 8 can start immediately

---

### Wave 7: Stabilization & UI Fixes (Post-UAT)

#### T7.1: Fix Mock Image Encoding
- Update `NanoBananaProvider` and `GeminiProvider` mock generation
- Replace ellipsis (`…`) with three dots (`...`) to prevent `btoa` encoding errors on non-ASCII characters
- **Acceptance:** Mock images render successfully without silent console errors

#### T7.2: Fix Retry Event Bubbling
- Update `FeedPostImage.tsx`
- Add `e.stopPropagation()` to the `onClick` handler of the "Retry" button
- **Acceptance:** Clicking "Retry" triggers image regeneration WITHOUT navigating to the post detail page

#### T7.3: Primary Provider Selection
- Update `ImageGenerationSettings` in `src/types/index.ts` to include `primaryProvider: 'nanoBanana' | 'gemini'`
- Update `SettingsScreen.tsx` to include a dropdown for "Primary Image Provider"
- Update `imageGeneration.bootstrap.ts` to reorder providers based on this user preference
- **Acceptance:** User can toggle between providers, and the app respects this priority without reload

#### T7.4: Final UAT Verification
- Re-run all 4 UAT test cases from `07-HUMAN-UAT.md`
- Verify Gemini fallback works by purposefully leaving Nano Banana key blank
- **Acceptance:** 100% UAT pass rate

---

## Task Dependencies

```
T1.1 (ImageGenerationService) ──┐
                                 ├→ T2.3 (FeedPost update) ──→ T2.4 (FeedScreen)
T1.2 (Nano Banana) ┐             │
T1.3 (Gemini)      ├→ T3.1/T3.2  ┤
T1.4 (Caching)     ┘             ├→ T3.3 (Error handling)
                                 │
T2.1 (FeedPostImage) ────────────┘
T2.2 (PostFormatting) ──→ T2.1

T4.1/T4.2 (Cache optimization) ──→ T4.3 (Performance)
T5.1/T5.2 (Unit/Integration) ────→ T5.3 (Mobile testing) → T5.4 (UAT)
T6.1/T6.2/T6.3 (Docs) ──→ T6.4 (Handoff)
```

## Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Image generation time | < 8 seconds avg | User doesn't wait too long |
| Cache hit rate | > 80% on repeat views | Minimize API calls |
| Feed scroll fps | 60 fps smooth | Mobile-first quality |
| Image cache size | < 50 MB | Storage efficiency |
| Error recovery time | < 2 seconds | User doesn't notice failures |
| UAT pass rate | 100% | Phase is production-ready |

## Known Unknowns (TBD)

- [ ] Nano Banana API exact pricing and rate limits (research needed)
- [ ] Gemini image generation latency vs Nano Banana
- [ ] Optimal image compression settings (quality vs size tradeoff)
- [ ] Exact image prompt engineering (what generates best results?)
- [ ] Cache expiration policy (30 days? User configurable?)
- [ ] Whether to support PNG, JPEG, WebP (or just one format?)

## Rollout & Monitoring

- **Phase 7 complete:** Full feed redesign deployed to dev/test
- **Smoke test:** Verify no crashes, feed renders, images generate
- **Canary test:** Test with ~10 beta users before Phase 8
- **Production ready:** Monitor API costs, cache performance, user feedback

---

_Phase 7 Execution Plan | 2026-03-26_
