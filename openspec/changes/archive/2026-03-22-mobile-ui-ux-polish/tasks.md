## 1. Setup and Global Configuration

- [x] 1.1 Install dependencies: `framer-motion` and `@capacitor/haptics`.
- [x] 1.2 Update `app/index.html` viewport meta tag to lock scaling (`maximum-scale=1.0, user-scalable=no`).
- [x] 1.3 Add global touch resets (`user-select`, `-webkit-touch-callout`, `-webkit-tap-highlight-color`) to `app/src/index.css`.
- [x] 1.4 Implement a global `.active-squish:active` utility class in `app/src/index.css`.
- [x] 1.5 Add `<ScrollRestoration />` to `RootLayout` in `app/src/App.tsx`.

## 2. Page Transitions (Framer Motion)

- [x] 2.1 Refactor routing in `app/src/App.tsx` to support `AnimatePresence`. Use a wrapper component (e.g., `<AnimatedOutlet />`) that keys off `useLocation`.
- [x] 2.2 Create a reusable `PageTransition` wrapper component that implements standard enter/exit animations (e.g., fade/slide).
- [x] 2.3 Wrap top-level screen components (Home, Ask, Graph, Settings, etc.) with the new `PageTransition` component.

## 3. UI Tactile Polish

- [x] 3.1 Apply the `.active-squish` class (or equivalent inline styles) to the main `Button` component in `app/src/components/ui/Button.tsx`.
- [x] 3.2 Apply active states/squish to navigation items in `app/src/components/BottomNavigation.tsx`.
- [x] 3.3 Apply active states/squish to interactive cards (like Bento cards on Home or Milestone cards).

## 4. Haptic Feedback Integration

- [x] 4.1 Initialize `@capacitor/haptics` utility functions.
- [x] 4.2 Add haptic feedback to the central "Ask" button in `app/src/components/BottomNavigation.tsx` via `onPointerDown`.
- [x] 4.3 Add haptic feedback to key submission actions (e.g., confirming a flashcard review).

## 5. Text Selection Opt-ins

- [x] 5.1 Ensure `user-select: text;` is applied specifically to `app/src/components/ChatMessage.tsx` content to allow users to copy answers.
- [x] 5.2 Ensure `user-select: text;` is applied to post bodies in `app/src/screens/PostDetailScreen.tsx`.