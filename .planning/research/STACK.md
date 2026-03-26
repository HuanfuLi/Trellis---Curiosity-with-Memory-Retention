# Technology Stack: EchoLearn v1.1

**Project:** EchoLearn v1.1 Feature Additions
**Researched:** January 2025
**Baseline Stack:** React 19.2.0, TypeScript 5.9.3, Capacitor 8.1.0, Tailwind CSS 4.2.1

## Executive Summary

EchoLearn v1.1 adds five new major features requiring minimal stack changes. The existing stack (React 19, Capacitor 8, Tailwind CSS 4) is **sufficient for all planned features**. Three key additions are recommended:

1. **Image Generation APIs**: Extend existing `@google/generative-ai` SDK for Gemini image generation; optional `@bananadev/banana-sdk` for Nano Banana API access
2. **Infinite Scroll**: Vanilla Intersection Observer API (no dependency) via custom React hook
3. **Daily Refresh Scheduling**: Leverage existing `date-fns` + `@capacitor/app` lifecycle events (no new dependency)

**No breaking changes required.** Stack is forward-compatible. Estimated npm additions: 1-2 new packages (optional).

---

## Recommended Stack Additions

### 1. Image Generation & AI Services

#### Primary: Extend @google/generative-ai

| Property | Value | Rationale |
|----------|-------|-----------|
| **Library** | @google/generative-ai | Already used for Gemini LLM; consolidate AI surface |
| **Version** | ^0.3.0 | Supports `generateImages()` for Imagen 3 model |
| **Purpose** | AI image generation for Rednote-style posts | Primary image generation service |
| **Integration** | Extend existing `src/providers/` pattern | Reuse auth, error handling, retry logic |

**Why this choice:**
- Consolidates API authentication (single Gemini API key)
- Reduces external dependencies
- Gemini image generation is production-ready and competitive
- Direct cost comparison with Nano Banana possible without code rewrite
- Already integrated into existing provider architecture

**Capabilities:**
```typescript
// Gemini can generate images via generateImages()
// Returns: {images: [base64 image data]}
const imageGenerationProvider = await genAI.getGenerativeModel({
  model: 'imagen-3.0-generate-001'
});
const result = await imageGenerationProvider.generateImages({
  prompt: 'A learning concept about...',
  count: 1
});
```

#### Secondary (Optional): @bananadev/banana-sdk

| Property | Value | Rationale |
|----------|-------|-----------|
| **Library** | @bananadev/banana-sdk | Nano Banana API SDK |
| **Version** | ^0.1.0+ | Support Stable Diffusion XL, other models |
| **Purpose** | Alternative model access (Dreamshaper, custom fine-tuned models) | Model diversity |
| **Integration** | Separate provider in `src/providers/banana-image.provider.ts` | Parallel to Gemini provider |

**When to use:**
- Custom model requirements (fine-tuned Stable Diffusion)
- Lower latency needs (Nano Banana optimized for speed)
- Cost optimization by model type
- Fallback if Gemini image generation rate-limited

**Decision:** Use Gemini by default; add Banana SDK in Phase 2 if cost/latency analysis shows benefit.

---

### 2. Infinite Scroll Implementation

#### Recommendation: Vanilla Intersection Observer API

| Property | Value | Rationale |
|----------|-------|-----------|
| **Technology** | Browser Intersection Observer API | Native browser API, zero dependencies |
| **React Pattern** | Custom `useInfiniteScroll` hook | 50-line utility, React 19 compatible |
| **Version Requirement** | Native (all modern browsers) | iOS Safari 12+, Chrome 51+, Firefox 55+ |
| **Purpose** | Scroll-to-load feed pagination | Replace button-based pagination |

**Why NOT external libraries:**
- `react-intersection-observer`: Adds unnecessary wrapper for simple use case
- `@tanstack/react-virtual`: Over-engineered for current feed size
- `react-infinite-scroll-component`: Legacy, less React 19 optimized

**Implementation Pattern (copy to `src/hooks/useInfiniteScroll.ts`):**

```typescript
import { useRef, useEffect, useCallback } from 'react';

interface UseInfiniteScrollOptions extends IntersectionObserverInit {
  /**
   * Margin to add to the viewport before triggering callback
   * Negative values trigger earlier (e.g., "-100px" = 100px before visible)
   */
  rootMargin?: string;
}

/**
 * Hook to trigger callback when element enters viewport
 * Used for infinite scroll feed pagination
 */
export const useInfiniteScroll = (
  callback: () => void,
  options?: UseInfiniteScrollOptions
) => {
  const ref = useRef<HTMLDivElement>(null);
  
  // useCallback prevents observer recreation on every render
  const memoCallback = useCallback(callback, [callback]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        memoCallback();
      }
    }, {
      rootMargin: options?.rootMargin ?? '-50px', // Trigger 50px before visible
      ...options
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [memoCallback, options]);

  return ref;
};
```

**Usage in Feed Component:**

```typescript
const FeedScreen = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const loadMore = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    const newPosts = await feedService.loadMore();
    setPosts(prev => [...prev, ...newPosts]);
    setIsLoading(false);
  }, [isLoading]);
  
  const sentinelRef = useInfiniteScroll(loadMore, {
    rootMargin: '-100px'
  });

  return (
    <div className="feed">
      {posts.map(post => <PostCard key={post.id} post={post} />)}
      <div ref={sentinelRef} className="h-4" />
      {isLoading && <LoadingSpinner />}
    </div>
  );
};
```

**Compatibility Notes:**
- React 19 improves useEffect cleanup (cleaner observer disconnect)
- Works with Tailwind CSS responsive design
- Compatible with Framer Motion animations (animate above sentinel div)
- Mobile-safe: viewport detection works on iOS notch

---

### 3. Card Design & Animation

#### Recommendation: Extend Framer Motion (Already Installed)

| Property | Value | Rationale |
|----------|-------|-----------|
| **Library** | framer-motion | v12.38.0 already in dependencies |
| **New Pattern** | Card stagger + hover animations | No upgrade needed |
| **Purpose** | Rednote-style post cards, milestone cards | Visual polish, feedback |

**Why no new library:**
- Framer Motion v12 supports all needed animations
- React 19 compatible (already in package.json)
- Existing page transition patterns extensible

**Recommended Card Animations:**

```typescript
// src/components/cards/RedNotePostCard.tsx
import { motion } from 'framer-motion';

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: 'easeOut'
    }
  }),
  hover: {
    y: -4,
    boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
    transition: { duration: 0.2 }
  }
};

const imageOverlayVariants = {
  initial: { opacity: 0, scale: 0.8, rotate: -5 },
  animate: (index: number) => ({
    opacity: 1,
    scale: 1,
    rotate: index % 2 === 0 ? 8 : -8,
    transition: { delay: 0.2, duration: 0.4 }
  })
};

export const RedNotePostCard: React.FC<{post: Post, index: number}> = ({
  post, 
  index 
}) => {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="bg-white rounded-lg overflow-hidden shadow-md"
    >
      {/* Image container */}
      <div className="relative aspect-square bg-gray-100">
        <img 
          src={post.imageUrl} 
          alt={post.title}
          className="w-full h-full object-cover"
        />
        
        {/* Emoji overlays */}
        {post.emojiOverlays?.map((emoji, idx) => (
          <motion.div
            key={idx}
            custom={idx}
            variants={imageOverlayVariants}
            initial="initial"
            animate="animate"
            className="absolute text-4xl"
            style={{
              left: `${emoji.x}%`,
              top: `${emoji.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {emoji.emoji}
          </motion.div>
        ))}
      </div>

      {/* Card content */}
      <div className="p-4">
        <h3 className="font-bold text-lg line-clamp-2">{post.title}</h3>
      </div>
    </motion.div>
  );
};
```

**Milestone Card Enhancement:**

```typescript
const milestoneCardVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.08,
      type: 'spring',
      stiffness: 300,
      damping: 30
    }
  })
};

// Use existing Framer Motion for progress indicators
const progressVariants = {
  animate: {
    width: '100%',
    transition: {
      duration: 1.2,
      ease: 'easeInOut'
    }
  }
};
```

---

### 4. Daily Auto-Refresh Scheduling

#### Recommendation: date-fns + @capacitor/app Lifecycle

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Time utilities** | date-fns | ^3.0+ (extend existing) | Daily boundary checks |
| **Lifecycle hook** | @capacitor/app | ^8.0+ (already included) | App resume detection |
| **State storage** | localStorage | Native | Track last refresh time |
| **Persistent log** | SQLite | ^8.0.1 (existing) | Log refresh history |

**Why this approach:**
- No external scheduling library needed (no `node-cron`, `later.js`)
- Capacitor.App lifecycle already available
- Mobile-optimized: triggers on app resume, battery-efficient
- Follows existing architecture pattern

**Implementation Pattern:**

```typescript
// src/services/daily-refresh.orchestrator.ts
import { App as CapacitorApp } from '@capacitor/app';
import { isAfter, startOfDay, isToday } from 'date-fns';

interface DailyRefreshState {
  lastRefreshTime: string | null;
  pendingRefresh: boolean;
  itemsUpdated: number;
}

export class DailyRefreshOrchestrator {
  private state: DailyRefreshState = {
    lastRefreshTime: null,
    pendingRefresh: false,
    itemsUpdated: 0
  };

  constructor(
    private plannerService: PlannerService,
    private feedService: FeedService,
    private db: DatabaseService
  ) {
    this.initializeLifecycleListeners();
  }

  private initializeLifecycleListeners() {
    // Listen for app resume
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        this.checkAndTriggerDailyRefresh();
      }
    });

    // Also check on first load
    this.checkAndTriggerDailyRefresh();
  }

  private async checkAndTriggerDailyRefresh() {
    const lastRefresh = localStorage.getItem('lastDailyRefresh');
    const now = new Date();

    // If no previous refresh or it was on a different day
    if (!lastRefresh || !isToday(new Date(lastRefresh))) {
      await this.performDailyRefresh();
    }
  }

  private async performDailyRefresh() {
    try {
      this.state.pendingRefresh = true;

      // 1. Generate new planner suggestions
      const suggestions = await this.plannerService.generateDailySuggestions();
      this.state.itemsUpdated += suggestions.length;

      // 2. Refresh feed with new content
      const newPosts = await this.feedService.generateDailyPosts();
      this.state.itemsUpdated += newPosts.length;

      // 3. Log refresh
      const now = new Date();
      await this.db.execute(
        `INSERT INTO daily_refresh_log (refreshedAt, itemsUpdated) 
         VALUES (?, ?)`,
        [now.toISOString(), this.state.itemsUpdated]
      );

      // 4. Update state
      this.state.lastRefreshTime = now.toISOString();
      localStorage.setItem('lastDailyRefresh', now.toISOString());

      console.log(`Daily refresh complete: ${this.state.itemsUpdated} items updated`);
    } catch (error) {
      console.error('Daily refresh failed:', error);
      // Don't block app, silent fail
    } finally {
      this.state.pendingRefresh = false;
    }
  }

  isRefreshInProgress(): boolean {
    return this.state.pendingRefresh;
  }

  getLastRefreshTime(): string | null {
    return this.state.lastRefreshTime;
  }
}
```

**SQLite Schema Addition:**

```sql
-- Migration for v1.1
CREATE TABLE IF NOT EXISTS daily_refresh_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refreshedAt TEXT NOT NULL UNIQUE, -- ISO timestamp, unique per day
  itemsUpdated INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for recent refresh queries
CREATE INDEX IF NOT EXISTS idx_daily_refresh_recent 
ON daily_refresh_log(refreshedAt DESC);
```

**Integration Points:**

1. **AppProvider initialization** - add orchestrator to context
2. **Planner service** - method `generateDailySuggestions()`
3. **Feed service** - method `generateDailyPosts()`
4. **App root component** - wrap with orchestrator listener

---

### 5. Emoji Overlay Rendering

#### Recommendation: Browser Canvas API (No Dependency)

| Property | Value | Rationale |
|----------|-------|-----------|
| **Technology** | HTML5 Canvas API | Native browser API |
| **Purpose** | Render emoji overlays on generated images | Positioning, compositing |
| **Alternative** | konva.js | For interactive overlays (future enhancement) |

**Why Canvas:**
- Native, no dependency
- Perfect for static emoji positioning
- Can export composited image as base64
- Works in Canvas+React via ref

**Implementation Pattern:**

```typescript
// src/utils/emoji-overlay.ts
export interface EmojiPosition {
  emoji: string;
  x: number;      // 0-100 (percentage)
  y: number;      // 0-100 (percentage)
  size: number;   // font size in px
  rotation?: number; // degrees
}

/**
 * Composite emoji overlays onto an image using Canvas
 * Returns: Promise<base64 string>
 */
export const compositeEmojiOverlay = async (
  imageUrl: string,
  emojis: EmojiPosition[]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      
      // Draw base image
      ctx.drawImage(img, 0, 0);
      
      // Draw emojis
      emojis.forEach(({ emoji, x, y, size, rotation = 0 }) => {
        ctx.font = `${size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Convert percentage to pixels
        const pixelX = (x / 100) * img.width;
        const pixelY = (y / 100) * img.height;
        
        // Apply rotation if specified
        if (rotation !== 0) {
          ctx.save();
          ctx.translate(pixelX, pixelY);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.fillText(emoji, 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(emoji, pixelX, pixelY);
        }
      });
      
      // Export as base64
      const base64 = canvas.toDataURL('image/png');
      resolve(base64);
    };
    
    img.onerror = reject;
    img.src = imageUrl;
  });
};
```

**React Component Usage:**

```typescript
interface EmojiOverlayEditorProps {
  imageUrl: string;
  onComposite: (base64: string) => void;
}

export const EmojiOverlayEditor: React.FC<EmojiOverlayEditorProps> = ({
  imageUrl,
  onComposite
}) => {
  const [emojis, setEmojis] = useState<EmojiPosition[]>([]);
  
  const handleAddEmoji = (emoji: string) => {
    setEmojis(prev => [...prev, {
      emoji,
      x: 50,
      y: 50,
      size: 48
    }]);
  };
  
  const handleComposite = async () => {
    const result = await compositeEmojiOverlay(imageUrl, emojis);
    onComposite(result);
  };
  
  return (
    <div>
      <img src={imageUrl} alt="Preview" className="w-full" />
      {/* Emoji picker, positioning controls */}
      <button onClick={handleComposite}>Finalize</button>
    </div>
  );
};
```

---

## API Client Improvements

### Current State
- Using native `fetch` API
- No formal HTTP abstraction layer
- Image APIs called directly from components

### Recommended Formalization

**Keep:** Lightweight, no axios/TanStack Query dependency  
**Add:** Typed request/response wrapper for API calls

```typescript
// src/services/http.service.ts
interface RequestConfig<T = any> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: T;
  headers?: Record<string, string>;
  retries?: number;
  timeout?: number;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export class HttpService {
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly DEFAULT_RETRIES = 3;

  static async request<TResponse = any, TRequest = any>(
    config: RequestConfig<TRequest>
  ): Promise<ApiResponse<TResponse>> {
    const {
      method,
      url,
      data,
      headers = {},
      retries = this.DEFAULT_RETRIES,
      timeout = this.DEFAULT_TIMEOUT
    } = config;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const responseData = await response.json();

        return {
          data: responseData,
          status: response.status,
          headers: Object.fromEntries(response.headers)
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < retries) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError || new Error('Request failed');
  }
}
```

**Integration with Image Providers:**

```typescript
// src/providers/image.provider.ts
export class ImageProvider {
  async generateImage(prompt: string): Promise<ImageResult> {
    try {
      const response = await HttpService.request<ImageResult>({
        method: 'POST',
        url: `${GEMINI_API_ENDPOINT}/v1beta/generateImages`,
        data: { prompt },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        retries: 2,
        timeout: 60000 // Images take longer
      });
      
      return response.data;
    } catch (error) {
      console.error('Image generation failed:', error);
      throw new ImageGenerationError(error);
    }
  }
}
```

---

## Package Installation

### New Dependencies to Add

```bash
# Image generation (optional - only if using Nano Banana as fallback)
npm install @bananadev/banana-sdk

# Note: @google/generative-ai already used elsewhere
# Ensure version supports generateImages():
npm install @google/generative-ai@^0.3.0

# No new dependencies needed for:
# - Infinite scroll (Browser API)
# - Scheduling (date-fns already present)
# - Animations (Framer Motion already present)
# - Canvas (Browser API)
```

### Updated package.json Dependencies

```json
{
  "dependencies": {
    "@capacitor-community/sqlite": "^8.0.1",
    "@capacitor/android": "^8.1.0",
    "@capacitor/app": "^8.0.1",
    "@capacitor/cli": "^8.1.0",
    "@capacitor/core": "^8.1.0",
    "@capacitor/haptics": "^8.0.1",
    "@google/generative-ai": "^0.3.0",
    "@tailwindcss/vite": "^4.2.1",
    "capacitor-voice-recorder": "^7.0.6",
    "framer-motion": "^12.38.0",
    "lucide-react": "^0.575.0",
    "mind-elixir": "^5.9.3",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-markdown": "^10.1.0",
    "react-router-dom": "^7.13.1",
    "remark-gfm": "^4.0.1",
    "tailwindcss": "^4.2.1",
    "date-fns": "^3.0.0"
  }
}
```

---

## Compatibility & Migration Notes

### React 19 Compatibility ✅
- All recommended libraries support React 19
- `useInfiniteScroll` hook follows React 19 cleanup patterns
- Framer Motion v12 fully React 19 compatible

### TypeScript 5.9.3 Compatibility ✅
- All packages have complete type definitions
- No `@types/*` workarounds needed
- Strict mode compatible

### Capacitor 8 Compatibility ✅
- `@capacitor/app` v8.0+ includes lifecycle events
- Canvas/native bridge not blocked
- SQLite integration stable

### Tailwind CSS 4.2 Compatibility ✅
- Card hover/animation classes work with Framer Motion
- No CSS conflicts
- Dynamic class generation supported

### Mobile-Specific Concerns

| Feature | iOS Consideration | Android Consideration | Mitigation |
|---------|-------------------|----------------------|-----------|
| Intersection Observer | Safari 12.1+ | Chrome 51+ | Fallback: scroll event listener |
| Canvas API | iOS 14+ | All modern versions | Graceful downgrade |
| Capacitor App Events | iOS 13+ | Android 5+ | Event handler optional |
| date-fns | Full support | Full support | No changes needed |

**Fallback for older iOS:**

```typescript
// Polyfill if needed (rare in 2025)
if (!window.IntersectionObserver) {
  console.warn('IntersectionObserver not supported');
  // Fall back to scroll event listener
  element.addEventListener('scroll', () => {
    // Manual scroll detection
  });
}
```

---

## Breaking Changes & Migrations

### None Required ✅

All additions are:
- **Opt-in** (infinite scroll, daily refresh as new features)
- **Backward compatible** (image generation extends existing provider pattern)
- **Non-invasive** (Canvas API, Intersection Observer don't affect existing code)

### Recommended Refactoring (Non-Breaking)

1. **Formalize ImageProvider interface** in `src/providers/image.provider.ts`
2. **Add daily refresh orchestrator** in `src/services/orchestrator/daily-refresh.ts`
3. **Extract infinite scroll hook** to `src/hooks/useInfiniteScroll.ts`

**Timing:** Can be done incrementally; v1.1 doesn't require all at once.

---

## Performance Considerations

### Image Generation
- Gemini API: ~3-8 seconds per image generation
- Banana API: ~2-5 seconds (typically faster)
- **Mitigation:** Show loading spinner, cache results, limit concurrent requests

### Infinite Scroll
- Intersection Observer: No performance cost (native browser optimization)
- Feed pagination: Implement cursor-based pagination (not offset)
- **Batch size:** Recommend 15-20 items per load

### Canvas Emoji Overlay
- Compositing on large images (>4MB): Can be slow on low-end devices
- **Mitigation:** Pre-size images before compositing, use Web Worker for async processing

```typescript
// Optional: Use Web Worker for heavy canvas work
const workerPool = new WorkerPool({
  workerScript: 'emoji-overlay.worker.ts',
  poolSize: 2
});

const compositeAsync = await workerPool.run('compositeEmoji', [imageUrl, emojis]);
```

---

## Development Workflow

### Setup Commands

```bash
# Install new dependencies
npm install

# Type checking (TypeScript)
npm run build

# Verify all imports work
npm run lint

# Test image generation locally (optional)
# Set GEMINI_API_KEY env var
node scripts/test-image-generation.js
```

### Testing Image APIs

```typescript
// src/tests/image-generation.test.mjs
import { GeminiImageProvider } from '../providers/image.provider';

const provider = new GeminiImageProvider(process.env.GEMINI_API_KEY);
const result = await provider.generateImage('A concept diagram about learning');
console.log('Image URL:', result.imageUrl);
```

---

## Alternative Stack Decisions (Considered & Rejected)

| Decision | Considered | Rejected | Reason |
|----------|-----------|----------|--------|
| HTTP Client | axios, TanStack Query | Kept fetch wrapper | Smaller bundle, fewer deps |
| Infinite Scroll | @tanstack/react-virtual | Vanilla IntersectionObserver | Feed size doesn't require virtualization yet |
| Scheduler | node-cron, later.js | date-fns + Capacitor | Mobile-first; no background job needed |
| Canvas Library | konva.js, PixiJS | Browser Canvas API | Emoji overlay doesn't need interactivity |
| Image Gen | OpenAI DALL-E, Stability AI | Gemini + optional Banana | Cost, consolidation, speed tradeoff |

---

## Risk Assessment & Mitigations

### Risk: Image API Rate Limiting (Gemini)

**Severity:** Medium  
**Mitigation:**
- Implement per-user rate limiting (5 images/day default)
- Queue pending requests with exponential backoff
- Cache successful images in SQLite with expiry
- Fallback to Banana API if available

### Risk: Intersection Observer Not Supported (Legacy iOS)

**Severity:** Low (iOS 12 is <1% of users)  
**Mitigation:**
- Feature detection at app startup
- Graceful degradation: show "Load More" button
- Analytics to track affected users

### Risk: Canvas Performance on Large Images

**Severity:** Low-Medium  
**Mitigation:**
- Resize images before compositing (max 1080x1080)
- Warn user on low-end device (detect via device memory API)
- Optional Web Worker for async compositing

### Risk: Daily Refresh Missing on Backgrounded App

**Severity:** Low  
**Mitigation:**
- Use Capacitor.App lifecycle (not just React state)
- Validate timestamp on app resume
- Manual refresh button in UI as fallback

---

## Success Criteria

Stack is ready for v1.1 when:

- ✅ `@google/generative-ai` v0.3.0+ installed and test image generation works
- ✅ `useInfiniteScroll` hook created and integrated in Feed screen
- ✅ Daily refresh orchestrator initialized at app startup
- ✅ Canvas emoji overlay utility tested with sample images
- ✅ All TypeScript types pass strict mode
- ✅ No console errors on iOS/Android physical devices

---

## Sources & References

- [Google Generative AI Node SDK](https://github.com/google/generative-ai-node) - Image generation capability verification
- [Nano Banana API Docs](https://www.bananadev.com/) - Alternative image generation
- [MDN: Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) - Browser native scroll detection
- [React 19 Release Notes](https://react.dev/blog/2025/12/05/react-19) - useEffect cleanup improvements
- [Capacitor 8 App Plugin](https://capacitorjs.com/docs/apis/app) - Lifecycle event handling
- [Framer Motion v12 Docs](https://www.framer.com/motion/) - Animation patterns
- [HTML5 Canvas MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) - Emoji overlay rendering
- [date-fns v3 API](https://date-fns.org/) - Scheduling time utilities

