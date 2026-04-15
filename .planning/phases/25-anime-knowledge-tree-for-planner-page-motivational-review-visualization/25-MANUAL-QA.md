# Phase 25 — Manual QA Checklist

Run this list after all automated waves pass. Tick items as they are verified on a real device + desktop Chrome.

## Environment

- [ ] `npm --prefix app run build` succeeds
- [ ] App loaded in Chrome desktop at http://localhost:5173
- [ ] App loaded on real iOS device via Capacitor (if available)
- [ ] Real AI assets present in `app/src/assets/planner-trellis/` (if not, note which variants fall back)

## Variant A (Static Image + SVG)

- [ ] Set `localStorage.setItem('trellis_variant_dev', 'A')`; reload PlannerScreen
- [ ] If `trellis-bg-default.webp` exists, Ghibli watercolor background renders full-bleed
- [ ] If asset absent, warm gradient fallback renders without console errors
- [ ] Vine draw-on animation visible over background on first mount
- [ ] Leaves pop in staggered after vines finish
- [ ] Tap a leaf — tooltip appears with correct copy per state
- [ ] Side-by-side comparison with `.planning/phases/25-.../mockup-variant-a.png` (if available): palette matches, composition matches

## Variant C (Pure SVG)

- [ ] Set variant to 'C'; reload
- [ ] Warm gradient sky + faint lattice renders; no image/video network requests
- [ ] Vine draw-on visible
- [ ] Leaves pop in with correct state colors (inspect DevTools — `fill="var(--node-mint)"` etc.)
- [ ] Side-by-side with `mockup-variant-c.png`: flat aesthetic matches

## Interaction

- [ ] Tap outside tooltip — closes (fade-out 120ms)
- [ ] Tap close x button — closes
- [ ] Tap another leaf while tooltip open — previous closes, new opens (no overlap)
- [ ] Tap Review — navigates to /review with anchorReview filter (flashcards filtered to this anchor's Q&As)
- [ ] Tap View Q&As — navigates to /anchor/{id}
- [ ] Tooltip never overflows hero bounds even on corner-positioned leaves
- [ ] Aria-label on hero root reads "Knowledge garden — your review health visualization"
- [ ] Screen reader announces leaf labels with anchor name + state + Q&A count

## States

- [ ] Empty state (log out / fresh localStorage): `Plant your first seed` + seed emoji + `Ask a question` CTA. Tap CTA — navigates to /ask.
- [ ] Populated state with mixed anchor health: green, yellow, falling, fallen states visible with correct colors
- [ ] If a blossom-eligible anchor exists: blossom petal shape renders in `var(--accent-lavender)` hue
- [ ] If a fruit-eligible anchor exists (blossom date >= 7 days ago in localStorage): red-coral fruit shape renders

## Review loop (closes the real pipeline)

- [ ] With a falling/yellow anchor visible, navigate to /review, submit a 4-star review on one of its child Q&As
- [ ] Return to Planner — the leaf's state updates (may require remount if already on Planner — known limitation, note for retrospective)
- [ ] OR: stay on Planner after review — event-driven update triggers recompute and leaf color transition

## Ambient animation gates

- [ ] Sway visible on at least 1 leaf when on Planner (count <= 20 — all leaves sway; > 20 — every 3rd)
- [ ] Navigate to Home tab; inspect DevTools Performance — no transform/rotate recalcs on trellis leaves (sway paused)

## Accessibility

- [ ] Keyboard focus on leaves: tab cycles through, Enter/Space opens tooltip
- [ ] Tooltip close button has aria-label `Close tooltip`
- [ ] Contrast ratio of tooltip text passes WCAG AA (DevTools — accessibility check)

## Variant comparison and decision

After both variants (A and C) are validated on real hardware:

- [ ] User reviews both variants back-to-back
- [ ] User picks default variant for the next release (captured in retrospective; dev picker stays until Phase 26 settles on one)
- [ ] Document the decision in `.planning/STATE.md` under "Latest Decisions"
