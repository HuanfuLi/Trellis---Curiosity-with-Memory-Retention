## Context

EchoLearn is designed as a mobile-first web application deployed via Capacitor to iOS and Android. The current implementation relies on standard web defaults, resulting in several UX issues typical of non-optimized web apps running on mobile (instant page transitions, text selection magnifiers on long presses, blue/grey tap highlights, and zooming). To bridge the gap between a web app and a native mobile app, we need to introduce specific CSS resets, viewport locks, and a robust animation framework.

## Goals / Non-Goals

**Goals:**
- Eliminate web-native artifacts (tap highlights, selection context menus, pinch-to-zoom).
- Ensure scroll positions are not carried over erroneously between route changes.
- Implement smooth, native-feeling page transitions using Framer Motion.
- Provide immediate tactile feedback for interactive elements using CSS active states.
- Introduce physical haptic feedback for key user interactions.

**Non-Goals:**
- Complete redesign of the application's visual language or theming.
- Replacing React Router with a different routing solution.
- Creating complex, multi-step choreographies beyond basic page sliding/fading.

## Decisions

1. **CSS Resets for Touch**: 
   - Apply `-webkit-touch-callout: none;`, `user-select: none;`, and `-webkit-tap-highlight-color: transparent;` globally in `index.css`. This is the most robust and standard way to prevent default mobile browser behaviors from interfering with app interactions.
2. **Scroll Restoration**:
   - Utilize React Router's built-in `<ScrollRestoration />` component at the root layout level (`App.tsx`). It's lightweight and integrates seamlessly with our existing routing setup.
3. **Viewport Lockdown**:
   - Modify the meta viewport tag in `index.html` to include `maximum-scale=1.0, user-scalable=no`. This prevents unwanted zooming.
4. **Animation Framework**:
   - Adopt `framer-motion`. While CSS view transitions are lighter, Framer Motion provides the necessary `<AnimatePresence>` for exit animations during React Router unmounts, giving us the control needed for buttery smooth page slides. We will wrap our routes in an `<AnimatePresence mode="wait">` block.
5. **Tactile & Haptic Feedback**:
   - Add a global `.active-squish:active` utility class (or apply it directly to interactive components) to provide visual feedback (`transform: scale(0.96)`).
   - Use `@capacitor/haptics` on specific, high-intent buttons (like the center Ask button) to trigger a subtle physical device vibration.

## Risks / Trade-offs

- **Risk: Increased Bundle Size** → *Mitigation:* `framer-motion` adds to the bundle size, but given this is a Capacitor app running locally on devices, network latency for bundle downloading is a non-issue after initial installation. We will also utilize dynamic imports if necessary later, though the baseline size is acceptable for the UX gains.
- **Risk: Text Selection Lost Everywhere** → *Mitigation:* Applying `user-select: none;` globally means users can't copy text. We must explicitly opt-in text-heavy components (like chat messages or post content) using `user-select: text;` so users can still copy useful information.