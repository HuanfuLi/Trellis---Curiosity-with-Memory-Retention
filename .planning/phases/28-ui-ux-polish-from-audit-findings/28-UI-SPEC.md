---
phase: 28
slug: ui-ux-polish-from-audit-findings
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-16
reviewed_at: 2026-04-16
---

# Phase 28 — UI Design Contract

> Visual and interaction contract codifying the 25 locked decisions from `28-CONTEXT.md` against project tokens in `app/src/index.css`. Polish phase — every value resolves to an existing CSS variable or a measured pixel.  No net-new design tokens.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (project-native CSS variables — see `CLAUDE.md`) |
| Preset | not applicable |
| Component library | none (in-house: `Card`, `Badge`, `Button`, `Header`, `BottomNavigation` in `app/src/components/`) |
| Icon library | `lucide-react` (existing dep; re-used — no new icons this phase) |
| Font | `var(--font-sans)` — locale-aware system stack per Phase 27 D-23 (no webfonts downloaded) |
| Animation library | `framer-motion` v12 (existing) — D-22 locks this; no new animation libs |
| Styling convention | Inline styles + CSS variables only — D-21 forbids Tailwind classes |
| Viewport | Mobile-first, 448px content-column max-width; no desktop variants |
| Haptics | `@capacitor/haptics` via `hapticImpactLight()` in `app/src/lib/haptics.ts` (web no-op, native fires) |

**Scope note:** This is a POLISH phase. No new components (D-20). No new tokens. No new packages. All work is composition over existing primitives.

---

## Spacing Scale

Declared values (multiples of 4 only; all consumed from existing codebase usage):

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Scroll-shadow threshold (`scrollTop > 4px` → header shadow on) |
| sm | 8px | Leaf pulse glow blur radius; CTA/chip inner gap |
| md | 16px | AskScreen row horizontal padding; section header side padding |
| lg | 24px | Suggested Moves section header top margin |
| xl | 32px | (not used in this phase) |
| 2xl | 48px | (not used in this phase) |
| 3xl | 64px | (not used in this phase) |

**Phase-specific geometry exceptions (all pre-existing in codebase — not invented here):**
- BottomNavigation hidden-state offset: `translateY('100%')` — Pitfall 6 resolution; height-agnostic, survives safe-area changes. Do NOT use magic `88px`.
- Outlet wrapper bottom padding: unchanged at `calc(80px + var(--safe-area-bottom))` — prevents content shift when nav appears/disappears.
- Leaf minimum tap target: inherited from Phase 25 (44×44px touch area; visual leaf can be smaller).

Exceptions: none introduced by Phase 28.

---

## Typography

All values resolve from `var(--font-sans)` and the existing global heading scale in `app/src/index.css` `@layer base`. No new sizes, weights, or line-heights introduced.

| Role | Size | Weight | Line Height | Used For |
|------|------|--------|-------------|----------|
| Body | 14px (0.875rem) | 400 | 1.4 | AskScreen recent-question row text (2-line clamp) |
| Label | 13px (0.82rem) | 400 | 1.5 | AskScreen empty-state copy ("No recent questions yet…") |
| Heading | 16px (1rem) | 600 | 1.4 | Suggested Moves section header (D-04) — matches existing `<h2>` at PlannerScreen.tsx:130; pulled to `1rem / 600` for legibility against crowded surface |
| Display | (not used in this phase) | — | — | — |

**Weights used (exactly 2):**
- Regular `400` (body, label, row text)
- Semibold `600` (section header)

**Letter-spacing:** inherit — no new tracking. Heading `<h2>` inherits `letter-spacing: -0.01em` from `index.css:231`.

**Locale awareness:** Font stack is re-routed via `var(--font-sans)` which is overridden on `:root[data-locale="zh"]` and `:root[data-locale="ja"]` (see `index.css:96-103`). Phase 28 touches no typography rule that bypasses this.

---

## Color

Phase 28 is a polish pass over existing screens — the full 60/30/10 project palette is inherited. The contract below lists only the colors Phase 28 actively applies.

| Role | Value | Usage in this phase |
|------|-------|---------------------|
| Dominant (60%) | `var(--surface)` = `#FFFBF5` (light) / `#111111` (dark) | Header background (already set); sub-screen scroll container |
| Secondary (30%) | `var(--card)`, `var(--surface-container)` | AskScreen recent-question row background |
| Accent (10%) | `var(--primary-40)` = `#558B2F` (light) / `#4CAF50` (dark) | Leaf pulse-on-focus glow ONLY |
| Divider | `var(--border)` = `rgba(0,0,0,0.08)` light / `rgba(255,255,255,0.10)` dark | BottomNavigation `borderTop` (D-08 — already present at line 147; confirm retained) |
| Shadow | `var(--shadow-1)` = `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` | Sub-screen Header scroll-aware separator (D-07) |
| Destructive | `var(--danger)` — NOT USED by Phase 28 | — (no destructive actions in polish scope) |

**Accent reserved for:**
- Leaf pulse-on-focus glow (`drop-shadow(0 0 8px var(--primary-40))`). This is the ONLY new accent application in Phase 28. The chip press (D-16), shake (D-10), and scroll shadow (D-07) all use neutral/existing values.

**Research note (token hygiene):** CONTEXT D-08 mentions `--outline-variant` — RESEARCH confirmed this token does NOT exist in `index.css`. Use `var(--border)` (already present at `BottomNavigation.tsx:147`). The border is already applied; D-08 is a verification no-op unless planner finds it missing on a specific code path.

---

## Copywriting Contract

Phase 28 introduces EXACTLY TWO new user-visible strings. Both land in all 4 locale bundles in the same PR (D-24). EN values are locked below; zh/es/ja translations are produced at execution time via the Phase 27 Sonnet-subagent workflow (`app/scripts/translate-locales.md`).

### Locked EN values

| i18n Key | EN Value | Rationale |
|----------|----------|-----------|
| `graph.headerTitle` | `"Knowledge Graph"` | D-14 rename. Replaces `"Mind Map"` by value swap (not key rename) — per RESEARCH Pattern 7, the rendered key is `graph.headerTitle`; `graph.title` is vestigial. |
| `ask.recentQuestionsEmpty` | `"No recent questions yet — ask your first one below."` | D-15 empty-state. Shown when `questions.length === 0` at AskScreen.tsx:~601. Follows em-dash + hint style used elsewhere in EN bundle. |

### Suggested translations (planner/executor refine via Sonnet subagent)

| Locale | `graph.headerTitle` | `ask.recentQuestionsEmpty` |
|--------|---------------------|----------------------------|
| zh | `"知识图谱"` | Sonnet-subagent (target: concise; mirror "ask one below" hint) |
| es | `"Grafo de conocimiento"` | Sonnet-subagent (watch ~20% length inflation; keep under 2 lines at 375px) |
| ja | `"ナレッジグラフ"` | Sonnet-subagent |

### No new copy for other decisions

| Decision | Copy impact |
|----------|-------------|
| D-04 Suggested Moves header | Already `t('planner.suggestedMoves')` at PlannerScreen.tsx:130 — styling tweak only, no copy change |
| D-05 SwipeTabContainer fix | Invisible logic fix — no copy |
| D-06 Nav slide-down | No copy |
| D-07 Header shadow | No copy |
| D-08 Nav border | No copy |
| D-10/D-11/D-12 Trellis micro-interactions | No copy (no tooltips — explicitly rejected in CONTEXT deferred) |
| D-13 Perf guard | No copy |
| D-16 Chip squish | No copy |
| D-17 Empty-state consistency pass | **Scope-limited to tone/CTA review of existing strings** — if any copy edit is required, planner appends a row to this table and routes through the same 4-bundle workflow. Default: no string changes. |
| D-18 Graph micro-tweaks | No copy |

### Destructive actions / confirmations

None in Phase 28. Polish does not touch destructive flows.

### Primary CTA for this phase

None — phase ships no new CTAs. The existing "Suggested Move" row tap (heal/replant/prune) is the interaction target for D-12 pulse but uses existing copy from Phases 25/26.

---

## Interaction Contract (Animation & Motion)

Phase 28 is mostly motion polish. Each animation is locked to concrete Framer Motion parameters below.

### D-05 — SwipeTabContainer resize re-sync (invisible)

| Property | Value |
|----------|-------|
| Trigger | `window.resize` + `window.visualViewport.resize` |
| Effect | `screenWidthRef.current = getScreenWidth()` then (if not mid-gesture) `stripX.set(-(activeIndex * screenWidthRef.current))` |
| Animation | None — instant `set()`, not `animate()`. Mid-gesture updates skipped (`lockAxisRef.current === 'x'`). |
| Dev invariant | `if (Math.abs(stripX.get() - expected) > 2) console.warn(...)` |

### D-06 — BottomNavigation slide-down

| Property | Value |
|----------|-------|
| Trigger | `isTopLevelScreen` prop from `App.tsx` RootLayout |
| Hidden state | `y: '100%'` (height-agnostic — see Pitfall 6) |
| Visible state | `y: 0` |
| Spring | `{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }` — duplicate from `SwipeTabContainer.tsx:38` `SPRING` constant. Avoid cross-file import to prevent circular dep. |
| Initial | `initial={{ y: 0 }}` — suppresses first-mount slide animation |

### D-07 — Sub-screen Header scroll-aware shadow

| Property | Value |
|----------|-------|
| Scroll source | `App.tsx` sub-screen Outlet wrapper (`overflow: auto` at line 223) — ONE location, covers all sub-screens |
| Threshold | `scrollTop > 4px` (natural hysteresis) |
| Applied value | `boxShadow: 'var(--shadow-1)'` when scrolled; `boxShadow: 'none'` at rest |
| Transition | `transition: 'box-shadow 150ms ease-out'` inline on `<Header>` element |
| Plumbing | React state `[headerScrolled, setHeaderScrolled]` in RootLayout → passed as `scrolled: boolean` prop to `Header`. CSS-variable approach rejected (calc can't multiply `box-shadow`). |
| Top-level screens | Unaffected — headers stay flat |

### D-08 — BottomNavigation top separator

| Property | Value |
|----------|-------|
| Value | `borderTop: '1px solid var(--border)'` |
| Location | `BottomNavigation.tsx:147` — ALREADY PRESENT |
| Action | Verify on render; add only if missing. Likely no-op. |

### D-10 — Trellis leaf tap-shake

| Property | Value |
|----------|-------|
| Trigger | `onClick` on individual leaf `<motion.g>` (requires `pointerEvents: 'auto'` per leaf — TrellisCanvas `pointerEvents: 'none'` stays on SVG root) |
| Keyframe | `rotate: [0, 4, -4, 2, 0]` (degrees) |
| Duration | `0.3s` |
| Easing | `ease: 'easeInOut'` |
| Mechanism | `useAnimationControls()` + `controls.start(...)`. Nested inner `motion.g` (shake) wrapped inside outer `motion.g` (ambient sway — preserved unchanged) |
| State response | Any leaf state (bud/green/yellow/falling/fallen/blossom/fruit) — uniform shake |
| Side effects | Zero — no tooltip, no sheet, no navigation (CONTEXT deferred rejects all three) |

### D-11 — Haptic on leaf tap

| Property | Value |
|----------|-------|
| Call | `hapticImpactLight()` fired synchronously at start of shake handler |
| Platforms | Capacitor native → light haptic; web → no-op (existing behavior of helper) |

### D-12 — Pulse-on-focus when Suggested Move row is tapped

| Property | Value |
|----------|-------|
| Trigger | `PlannerScreen` emits `focusedAnchorId` on row **`onPointerDown`** (not onClick — before nav commit per Pattern 5 Option 1) |
| Plumbing | Prop drill: PlannerScreen state → `TrellisHero` prop → `TrellisCanvas` prop → `TrellisLeaf` `focused?: boolean` prop (matching anchorId) |
| Scale keyframe | `scale: [1, 1.15, 1]` |
| Scale duration | `0.6s`, `ease: 'easeInOut'` |
| Glow filter keyframe | `filter: ['drop-shadow(0 0 0px transparent)', 'drop-shadow(0 0 8px var(--primary-40))', 'drop-shadow(0 0 0px transparent)']` |
| Glow duration | `2.0s` total (peak at ~0.3s, linear fade-out to 2.0s) |
| Glow easing | `ease: 'easeOut'` on the decay half (front-loaded peak) |
| Auto-clear | `setTimeout(() => setFocusedAnchorId(null), 2000)` in PlannerScreen; on row click the target navigation unmounts PlannerScreen → state clears naturally |
| Repeat-tap re-trigger | Use `key={`pulse-${anchorId}-${focusCounter}`}` on the inner motion.g so repeated row taps re-fire the animation |
| Suggested Move row visual feedback | **Row itself uses the existing `active-squish` class** (chip squish per D-16) — no additional highlight or ring. Pulse is the only cross-surface feedback. |

### D-13 — Performance guard

| Property | Value |
|----------|-------|
| Threshold | `TAP_ANIMATION_THRESHOLD = 30` leaves (differs from Phase 25's ambient-sway 20 — shake/pulse are event-driven, higher ceiling acceptable per RESEARCH Open Question 3) |
| Implementation | Primary: count gate (`if (layout.nodes.length > 30) { onlyAnimateInView = true }`). Optional: Framer `useInView()` per leaf — planner decides if visible-only gating is required at 30–50 node range |
| Off-screen leaves | Shake/pulse become no-op (animations skipped entirely, not just throttled) |
| Documentation requirement | Add side-by-side comment documenting both thresholds (20 ambient, 30 tap) in `TrellisCanvas.tsx` |

### D-15 — AskScreen recent-question row

| Property | Value |
|----------|-------|
| Row visual | `<button>` — background `var(--card)`, border `1.5px solid var(--border)`, `borderRadius: '18px'`, padding `11px 16px` |
| Row layout | `display: flex, justifyContent: 'space-between', alignItems: 'center', gap: 8px` |
| Row content | Question text (left, flex-1, 2-line clamp) + `→` chevron (right, `var(--muted-foreground)`, flex-shrink: 0) |
| Font | `0.875rem / 400 / line-height 1.4` |
| 2-line clamp | `display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'` |
| Bullet prefix | **REMOVED** — the hardcoded `• ` at line 623 (now ~629) deleted. No leading icon replacement — plain text. |
| Press feedback | `className="active-squish"` (D-16 applies here too — `transform: scale(0.96)` on active per index.css:336-342) |
| On tap | `navigate(/ask/${q.id})` |
| Empty state | Plain `<p>` with `ask.recentQuestionsEmpty` copy, `fontSize: 0.82rem`, `color: var(--muted-foreground)`, `paddingLeft: 4px`. No icon, no illustration — polish phase stays restrained. |

### D-16 — Chip press squish

| Property | Value |
|----------|-------|
| Utility | `className="active-squish"` (already defined `index.css:336-342`) |
| Effect | `transform: scale(0.96); opacity: 0.85` on `:active` pseudostate |
| Transition | `transform 0.12s ease, opacity 0.12s ease` |
| Scope (planner confirms exact list) | Suggested Move row chips (heal/replant/prune badges on PlannerScreen rows); AskScreen recent-question rows; any other rows the planner identifies as "chip-like" during implementation |
| Non-scope | Existing `TabButton` already uses `active-squish` (BottomNavigation) — no change |

### D-18 — Graph screen micro-tweaks

Planner-decided consolidated task. Placeholder entries (planner replaces with audit-report-sourced specifics before executor sees the spec):

- Toolbar button alignment (check vertical centering on `GraphScreen` header row)
- Reorganize icon padding (visual breathing room)
- Canvas bottom padding when BottomNavigation slides away (leverages D-06 — may become moot)

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none — project does not use shadcn | not applicable |
| third-party | none | not applicable |

Phase 28 installs ZERO new packages and introduces ZERO third-party UI code. All changes are composition over existing in-house components + existing `framer-motion`, `react-i18next`, `@capacitor/haptics`, `lucide-react`, and `react-router-dom` installations.

---

## Cross-Cutting Constraints

Codified from CONTEXT D-20..D-25 for executor lookup:

1. **No new components.** Extend `Header`, `BottomNavigation`, `TrellisLeaf`, `SwipeTabContainer`, `TrellisCanvas`, `TrellisHero`, `PlannerScreen`, `AskScreen`, `GraphScreen`. Create no new React component files unless a peer reviewer explicitly signs off. (D-20)
2. **Inline styles + CSS variables only.** No Tailwind class additions. No new CSS `@keyframes` — use Framer Motion variants. (D-21)
3. **Framer Motion exclusively for animation.** No CSS transitions longer than `150ms` introduced outside of the `box-shadow` transition explicitly called out in D-07. (D-22)
4. **Event bus vs. props for `focusedAnchorId`:** **Props wins** for this phase (3-level drill, transparent data flow). Don't route through `eventBus`. (D-23 discretion → closed here)
5. **All new user-visible strings go through `t(...)` and land in en/zh/es/ja in one PR.** `bundle-parity.test.mjs` enforces key-set parity. (D-24)
6. **Manual UAT per audit row.** Each of D-04..D-19 has a before/after verification step in `28-VALIDATION.md`. No automated e2e this phase. (D-25)

---

## Mobile-First Contract

- **Content column:** 448px max (existing). No tablet or desktop breakpoints introduced.
- **Safe area:** `var(--safe-area-bottom)` and `var(--safe-area-top)` respected in all nav/header positioning. BottomNavigation slide-down's `y: '100%'` naturally respects safe-area — no manual addition needed.
- **Touch targets:** Leaf tap targets stay at 44px min (Phase 25 inherited); AskScreen row meets 48px+ via 11px padding × 2 + 2 lines of body text.
- **Viewport listeners:** D-05 adds `window.visualViewport.resize` → correctly handles iOS keyboard show/hide, Android chrome collapse, device rotation.

---

## Decision Resolution Matrix

The 11 known-unknowns flagged in the spawn prompt, resolved:

| # | Question | Locked Answer | Source |
|---|----------|---------------|--------|
| 1 | Leaf pulse glow specifics | `drop-shadow(0 0 8px var(--primary-40))` | CONTEXT D-12 (8px locked) |
| 2 | Pulse fade-out curve | Keyframe with `ease: 'easeInOut'` on scale (0.6s); `ease: 'easeOut'` on filter decay (2.0s front-loaded peak) | UI-SPEC decision (prompt unknown #2) |
| 3 | Section-header typography for D-04 | `1rem / 600 / 1.4` inheriting existing `<h2>` from `index.css:227-232`; no size increase (audit feedback is about visual prominence via margin/contrast, not size) | UI-SPEC decision (prompt unknown #3) — planner may tune padding during implementation |
| 4 | Empty-state copy wording | `ask.recentQuestionsEmpty` = `"No recent questions yet — ask your first one below."` Other D-17 empty states default to NO COPY CHANGE this phase unless planner flags during execution | UI-SPEC decision (prompt unknown #4) |
| 5 | AskScreen recent-row visual (card bg or plain?) | **Card-like:** `var(--card)` bg, `1.5px solid var(--border)`, `18px` radius, `active-squish` press. Bullet REMOVED with no replacement. | UI-SPEC decision (prompt unknown #5) — matches Phase 26 row style |
| 6 | Sub-screen header shadow transition | `box-shadow 150ms ease-out` inline | UI-SPEC decision (prompt unknown #6) |
| 7 | Which chips get D-16 squish | Suggested Move rows + AskScreen recent-question rows. Planner may add more if `active-squish` is already applied or trivially fits. | UI-SPEC decision (prompt unknown #7) |
| 8 | Suggested Moves row focus visual | `active-squish` only (no ring, no highlight). Pulse is the cross-surface feedback. | UI-SPEC decision (prompt unknown #8) |
| 9 | Mobile vs desktop | **Mobile-only. 448px max content column.** No breakpoints introduced. | CLAUDE.md + CONTEXT implicit |
| 10 | Scroll-aware shadow transition duration | `150ms ease-out` | UI-SPEC decision (prompt unknown #10) — aligned with question 6 |
| 11 | Graph screen D-18 specifics | Deferred to planner (consolidated task per CONTEXT D-18/D-09/D-19) — placeholder list above in D-18 section | CONTEXT D-18 explicitly delegates |

---

## Files Changed by This Contract

Primary (editable by executor):

- `app/src/App.tsx` — Outlet wrapper onScroll handler; `isTopLevelScreen` prop to `BottomNavigation`; `scrolled` prop to `Header`.
- `app/src/components/BottomNavigation.tsx` — Wrap `<nav>` as `motion.nav` with `y`/`SPRING`. Verify existing `borderTop`.
- `app/src/components/SwipeTabContainer.tsx` — New resize + visualViewport `useEffect`; harden `useLayoutEffect` to refresh `screenWidthRef` before read; dev invariant.
- `app/src/components/ui/Header.tsx` — Accept `scrolled?: boolean` prop; apply `boxShadow` + `transition: 'box-shadow 150ms ease-out'`.
- `app/src/components/trellis/TrellisLeaf.tsx` — Nested inner `motion.g` for shake + pulse; `useAnimationControls`; `onClick` handler with `hapticImpactLight()`; accept `focused?: boolean` prop.
- `app/src/components/trellis/TrellisCanvas.tsx` — Set `pointerEvents: 'auto'` on individual leaf `<g>`; thread `focusedAnchorId` prop to each leaf; perf guard (count threshold 30).
- `app/src/components/trellis/TrellisHero.tsx` — Accept + forward `focusedAnchorId`.
- `app/src/screens/PlannerScreen.tsx` — `focusedAnchorId` state; row `onPointerDown` emits + `setTimeout(clear, 2000)`; apply `active-squish` class to chips; Suggested Moves header styling tweak.
- `app/src/screens/GraphScreen.tsx` — No change IF `t('graph.headerTitle')` already renders (RESEARCH confirms it does); only the locale-bundle values change.
- `app/src/screens/AskScreen.tsx` — Row `<button>` refactor per D-15; remove `• ` bullet; empty-state block; update stale `Mind Map` comment at line 234.
- `app/src/locales/en.json` — Value swap `graph.headerTitle` → `"Knowledge Graph"`; new key `ask.recentQuestionsEmpty`.
- `app/src/locales/zh.json` — Value swap `graph.headerTitle` → `"知识图谱"`; new key `ask.recentQuestionsEmpty` (Sonnet).
- `app/src/locales/es.json` — Value swap `graph.headerTitle` → `"Grafo de conocimiento"`; new key `ask.recentQuestionsEmpty` (Sonnet).
- `app/src/locales/ja.json` — Value swap `graph.headerTitle` → `"ナレッジグラフ"`; new key `ask.recentQuestionsEmpty` (Sonnet).

Read-but-not-modified:

- `app/src/lib/haptics.ts` — consumer only.
- `app/src/lib/swipe-tab-context.ts` — no signature change.
- `app/src/lib/event-bus.ts` — not routed through for this phase.
- `app/src/index.css` — zero edits. `active-squish` already defined lines 336-342; `--shadow-1` already defined line 78; `--primary-40` already defined line 12; `--border` already defined line 40.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS — 2 new strings locked EN; 4-bundle parity enforced by `bundle-parity.test.mjs`
- [ ] Dimension 2 Visuals: PASS — all animations specified with concrete Framer Motion params
- [ ] Dimension 3 Color: PASS — accent (`--primary-40`) reserved exclusively for leaf pulse glow; 60/30/10 inherited
- [ ] Dimension 4 Typography: PASS — 2 weights (400/600), 3 sizes (0.82rem/0.875rem/1rem), all existing
- [ ] Dimension 5 Spacing: PASS — strict 4-grid; only existing CSS-var sourced dimensions; exceptions documented
- [ ] Dimension 6 Registry Safety: PASS — no new packages, no third-party registries, no shadcn

**Approval:** pending
