# Phase 28: UI/UX Polish from Audit Findings - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Land the full set of UI/UX polish items surfaced by the 2026-04-16 Chrome-based audit of localhost:5173. The phase covers all four audit severity waves (A: P0 showstoppers, B: P1 visual chrome, C: trellis interaction & naming, D: P2 micro-polish). It delivers:

1. A `SwipeTabContainer` desync fix (URL ≠ strip position) + missing Suggested-Moves section header.
2. Sub-screen chrome polish: bottom nav hides on secondary panels with a slide-down animation; sub-screen headers grow a scroll-aware shadow separator.
3. Trellis leaf micro-interactions — tap-to-shake (+ haptic) on any leaf, and a focus pulse when a Suggested-Move row selects the anchor a leaf represents.
4. "Mind Map" → "Knowledge Graph" rename propagated across all 4 locale bundles (en/zh/es/ja) via Phase 27's Sonnet-subagent translation workflow.
5. AskScreen recent-questions polish: drop hardcoded bullet, truncate long questions, refine empty state, make history rows tappable.
6. A pass over the remaining P2 findings (chip micro-animations, empty-state copy, Graph spacing tweaks, minor consistency fixes).

**Depends on Phase 27** (i18n scaffold live before this phase's locale bundle edits land). If Phase 27 lags, the Mind Map → Knowledge Graph rename degrades gracefully to a direct `GraphScreen.tsx` string edit that Phase 27's key-extraction pass picks up later.

**Out of scope (deferred):**
- False-alarm findings from the audit that the user withdrew: Trellis Dev Mode default state, "debug-label" Suggested Moves, harvest chip decrement — these were artifacts of the user having Dev Mode manually toggled on during the audit session.
- Any new mental-model surfaces on the trellis (leaf-tap tooltips, inline text captions, detail sheets) — explicitly rejected to keep trellis interaction "effortless or useless".
- Net-new features: the phase is strictly polish over existing surfaces.
- Accessibility sweep (ARIA labels, focus rings, contrast audit) — separate future phase.

</domain>

<decisions>
## Implementation Decisions

### Scope & Wave Coverage

- **D-01:** Ship the full audit — **Waves A + B + C + D** in one phase. Estimated ~5–7 days of execution (user-confirmed scope).
- **D-02:** Withdrawn audit findings (Dev Mode default, Suggested-Moves debug labels, harvest chip count) are NOT part of this phase. The user confirmed these were false alarms caused by manually-enabled Dev Mode during audit.
- **D-03:** Every finding must land with a visible, manually-verifiable before/after. The UAT checklist is the audit report itself — each P0/P1/P2 finding becomes a UAT row.

### Wave A — P0 Showstoppers

- **D-04 (A-1):** Add a visible "Suggested Moves" section header above the Suggested Moves list on `PlannerScreen`. Currently the section renders rows with no heading, leaving users unsure what they're looking at. Use the existing `SectionHeader` component pattern (or whatever Planner already uses for Trellis Status / Pruned headings) for visual consistency.
- **D-05 (A-2):** Fix `SwipeTabContainer` transform desync. Audit repro: navigate to `/planner`, trigger certain keyboard-open / back-button / viewport-resize sequence → URL says `/planner` (index 1, expected `translateX(-screenWidth)`) but `stripX` motion value stays at a stale value (e.g. `-1374px` on a 375px viewport, which points nowhere valid). Root cause hypothesis: `screenWidthRef` is captured once and never refreshes when the visual viewport changes (keyboard open/close, device rotation, orientation, browser UI chrome expand/collapse). Fix approach:
  1. Add a `resize` + `visualViewport.resize` listener that updates `screenWidthRef` and re-snaps `stripX` to `activeIndexRef.current * screenWidthRef.current * -1` if the strip is not mid-gesture.
  2. On route sync (`useLayoutEffect` that watches `location.pathname`), always recompute target X from the current `screenWidthRef.current` before `animate()` / `set()`.
  3. Add a dev-only invariant check: if `Math.abs(stripX.get() - activeIndexRef.current * -screenWidthRef.current) > 2px` after any navigation, log a warning so regressions are caught in dev.
- **D-06 (A-3):** Hide `BottomNavigation` on sub-screens (PostDetail, AnchorDetail, ClusterDetail, QuestionDetail, Review, Podcast) via a **slide-down animation** (~200ms spring, matches the existing `SPRING` constant `{ stiffness: 300, damping: 30, mass: 0.8 }` in `SwipeTabContainer`). Nav slides back up when user navigates back to a top-level screen. Implementation: pass `isTopLevelScreen` (already computed in `RootLayout`) as a prop into `BottomNavigation`, animate its `y` translate between `0` and `88px + safe-area-bottom`. The fixed shield at the top of the viewport stays unaffected.

### Wave B — Visual Chrome

- **D-07 (B-1):** Sub-screen `Header` component grows a **scroll-aware shadow**. When the sub-screen scroll container's scrollTop > 4px, Header displays `boxShadow: 'var(--shadow-1)'`; at rest it has no separator. Header already has `backgroundColor: 'var(--surface)'` so no border is needed. Implementation: add an `onScroll` listener on the sub-screen Outlet wrapper in `App.tsx` (the `<div>` at lines 212–227) that sets a CSS variable (or passes a `scrolled` prop through a context) consumed by `Header`. Top-level screen headers keep their current flat look — they don't need this.
- **D-08 (B-2):** Add a `borderTop: '1px solid var(--outline-variant)'` (or equivalent subtle divider) on `BottomNavigation` so the nav has a visible separator from the content above on top-level screens too. Currently it can look flush/floating on light surfaces.
- **D-09 (B-3):** Any P1 visual-chrome findings from the audit report not explicitly covered above (spacing/padding inconsistencies on Planner cards, GraphScreen toolbar alignment, Settings row vertical rhythm, chip padding normalization) land here as a single consolidated "consistency pass" task. Planner decides the exact list based on the audit report.

### Wave C — Trellis Interaction & Naming

- **D-10 (C-1):** Tap-to-shake leaf interaction. Any tap on a `TrellisLeaf` (any state: bud, green, yellow, falling, fallen, blossom, fruit) triggers a ~300ms shake animation (rotate keyframe `0° → +4° → -4° → +2° → 0°`) driven by Framer Motion variants. No tooltip, no sheet, no navigation — shake is the only response. This preserves the "no new mental model" directive.
- **D-11 (C-2):** **Haptic feedback on tap** — call `hapticImpactLight()` (existing helper at `app/src/lib/haptics.ts`) at the start of the shake. Web platform is a no-op; Capacitor native fires light haptic.
- **D-12 (C-3):** **Pulse-on-focus** — when the user taps a Suggested Moves row on `PlannerScreen`, the leaf on the trellis corresponding to that move's target anchor pulses (scale `1 → 1.15 → 1`, ~600ms) and a soft glow (filter `drop-shadow(0 0 8px var(--primary-40))`) fades in for ~2s, then fades out. If the user acts on the move (heal / re-plant / prune / open post), the pulse clears immediately. If the user cancels / navigates away, the glow fades on leaf state next render.
  - Data plumbing: `PlannerScreen` emits a lightweight `focusedAnchorId` state → `TrellisHero` reads it via props → `TrellisLeaf` receives a `focused?: boolean` prop computed from matching `anchorId`.
  - No persistence across re-mount. Pure ephemeral UI state.
- **D-13 (C-4):** **Performance guard** — if `leaves.length > 30`, the shake/pulse animations still run at full quality only on leaves currently in the visible portion of the trellis canvas. Use `framer-motion`'s `whileInView` or an `IntersectionObserver` wrapper. Off-screen leaves skip the animation entirely (no-op). This prevents jank on graphs with 50+ anchors (see Phase 25 D-55 for the established convention).
- **D-14 (C-5):** **Rename "Mind Map" → "Knowledge Graph"** in `GraphScreen.tsx` (line 518: `title="Mind Map"` → key `t('graph.title')` where `graph.title = "Knowledge Graph"` in en.json). Propagate to `zh.json` / `es.json` / `ja.json` via a Sonnet subagent invocation (per Phase 27 D-08 workflow). Suggested translations (planner/executor may refine):
  - en: `"Knowledge Graph"`
  - zh: `"知识图谱"`
  - es: `"Grafo de conocimiento"`
  - ja: `"ナレッジグラフ"`
  
  If Phase 27's key-extraction sweep has not yet run by Phase 28 execution time, do a direct string edit on `GraphScreen.tsx:518` and leave a `// TODO(phase-27): key-extract to graph.title` comment so Phase 27 picks it up. The comment in `AskScreen.tsx` mentioning "Mind Map" is a code comment only — no user-visible change needed there, but update the comment for grep hygiene.

### Wave D — P2 Micro-Polish

- **D-15 (D-1):** AskScreen recent-questions polish (all four items):
  - Remove the hardcoded `• ` bullet prefix on `AskScreen.tsx:623` — use a flexbox gap with a styled bullet span or a proper list marker.
  - Truncate long question text to 2 lines via `WebkitLineClamp: 2` + `overflow: hidden` + `textOverflow: 'ellipsis'`.
  - Make history rows tappable — entire row is a button navigating to `/ask/:id`. Add hover/active states.
  - Refine empty state copy if `recent.length === 0` (currently may render just the label with no list). Display "No recent questions yet — ask your first one below." or similar helpful text.
- **D-16 (D-2):** Planner Suggested-Moves row chips (heal/replant/prune badges) get a subtle `transform: scale(0.96)` on press (`active-squish` utility if it exists; else inline style). Improves tactile feel.
- **D-17 (D-3):** Empty-state copy consistency pass — any top-level screen showing an empty state (Home with no posts, Planner with no anchors, Graph with <5 nodes) gets a one-line review to ensure tone and CTA are consistent. Planner decides the exact list.
- **D-18 (D-4):** Graph screen spacing/toolbar micro-tweaks — any P2 findings from the audit specific to GraphScreen (toolbar button alignment, reorganize icon spacing, canvas padding). Consolidate into one task.
- **D-19 (D-5):** Any remaining P2 findings from the audit not explicitly covered by D-15..D-18 land as a small residual "polish-leftovers" task owned by the planner. Cap at ≤4 small items to avoid scope creep.

### Cross-Cutting Constraints

- **D-20:** **No new components** unless strictly required. Prefer extending existing components (`Header`, `BottomNavigation`, `TrellisLeaf`, `SwipeTabContainer`).
- **D-21:** **Inline styles with CSS variables** per project convention. No Tailwind classes introduced.
- **D-22:** **All animations use Framer Motion** (already a dependency). No new animation libraries.
- **D-23:** **Event bus for cross-component focus** — if `focusedAnchorId` plumbing is cleaner through `eventBus.emit('SUGGESTED_MOVE_FOCUSED', { anchorId })` than through prop drilling, use the event bus (existing pattern). Planner decides.
- **D-24:** **i18n coordination:** assume Phase 27's i18n scaffold (`react-i18next` + bundle loader + `useTranslation()` hook) is live before Phase 28 execution. If not, D-14 degrades as specified. All other newly-introduced user-visible strings in this phase MUST go through `t(...)` with a key in all 4 bundles — do not add new hardcoded English strings.
- **D-25:** **Regression safety:** after each wave lands, run `npm run typecheck` + manual verification on Chrome localhost:5173 (swipe between all 5 tabs, open each sub-screen, tap a leaf, tap a suggested move). No automated e2e in this phase — manual UAT per audit finding.

### Claude's Discretion

- Exact spring values for the nav slide-down animation (can match existing `SPRING` constant or tune).
- Whether to route `focusedAnchorId` through props or through `eventBus` — planner picks the cleaner path.
- Exact pulse glow color / intensity — must use existing CSS variables (`--primary-40` or `--node-*`).
- Whether the scroll-aware header shadow is driven by React state, a CSS variable, or a context — planner picks.
- Whether to split this phase into one plan or multiple plans (one per wave, or all in one). Given the ~5–7 day estimate, splitting into 2 plans (Waves A+B together, Waves C+D together) is the default recommendation; planner may choose differently.
- Specific residual P2 items for D-17 / D-18 / D-19 — source from the audit report in the conversation history.

### Folded Todos

None — `todo match-phase 28` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level

- `.planning/PROJECT.md` — Vision, local-first privacy, React/TS/Vite stack.
- `.planning/REQUIREMENTS.md` — Milestone v1.1 (polish does not add new REQ-IDs; phase is internally-scoped).
- `.planning/STATE.md` — Current phase state; Phase 27 status.
- `.planning/ROADMAP.md` — Phase 28 depends on Phase 27.
- `.planning/codebase/STACK.md` / `CONVENTIONS.md` / `STRUCTURE.md` — Tech and style baselines.

### Prior-phase context (behavior continuity)

- `.planning/phases/22-swipe-navigation-between-first-level-screens/22-CONTEXT.md` — SwipeTabContainer design (relevant to D-05 fix).
- `.planning/phases/25-anime-knowledge-tree-for-planner-page-motivational-review-visualization/25-CONTEXT.md` — Trellis + leaf state machine (relevant to D-10..D-13).
- `.planning/phases/26-trellis-harvest-panel-dying-dead-node-actions-and-suggested-moves-refactor-to-reflect-trellis-status/26-CONTEXT.md` — Suggested Moves architecture + planner layout (relevant to D-04, D-12).
- `.planning/phases/27-add-i18n-l10n-support/27-CONTEXT.md` — i18n workflow, bundle files, Sonnet-subagent translation pipeline (relevant to D-14, D-24).

### Files modified in this phase (primary)

- `app/src/App.tsx` — Sub-screen Outlet wrapper gets `onScroll` handler; `BottomNavigation` receives `isTopLevelScreen` prop.
- `app/src/components/BottomNavigation.tsx` — Slide-down animation wrapper; optional border-top.
- `app/src/components/SwipeTabContainer.tsx` — Resize listener + visualViewport handler + dev invariant.
- `app/src/components/ui/Header.tsx` — Scroll-aware shadow.
- `app/src/components/trellis/TrellisLeaf.tsx` — Shake-on-tap + pulse-on-focus + haptic.
- `app/src/screens/PlannerScreen.tsx` — Suggested Moves section header; `focusedAnchorId` state + plumb to trellis.
- `app/src/screens/GraphScreen.tsx` — "Mind Map" → `t('graph.title')`.
- `app/src/screens/AskScreen.tsx` — Recent-questions polish pass; update stale comment.
- `app/src/locales/{en,zh,es,ja}.json` — Add `graph.title` key + any new polish strings.
- `app/src/lib/haptics.ts` — (No change — consumer of existing `hapticImpactLight()`.)

### Files read but not modified

- `app/src/components/trellis/TrellisHero.tsx` (or equivalent) — To understand leaf-selector plumbing.
- `app/src/state/useTrellisData.ts` — To understand anchor→leaf mapping for pulse-on-focus.
- `app/src/components/ui/Card.tsx` / `Badge.tsx` — Reference styles for any new row additions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `hapticImpactLight()` (`app/src/lib/haptics.ts`) — already used by `BottomNavigation` for tab taps.
- `SPRING` constant (`SwipeTabContainer.tsx:38`) — `{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }`. Reuse for nav slide-down.
- `active-squish` CSS class (referenced on `TabButton` line 57) — existing press-feedback utility.
- `Header` component with `HEADER_HEIGHT = 56` and `backgroundColor: 'var(--surface)'` — already opaque, so separator work is additive.
- Framer Motion `variants` + `whileTap` / `animate` — already used throughout; trellis shake is a natural fit.
- `eventBus` (`app/src/lib/event-bus.ts`) — candidate for `SUGGESTED_MOVE_FOCUSED` if prop drilling gets ugly.
- `SwipeTabContext.Provider` — already exposes `swipeProgress` to BottomNavigation; can expose `isTopLevelScreen` through the same channel.
- `useTrellisData` hook — already keyed by `anchorId`; pulse-on-focus can subscribe or consume directly.
- Phase 27's Sonnet-subagent workflow (documented in `27-CONTEXT.md` D-08) — reuse for D-14 translations.

### Established Patterns

- **Inline styles + CSS variables** — all new styling follows this, no Tailwind.
- **Framer Motion `variants`** for multi-state animations (shake, pulse, nav slide).
- **Props over context where possible** — but `SwipeTabContext` is the established channel for cross-component reactivity on the home strip.
- **Event bus for decoupled cross-component reactivity** — established in Phase 25/26.
- **`useLayoutEffect` for pre-paint sync** — already used in `SwipeTabContainer`; pattern applies to the resize fix in D-05.
- **`safe-area-bottom` CSS variable** — already used for bottom nav spacing; reused for slide-down delta.

### Integration Points

- `App.tsx` RootLayout — props down to BottomNavigation; onScroll on Outlet wrapper; already has `isTopLevelScreen` locally.
- `SwipeTabContainer` — listener additions, no behavioral change to existing flows.
- `TrellisLeaf` — new `focused?: boolean` prop + `onTap` handler; existing `ambientSway` / `animationDelay` preserved.
- `PlannerScreen` — new `focusedAnchorId` state; reset on Move row tap / unmount.
- `GraphScreen` — single string swap; no structural change.
- `AskScreen` — history row becomes tappable (nav to `/ask/:id`); bullet removed.
- `locales/*.json` — add `graph.title` key (+ any new polish keys introduced incidentally).

</code_context>

<specifics>
## Specific Ideas

- **Dev invariant for D-05:** `if (DEV) console.warn(...)` if `stripX` drifts from expected position after navigation. Catches regressions early and makes the bug reproducible.
- **Scroll-aware header shadow:** publish `scrolled` as a CSS variable `--header-scrolled: 1 | 0` on the sub-screen wrapper; `Header` reads it via `var(--header-scrolled)` in a `boxShadow` expression (`calc(var(--header-scrolled) * 0) * 4px ...`) — avoids React context plumbing.
- **Trellis shake variant:**
  ```
  variants={{
    idle: { rotate: 0 },
    shake: { rotate: [0, 4, -4, 2, 0], transition: { duration: 0.3 } }
  }}
  ```
  Trigger by toggling an `animate` prop on tap.
- **Pulse-on-focus glow:** use Framer Motion's `animate={{ filter: [...], scale: [...] }}` with key derived from `anchorId + timestamp` so repeated taps on the same row re-trigger the animation.
- **i18n Sonnet subagent call (D-14):** planner can spawn a `general-purpose` Task-tool agent with instructions to diff current `{locale}.json` against `en.json`, add only missing keys, preserve formatting, and return full merged file. Exact invocation template per Phase 27 D-08.
- **UAT artifact:** produce a before/after screenshot grid (one row per audit finding) at phase completion. Archive under `.planning/phases/28-ui-ux-polish-from-audit-findings/screenshots/`.

</specifics>

<deferred>
## Deferred Ideas

- **Leaf tap tooltip / inline caption** — explicitly rejected; violates "no new mental model" directive.
- **Trellis zoom / pan interactions** — future phase if/when anchor count makes scroll-to-target painful.
- **Accessibility sweep** — ARIA labels for trellis SVG, focus rings, contrast audit. Separate future phase.
- **Automated visual regression (Percy / Chromatic)** — would stabilize future polish passes; deferred to tooling phase.
- **Keyboard-open visual viewport refinements** — Phase 28 fixes the desync bug but doesn't add a bespoke "keyboard-aware layout mode". Future phase if needed.
- **Sub-screen page transitions beyond `PageTransition`** — shared-element transitions (e.g., leaf → anchor detail). Nice to have, not in scope.
- **Per-screen theme hints (e.g., Planner uses greener palette)** — theming unification is a separate phase.
- **Animated bottom-sheet dismissal** — touched by Phase 26 cleanup; any residual polish deferred.

### Reviewed Todos (not folded)

None — `todo match-phase 28` returned 0 matches.

</deferred>

---

*Phase: 28-ui-ux-polish-from-audit-findings*
*Context gathered: 2026-04-16*
*Depends on: Phase 27 (i18n scaffold)*
