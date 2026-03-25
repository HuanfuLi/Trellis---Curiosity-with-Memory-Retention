## Why

The current mobile web/Capacitor implementation lacks several critical UI/UX details that prevent it from feeling like a truly native application. Issues such as instantaneous page routing, text-selection magnifiers appearing on long-press, ghost clicks (tap highlights), accidental pinch-to-zoom, and a lack of tactile feedback (squish/haptics) on interactive elements all degrade the user experience. Addressing these polish items is necessary to provide a seamless and professional feel that users expect from a mobile app.

## What Changes

- **Scroll Restoration**: Implement scroll restoration so that navigating between pages doesn't spawn the user at the previous page's scroll depth.
- **Touch Callouts & Selection**: Disable iOS context menus and text selection globally to prevent native web artifacts from appearing during interaction.
- **Tap Highlights**: Remove the default grey semi-transparent rectangle that flashes over elements when tapped on mobile browsers.
- **Viewport Scaling**: Lock the viewport scaling in `index.html` to prevent accidental pinch-to-zoom and double-tap zoom.
- **Page Transitions**: Introduce Framer Motion to handle smooth, native-like page transitions (e.g., sliding screens) when routing between views.
- **Tactile Feedback**: Add system-wide `:active` CSS states (e.g., a "squish" effect) to interactive elements like buttons and cards to provide immediate visual feedback before JavaScript execution.
- **Haptic Feedback**: Integrate `@capacitor/haptics` to provide physical device vibrations on key interactions (like pressing the center "Ask" button).

## Capabilities

### New Capabilities
- `mobile-ux-polish`: Core capability covering viewport lockdown, scroll restoration, touch highlights, and tactile CSS feedback.
- `page-transitions`: Capability covering the integration and configuration of Framer Motion for native-like route animations.
- `haptic-feedback`: Capability covering the integration of Capacitor's Haptics API for physical feedback on key actions.

### Modified Capabilities
- (None)

## Impact

- **Global CSS (`index.css`)**: Will receive updates to disable native web touch behaviors and add `:active` states.
- **HTML (`index.html`)**: The viewport meta tag will be updated.
- **Routing (`App.tsx`)**: Will be updated to include scroll restoration and Framer Motion's `<AnimatePresence>` for route transitions.
- **Dependencies**: Adding `framer-motion` and `@capacitor/haptics`.
- **Components**: Interactive components (like `<Button />`, `<BottomNavigation />`) will be updated to trigger haptics and leverage the new CSS active states.