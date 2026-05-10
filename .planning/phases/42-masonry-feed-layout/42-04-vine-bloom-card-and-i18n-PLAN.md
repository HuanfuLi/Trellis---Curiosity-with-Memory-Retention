---
phase: 42-masonry-feed-layout
plan: 04
type: execute
wave: 2
depends_on: ["42-01"]
files_modified:
  - app/src/components/MasonryFeed.tsx
  - app/src/locales/en.json
  - app/src/locales/zh.json
  - app/src/locales/es.json
  - app/src/locales/ja.json
  - app/src/locales/i18n.d.ts
autonomous: true
requirements: [MASONRY-02]
must_haves:
  truths:
    - "VineBloomCard component (co-located in MasonryFeed.tsx per UI-SPEC Open Items recommendation) replaces the placeholder stub from plan 42-01"
    - "VineBloomCard consumes useTrellisData() directly to derive heal/replant suggestions (RESEARCH.md § 1 path b — NO new trellisActionsService getter)"
    - "VineBloomCard renders inline SVG vine illustration matching vineLoadingPulse aesthetic at HomeScreen.tsx:759-767 (UI-SPEC § Vine SVG Specification — verbatim)"
    - "12 new home.celebration.* keys exist in all 4 locale bundles (en/zh/es/ja) with bundle parity"
    - "1 deprecated home.toast.noMorePosts key removed from all 4 locale bundles symmetrically"
    - "Action rows route via trellisActionsService.heal() / .replant() returning ActionNavigationResult, then navigate(result.navigateTo, { state: result.state })"
    - "Open Planner CTA routes to /planner via useNavigate"
    - "framer-motion celebration entrance + bloom path-draw use the variants verbatim from UI-SPEC § Animation Contract"
  artifacts:
    - path: "app/src/components/MasonryFeed.tsx"
      provides: "VineBloomCard fully implemented (replaces 42-01 placeholder)"
      contains: "function VineBloomCard"
    - path: "app/src/locales/en.json"
      provides: "12 new home.celebration.* keys; home.toast.noMorePosts deleted"
      contains: "celebration"
    - path: "app/src/locales/zh.json"
      provides: "12 new keys translated to zh"
    - path: "app/src/locales/es.json"
      provides: "12 new keys translated to es"
    - path: "app/src/locales/ja.json"
      provides: "12 new keys translated to ja"
    - path: "app/src/locales/i18n.d.ts"
      provides: "Module augmentation updated for new home.celebration.* keys (and removed home.toast.noMorePosts)"
  key_links:
    - from: "app/src/components/MasonryFeed.tsx (VineBloomCard)"
      to: "app/src/state/useTrellisData.ts"
      via: "useTrellisData() hook → layout.nodes.filter(n => n.leafState === 'dead' | 'dying' | 'falling')"
      pattern: "useTrellisData"
    - from: "app/src/components/MasonryFeed.tsx (VineBloomCard)"
      to: "app/src/services/trellis-actions.service.ts"
      via: "trellisActionsService.heal() / .replant() returning ActionNavigationResult"
      pattern: "trellisActionsService\\.(heal|replant)"
    - from: "all 4 locale bundles"
      to: "VineBloomCard t() calls"
      via: "i18next bundle parity"
      pattern: "home\\.celebration\\."
---

<objective>
Replace the `VineBloomCard` placeholder in `app/src/components/MasonryFeed.tsx` (introduced as `function VineBloomCard() { return null }` in plan 42-01) with the full implementation per UI-SPEC § VineBloomCard internal layout + § Vine SVG Specification + RESEARCH.md § Example 2.

Add 12 new i18n keys under `home.celebration.*` namespace to all 4 locale bundles (en canonical + zh/es/ja translated via Sonnet subagent per `app/scripts/translate-locales.md`). Delete the deprecated `home.toast.noMorePosts` key from all 4 bundles symmetrically. Update `i18n.d.ts` module augmentation to reflect both changes.

The card consumes `useTrellisData()` directly (RESEARCH.md § 1 path b — NO new `trellisActionsService.getCelebrationSuggestions()` getter; mirrors PlannerScreen.tsx:46-47's filter pattern). Action rows use the existing `trellisActionsService.heal()` / `.replant()` handlers; CTA uses `useNavigate('/planner')`.

Purpose: Close MASONRY-02 (vine-bloom celebration card replaces the bare toast) by shipping the actual celebration UI + the i18n bundle parity for it.

Output: Modified `MasonryFeed.tsx` with real VineBloomCard implementation; 4 locale bundles updated; `i18n.d.ts` module augmentation updated.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/42-masonry-feed-layout/42-CONTEXT.md
@.planning/phases/42-masonry-feed-layout/42-RESEARCH.md
@.planning/phases/42-masonry-feed-layout/42-UI-SPEC.md

# Source-of-truth files for the implementation
@app/src/components/MasonryFeed.tsx
@app/src/screens/PlannerScreen.tsx
@app/src/services/trellis-actions.service.ts
@app/src/state/useTrellisData.ts
@app/src/services/daily-read.service.ts
@app/src/locales/en.json
@app/src/locales/zh.json
@app/src/locales/es.json
@app/src/locales/ja.json
@app/src/locales/i18n.d.ts
@app/scripts/translate-locales.md

<interfaces>
**EN canonical keys to ADD** (verbatim from UI-SPEC § i18n Bundle Updates):

```json
"celebration": {
  "vineBloomTitle": "Vine in bloom",
  "suggestionsHeader": "Tomorrow's vine tending",
  "healAction": "Heal '{{anchor}}'",
  "replantAction": "Re-plant '{{anchor}}'",
  "healBadge": "dying",
  "replantBadge": "dead",
  "fallbackHealthy": "Your vine is fully healthy.",
  "fallbackReviewCount": "{{count}} anchor will be due for review tomorrow.",
  "fallbackReviewCount_other": "{{count}} anchors will be due for review tomorrow.",
  "fallbackReviewCountZero": "Check back tomorrow for fresh concepts.",
  "openPlanner": "Open Planner",
  "actionRowAria": "{{action}} {{anchor}} — opens action"
}
```

**Key to DELETE from all 4 bundles:**
- `home.toast.noMorePosts` (sole consumer at HomeScreen.tsx:240 was deleted in plan 42-02; verified zero other consumers via `grep -rn "home.toast.noMorePosts" app/src/` returns 0 after plan 42-02 lands)

**Note on parent object:** `home.toast` in en.json contains ONLY `noMorePosts`. After deletion, the entire `home.toast` object should be removed from each bundle. Verify other 3 bundles also contain ONLY `noMorePosts` under `home.toast` before deleting the parent — if any bundle has other keys under `home.toast`, only delete the `noMorePosts` key.

**framer-motion variants for VineBloomCard** (verbatim from UI-SPEC § Animation Contract):
```typescript
const celebrationVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};
const bloomPathVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1 },
};
```

**Inline SVG (verbatim from UI-SPEC § Vine SVG Specification):** see UI-SPEC.md lines 336-358.

**trellisActionsService surface** (read directly from app/src/services/trellis-actions.service.ts):
```typescript
heal(anchorId: string, anchorName: string, qaChildIds: string[]): ActionNavigationResult
  // returns { navigateTo: '/review', state: { ... } }
replant(anchorId: string, anchorQuestion: Question, qaChildIds: string[]): ActionNavigationResult
  // returns { navigateTo: `/posts/anchor-post-${anchorId}`, state: { ... } }
```

**useTrellisData()** (from app/src/state/useTrellisData.ts):
```typescript
const { layout } = useTrellisData();
// layout.nodes: TrellisNode[] — each has leafState, anchor (with title/content/id), qaChildren
const deadNodes = layout.nodes.filter((n) => n.leafState === 'dead');
const dyingNodes = layout.nodes.filter((n) => n.leafState === 'dying' || n.leafState === 'falling');
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace VineBloomCard placeholder in MasonryFeed.tsx with full implementation (consumes useTrellisData + trellisActionsService + i18n)</name>
  <files>app/src/components/MasonryFeed.tsx</files>
  <read_first>
    - app/src/components/MasonryFeed.tsx (read entire file — locate the `function VineBloomCard() { return null; }` placeholder from plan 42-01 and the surrounding gate `{allExplored && (...)}` block)
    - app/src/screens/PlannerScreen.tsx (lines 46-92 — verbatim suggestion derivation pattern + heal/replant handler shape; lines 197 + 247 — icon color convention #4CAF50/#66BB6A)
    - .planning/phases/42-masonry-feed-layout/42-UI-SPEC.md (§ VineBloomCard internal layout lines 237-266, § Vine SVG Specification lines 332-367, § Animation Contract lines 270-329 — verbatim source for all visual + animation values)
    - .planning/phases/42-masonry-feed-layout/42-RESEARCH.md (§ Example 2 lines 638-792 — full skeleton; § 1 lines 971-1008 — useTrellisData consumption rationale; § Pitfall 2 — allExplored is computed by HomeScreen, not by VineBloomCard)
    - app/src/services/daily-read.service.ts (confirm getExploredAnchors() signature)
    - app/src/services/trellis-actions.service.ts (confirm heal/replant signatures + ActionNavigationResult shape)
    - app/src/state/useTrellisData.ts (confirm layout.nodes shape — leafState/anchor/qaChildren fields)
    - app/src/state/useQuestions.ts (confirm questions array shape — for due-tomorrow count)
  </read_first>
  <behavior>
    - Test 1: After edit, MasonryFeed.tsx contains `function VineBloomCard()` AND the function body is NOT just `return null`
    - Test 2: VineBloomCard imports/uses `useTrellisData` from `../state/useTrellisData`
    - Test 3: VineBloomCard imports/uses `trellisActionsService` from `../services/trellis-actions.service`
    - Test 4: VineBloomCard imports/uses `useNavigate` from `react-router-dom`
    - Test 5: VineBloomCard imports/uses `useTranslation` from `react-i18next`
    - Test 6: VineBloomCard contains the inline SVG (`<svg width="88" height="88" viewBox="0 0 88 88"`) + `<motion.circle` for the bloom
    - Test 7: VineBloomCard references `t('home.celebration.vineBloomTitle')`, `t('home.celebration.openPlanner')`, AND at least one of `t('home.celebration.healAction'`, `t('home.celebration.replantAction'`, `t('home.celebration.fallbackHealthy'`
    - Test 8: VineBloomCard contains the leafState filter `n.leafState === 'dead'` AND `n.leafState === 'dying'` (PlannerScreen pattern)
    - Test 9: tsc -b --noEmit exits 0
    - Test 10: NO new trellisActionsService method added (no edits to trellis-actions.service.ts)
  </behavior>
  <action>
    Replace the placeholder `function VineBloomCard() { return null; }` in `app/src/components/MasonryFeed.tsx` with the full implementation, AND add the necessary imports at the top of the file.

    **EDIT 1 — Augment imports at top of MasonryFeed.tsx:**

    Add these imports (preserve existing imports from plan 42-01):
    ```typescript
    import { useNavigate } from 'react-router-dom';
    import { useTranslation } from 'react-i18next';
    import { Heart, Sprout } from 'lucide-react';
    import { useTrellisData } from '../state/useTrellisData';
    import { useQuestions } from '../state/useQuestions';
    import { dailyReadService } from '../services/daily-read.service';
    import { trellisActionsService } from '../services/trellis-actions.service';
    ```

    Note: `useLocation` and `motion`/`Variants`/`MotionConfig` are already imported from plan 42-01. Do NOT duplicate.

    **EDIT 2 — Add VineBloomCard variants near the top of the file (after the existing `tileEnterVariants` constant):**

    ```typescript
    // VineBloomCard animation variants (UI-SPEC § Animation Contract — verbatim)
    const celebrationVariants: Variants = {
      hidden: { opacity: 0, y: 12 },
      visible: { opacity: 1, y: 0 },
    };
    const bloomPathVariants: Variants = {
      hidden: { pathLength: 0, opacity: 0 },
      visible: { pathLength: 1, opacity: 1 },
    };
    ```

    **EDIT 3 — Replace the `function VineBloomCard() { return null; }` placeholder with the FULL implementation:**

    Use this exact body (mirror RESEARCH.md § Example 2 lines 662-791 — verbatim with the exact handlers, copy structure, and styles from UI-SPEC § VineBloomCard internal layout):

    ```tsx
    function VineBloomCard() {
      const navigate = useNavigate();
      const { t } = useTranslation();
      const { layout } = useTrellisData();
      const { questions } = useQuestions();

      // Suggestion derivation — mirrors PlannerScreen.tsx:46-47 (RESEARCH.md § 1 path b: hook-level reuse, no service surface change)
      const deadNodes = layout.nodes.filter((n) => n.leafState === 'dead');
      const dyingNodes = layout.nodes.filter(
        (n) => n.leafState === 'dying' || n.leafState === 'falling'
      );

      // Take up to 2 (priority: 1 dead + 1 dying; fall back to 2 of either)
      const suggestions: Array<{ kind: 'heal' | 'replant'; node: typeof deadNodes[number] }> = [];
      if (deadNodes[0]) suggestions.push({ kind: 'replant', node: deadNodes[0] });
      if (dyingNodes[0]) suggestions.push({ kind: 'heal', node: dyingNodes[0] });
      if (suggestions.length < 2 && deadNodes[1]) suggestions.push({ kind: 'replant', node: deadNodes[1] });
      if (suggestions.length < 2 && dyingNodes[1]) suggestions.push({ kind: 'heal', node: dyingNodes[1] });

      // Fallback prose data
      const dueTomorrowCount = questions.filter((q) => q.isAnchorNode).length;
      // Note: A more precise "due tomorrow" filter would compare q.reviewSchedule.nextReviewDate
      // to addDays(today(), 1). For v1, anchor count is a reasonable proxy that matches the
      // "your vine is fully healthy" framing. Refine in a follow-up if UAT requests precision.

      const handleHeal = (node: typeof dyingNodes[number]) => {
        const anchorName = node.anchor.title ?? node.anchor.content ?? 'anchor';
        const qaChildIds = node.qaChildren.map((q) => q.id);
        const result = trellisActionsService.heal(node.anchor.id, anchorName, qaChildIds);
        navigate(result.navigateTo, { state: result.state });
      };

      const handleReplant = (node: typeof deadNodes[number]) => {
        const qaChildIds = node.qaChildren.map((q) => q.id);
        const result = trellisActionsService.replant(node.anchor.id, node.anchor, qaChildIds);
        navigate(result.navigateTo, { state: result.state });
      };

      return (
        <motion.div
          variants={celebrationVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            background: 'var(--card)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-2)',
            padding: '24px 20px',
          }}
        >
          {/* Vine SVG — verbatim from UI-SPEC § Vine SVG Specification */}
          <svg
            width="88"
            height="88"
            viewBox="0 0 88 88"
            fill="none"
            style={{ display: 'block', margin: '0 auto 16px' }}
          >
            <line x1="44" y1="76" x2="44" y2="32" stroke="var(--primary-40)" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="32" cy="56" rx="10" ry="6" stroke="var(--primary-40)" strokeWidth="2" fill="none" transform="rotate(-25 32 56)" />
            <ellipse cx="56" cy="56" rx="10" ry="6" stroke="var(--primary-40)" strokeWidth="2" fill="none" transform="rotate(25 56 56)" />
            <ellipse cx="34" cy="42" rx="8" ry="5" stroke="var(--primary-40)" strokeWidth="2" fill="none" transform="rotate(-30 34 42)" />
            <ellipse cx="54" cy="42" rx="8" ry="5" stroke="var(--primary-40)" strokeWidth="2" fill="none" transform="rotate(30 54 42)" />
            <motion.circle
              cx="44"
              cy="22"
              r="10"
              fill="var(--node-peach)"
              stroke="var(--primary-40)"
              strokeWidth="2"
              variants={bloomPathVariants}
              initial="hidden"
              animate="visible"
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
            />
            <circle cx="44" cy="22" r="3" fill="var(--primary-40)" />
          </svg>

          {/* Title */}
          <p
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--primary-40)',
              textAlign: 'center',
              marginBottom: 8,
              lineHeight: 1.3,
            }}
          >
            {t('home.celebration.vineBloomTitle')}
          </p>

          {/* Suggestions OR fallback prose */}
          {suggestions.length > 0 ? (
            <>
              <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: 12 }}>
                {t('home.celebration.suggestionsHeader')}
              </p>
              {suggestions.map((s, idx) => {
                const isLast = idx === suggestions.length - 1;
                const Icon = s.kind === 'heal' ? Heart : Sprout;
                const iconColor = s.kind === 'heal' ? '#66BB6A' : '#4CAF50'; // PlannerScreen convention
                const labelKey = s.kind === 'heal' ? 'home.celebration.healAction' : 'home.celebration.replantAction';
                const badgeKey = s.kind === 'heal' ? 'home.celebration.healBadge' : 'home.celebration.replantBadge';
                const anchorName = s.node.anchor.title ?? s.node.anchor.content ?? 'anchor';
                return (
                  <button
                    key={s.node.anchor.id}
                    className="active-squish"
                    onClick={() => (s.kind === 'heal' ? handleHeal(s.node) : handleReplant(s.node))}
                    aria-label={t('home.celebration.actionRowAria', {
                      action: t(labelKey, { anchor: anchorName }),
                      anchor: anchorName,
                    })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      minHeight: 44,
                      padding: '12px 0',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <Icon size={16} color={iconColor} />
                    <span
                      style={{
                        fontSize: '0.9rem',
                        flex: 1,
                        textAlign: 'left',
                        color: 'var(--foreground)',
                      }}
                    >
                      {t(labelKey, { anchor: anchorName })}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                      {t(badgeKey)}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--foreground)',
                  textAlign: 'center',
                  marginBottom: 4,
                }}
              >
                {t('home.celebration.fallbackHealthy')}
              </p>
              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--muted-foreground)',
                  textAlign: 'center',
                  maxWidth: 280,
                  margin: '0 auto',
                }}
              >
                {dueTomorrowCount > 0
                  ? t('home.celebration.fallbackReviewCount', { count: dueTomorrowCount })
                  : t('home.celebration.fallbackReviewCountZero')}
              </p>
            </>
          )}

          {/* Open Planner CTA */}
          <button
            onClick={() => navigate('/planner')}
            className="active-squish"
            style={{
              display: 'block',
              margin: '16px auto 0',
              minHeight: 44,
              padding: '12px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--primary-40)',
              textDecoration: 'underline',
            }}
          >
            {t('home.celebration.openPlanner')}
          </button>
        </motion.div>
      );
    }
    ```

    **DO NOT TOUCH:**
    - `app/src/services/trellis-actions.service.ts` — NO new method added (RESEARCH.md § 1 explicitly recommends path b: hook-level consumption over service-surface expansion)
    - `app/src/state/useTrellisData.ts` — NO changes
    - The MasonryFeed component itself (height-accumulator + render logic from plan 42-01) — UNCHANGED
    - The placeholder gate `{allExplored && (<div style={{ marginTop: '24px' }}><VineBloomCard /></div>)}` — UNCHANGED

    Atomic commit message: `feat(42): implement VineBloomCard with useTrellisData consumption + framer-motion bloom + i18n`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; grep -q "function VineBloomCard" src/components/MasonryFeed.tsx &amp;&amp; grep -q "useTrellisData" src/components/MasonryFeed.tsx &amp;&amp; grep -q "trellisActionsService" src/components/MasonryFeed.tsx &amp;&amp; grep -q "useNavigate" src/components/MasonryFeed.tsx &amp;&amp; grep -q "useTranslation" src/components/MasonryFeed.tsx &amp;&amp; grep -q "home.celebration.vineBloomTitle" src/components/MasonryFeed.tsx &amp;&amp; grep -q "home.celebration.openPlanner" src/components/MasonryFeed.tsx &amp;&amp; grep -q "leafState === 'dead'" src/components/MasonryFeed.tsx &amp;&amp; grep -q "leafState === 'dying'" src/components/MasonryFeed.tsx &amp;&amp; grep -q 'viewBox="0 0 88 88"' src/components/MasonryFeed.tsx &amp;&amp; grep -q "motion.circle" src/components/MasonryFeed.tsx &amp;&amp; ! grep -q "function VineBloomCard() { return null; }" src/components/MasonryFeed.tsx &amp;&amp; npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "function VineBloomCard" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "function VineBloomCard() { return null; }" app/src/components/MasonryFeed.tsx` returns `0` (placeholder gone)
    - `grep -c "useTrellisData" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "trellisActionsService" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "useNavigate" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "useTranslation" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "home.celebration.vineBloomTitle" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "home.celebration.openPlanner" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "home.celebration.fallbackHealthy" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "leafState === 'dead'" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "leafState === 'dying'" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c 'viewBox="0 0 88 88"' app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "motion.circle" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "celebrationVariants" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `grep -c "bloomPathVariants" app/src/components/MasonryFeed.tsx` returns ≥ `1`
    - `git diff app/src/services/trellis-actions.service.ts` shows ZERO changes (no new method added)
    - `cd app && npx tsc -b --noEmit` exits 0
  </acceptance_criteria>
  <done>VineBloomCard fully implemented; consumes useTrellisData hook (no service surface change); SVG + framer-motion + i18n all wired; tsc clean. Pending i18n bundle parity (Tasks 2-3).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add 12 home.celebration.* keys to en.json + delete home.toast.noMorePosts (en canonical)</name>
  <files>app/src/locales/en.json</files>
  <read_first>
    - app/src/locales/en.json (read entire `home` namespace to confirm current structure; verify `home.toast` ONLY contains `noMorePosts` so the parent object can be safely removed)
    - .planning/phases/42-masonry-feed-layout/42-UI-SPEC.md (§ i18n Bundle Updates lines 426-451 — verbatim 12 keys + 1 deletion + EN canonical values)
    - CLAUDE.md (i18n Workflow section — bundle parity gate)
    - app/scripts/translate-locales.md (Sonnet subagent prompt template, used in Task 3)
  </read_first>
  <action>
    Edit `app/src/locales/en.json` to:

    **(A) DELETE the `home.toast` parent object** (since its only child `noMorePosts` is being removed and no other key lives under it). Confirm via read first; if `home.toast` has other keys, only delete the `noMorePosts` key.

    Before:
    ```json
    "home": {
      ...
      "toast": {
        "noMorePosts": "No more posts to generate right now"
      },
      ...
    }
    ```

    After:
    ```json
    "home": {
      ...
      // toast object removed entirely (no other keys)
      ...
    }
    ```

    **(B) ADD a new `home.celebration` object** with all 12 keys (verbatim from UI-SPEC § i18n Bundle Updates):

    ```json
    "celebration": {
      "vineBloomTitle": "Vine in bloom",
      "suggestionsHeader": "Tomorrow's vine tending",
      "healAction": "Heal '{{anchor}}'",
      "replantAction": "Re-plant '{{anchor}}'",
      "healBadge": "dying",
      "replantBadge": "dead",
      "fallbackHealthy": "Your vine is fully healthy.",
      "fallbackReviewCount": "{{count}} anchor will be due for review tomorrow.",
      "fallbackReviewCount_other": "{{count}} anchors will be due for review tomorrow.",
      "fallbackReviewCountZero": "Check back tomorrow for fresh concepts.",
      "openPlanner": "Open Planner",
      "actionRowAria": "{{action}} {{anchor}} — opens action"
    }
    ```

    Place the new `celebration` object alphabetically inside `home` (between existing keys — read en.json first to determine exact placement; consistency with the file's existing key ordering is preferred).

    **DO NOT TOUCH:** Any other key in en.json. Specifically preserve all existing namespaces (common, planner, ask, review, graph, podcast, posts, settings, onboarding, questionDetail).

    Atomic commit message: `feat(42): add home.celebration.* (12 keys) + remove home.toast in en.json`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; node -e "const d=require('./src/locales/en.json'); if(d.home.toast)throw new Error('home.toast still present'); if(!d.home.celebration)throw new Error('home.celebration missing'); const expected=['vineBloomTitle','suggestionsHeader','healAction','replantAction','healBadge','replantBadge','fallbackHealthy','fallbackReviewCount','fallbackReviewCount_other','fallbackReviewCountZero','openPlanner','actionRowAria']; for(const k of expected){if(!(k in d.home.celebration))throw new Error('missing key: home.celebration.'+k);} console.log('en.json OK: 12 celebration keys present, home.toast removed');"</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && node -e "console.log(Object.keys(require('./src/locales/en.json').home.celebration).length)"` outputs `12`
    - `cd app && node -e "console.log('toast' in require('./src/locales/en.json').home)"` outputs `false`
    - en.json is valid JSON (`node -e "require('./src/locales/en.json')"` exits 0)
    - All 12 EN canonical values match UI-SPEC § i18n Bundle Updates verbatim (no typos in interpolation tokens like `{{anchor}}`, `{{count}}`)
    - The Markdown apostrophe in `Tomorrow's` and the em-dash in `{{action}} {{anchor}} — opens action` are present byte-for-byte (UTF-8 right-single-quote U+2019 and em-dash U+2014; copy from UI-SPEC verbatim)
  </acceptance_criteria>
  <done>en.json canonical complete; ready for Sonnet subagent translation pass in Task 3.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Translate the 12 home.celebration.* keys to zh/es/ja AND delete home.toast in all 3 bundles (Sonnet subagent per app/scripts/translate-locales.md)</name>
  <files>app/src/locales/zh.json, app/src/locales/es.json, app/src/locales/ja.json</files>
  <read_first>
    - app/scripts/translate-locales.md (Sonnet subagent prompt — load it and run 3 times, once per non-EN locale)
    - app/src/locales/en.json (the canonical source after Task 2 completes)
    - app/src/locales/zh.json (current state; confirm home.toast ONLY contains noMorePosts before deleting parent)
    - app/src/locales/es.json (same)
    - app/src/locales/ja.json (same)
    - .planning/phases/42-masonry-feed-layout/42-UI-SPEC.md (§ i18n Bundle Updates "Translation guardrails" lines 453-459 — proper noun + botanical voice rules)
    - CLAUDE.md ("What NOT to translate" subsection — Trellis/OpenAI/anchor names stay English; "vine"/"bloom"/"tending"/"heal"/"re-plant" preserve botanical voice)
  </read_first>
  <action>
    For each non-EN locale (zh, es, ja), run the Sonnet subagent translation script per `app/scripts/translate-locales.md`. The script accepts the canonical EN bundle + target locale and produces the translated bundle.

    For each of the 3 bundles:

    1. **DELETE the `home.toast` parent object** (or just the `noMorePosts` key if the bundle has other keys under `home.toast` — verify by reading first). Symmetric with en.json's deletion.

    2. **ADD a new `home.celebration` object** with all 12 keys translated to the target locale, following these guardrails:

    **Translation guardrails (verbatim from UI-SPEC § i18n Bundle Updates):**
    - **Proper nouns (NEVER translated):** `Trellis`, `Spaced Repetition`, `Transformer Attention`, anchor names (interpolated via `{{anchor}}`)
    - **Brand-token preservation:** `Open Planner` — translate "Open" verb; preserve brand-token "Planner" capitalized in EN where locale conventions allow (e.g., zh: 「打开计划页」 or 「打开 Planner」 per Sonnet judgement; es: "Abrir Planner"; ja: 「プランナーを開く」)
    - **Botanical voice:** "vine", "bloom", "tending", "heal", "re-plant", "anchor" — preserve botanical metaphor in each locale; do NOT flatten to generic "review" or "task" verbs
    - **Interpolation placeholders:** `{{anchor}}`, `{{count}}`, `{{action}}` MUST appear verbatim (UTF-8 double-curly braces)
    - **Plural form:** `fallbackReviewCount_other` is i18next's built-in `_other` suffix for `count !== 1`. Some locales (zh, ja) don't pluralize nouns — Sonnet may produce identical strings for both forms, which is correct per i18next conventions
    - **Calm tone:** No exclamation marks anywhere in celebration copy (matches en's quieter "in bloom" tone)

    Expected outputs per bundle (Sonnet's translations are guidance; human-review is part of CLAUDE.md i18n Workflow):

    **zh.json:**
    ```json
    "celebration": {
      "vineBloomTitle": "藤蔓盛开",
      "suggestionsHeader": "明日的藤蔓养护",
      "healAction": "治愈「{{anchor}}」",
      "replantAction": "重植「{{anchor}}」",
      "healBadge": "枯萎中",
      "replantBadge": "已枯",
      "fallbackHealthy": "你的藤蔓十分健康。",
      "fallbackReviewCount": "明天将有 {{count}} 个锚点到期复习。",
      "fallbackReviewCount_other": "明天将有 {{count}} 个锚点到期复习。",
      "fallbackReviewCountZero": "明天再回来探索新概念。",
      "openPlanner": "打开 Planner",
      "actionRowAria": "{{action}} {{anchor}} — 打开操作"
    }
    ```

    **es.json:**
    ```json
    "celebration": {
      "vineBloomTitle": "Vid en flor",
      "suggestionsHeader": "Cuidado de la vid de mañana",
      "healAction": "Sanar '{{anchor}}'",
      "replantAction": "Replantar '{{anchor}}'",
      "healBadge": "marchitándose",
      "replantBadge": "muerto",
      "fallbackHealthy": "Tu vid está totalmente sana.",
      "fallbackReviewCount": "{{count}} ancla estará lista para revisar mañana.",
      "fallbackReviewCount_other": "{{count}} anclas estarán listas para revisar mañana.",
      "fallbackReviewCountZero": "Vuelve mañana a por nuevos conceptos.",
      "openPlanner": "Abrir Planner",
      "actionRowAria": "{{action}} {{anchor}} — abre acción"
    }
    ```

    **ja.json:**
    ```json
    "celebration": {
      "vineBloomTitle": "つるが満開",
      "suggestionsHeader": "明日のつる手入れ",
      "healAction": "「{{anchor}}」を癒す",
      "replantAction": "「{{anchor}}」を植え直す",
      "healBadge": "枯れかけ",
      "replantBadge": "枯死",
      "fallbackHealthy": "あなたのつるは健やかです。",
      "fallbackReviewCount": "明日、{{count}} 個のアンカーが復習期限を迎えます。",
      "fallbackReviewCount_other": "明日、{{count}} 個のアンカーが復習期限を迎えます。",
      "fallbackReviewCountZero": "明日また新しい概念をチェックしてください。",
      "openPlanner": "プランナーを開く",
      "actionRowAria": "{{action}} {{anchor}} — 操作を開く"
    }
    ```

    These translations are provided as the planner's best-effort baseline. The actual Sonnet subagent invocation per `app/scripts/translate-locales.md` may produce minor variants — accept those if they preserve the guardrails (proper nouns, brand tokens, botanical voice, interpolation placeholders, calm tone, no exclamation marks).

    **DO NOT TOUCH:** Any other key in zh/es/ja. Specifically preserve all existing namespaces (common, planner, ask, review, graph, podcast, posts, settings, onboarding, questionDetail).

    **POST-EDIT CHECK — bundle parity:**
    Run `cd app && node --test tests/locales/bundle-parity.test.mjs` — must pass (all 4 bundles have identical key sets).

    Atomic commit message: `feat(42): translate home.celebration.* to zh/es/ja + remove home.toast (bundle parity)`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; node -e "for(const loc of ['zh','es','ja']){const d=require('./src/locales/'+loc+'.json'); if(d.home.toast)throw new Error(loc+'.json: home.toast still present'); if(!d.home.celebration)throw new Error(loc+'.json: home.celebration missing'); const expected=['vineBloomTitle','suggestionsHeader','healAction','replantAction','healBadge','replantBadge','fallbackHealthy','fallbackReviewCount','fallbackReviewCount_other','fallbackReviewCountZero','openPlanner','actionRowAria']; for(const k of expected){if(!(k in d.home.celebration))throw new Error(loc+'.json missing: home.celebration.'+k);} console.log(loc+'.json OK');}" &amp;&amp; node --test tests/locales/bundle-parity.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - All 3 of `zh.json`, `es.json`, `ja.json` contain a `home.celebration` object with all 12 keys
    - All 3 bundles do NOT contain `home.toast` (or `home.toast.noMorePosts`)
    - All 4 bundles parse as valid JSON
    - `cd app && node --test tests/locales/bundle-parity.test.mjs` exits 0 (key sets identical across all 4 bundles)
    - All translated values contain the same interpolation placeholders as EN canonical (`{{anchor}}`, `{{count}}`, `{{action}}` verbatim)
    - Brand tokens preserved: `Trellis` not translated; `Planner` capitalized in es/ja; `Planner` either kept or rendered as 「Planner」 in zh
    - No exclamation marks in any celebration string in any locale
  </acceptance_criteria>
  <done>All 4 locale bundles have parity-clean home.celebration namespace with 12 keys; home.toast removed from all 4; bundle-parity.test.mjs green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Update i18n.d.ts module augmentation to reflect added/removed keys</name>
  <files>app/src/locales/i18n.d.ts</files>
  <read_first>
    - app/src/locales/i18n.d.ts (read entire file to understand current shape — does it use `typeof en` to derive types, or hand-author the union? approach informs the edit)
    - app/src/locales/en.json (the canonical key set, post-Task-2)
  </read_first>
  <action>
    Update `app/src/locales/i18n.d.ts` so that:

    1. The 12 new `home.celebration.*` keys are type-known (so `t('home.celebration.vineBloomTitle')` etc. type-check as valid in MasonryFeed.tsx).
    2. `home.toast.noMorePosts` (and the parent `home.toast` if removed) are no longer type-recognized.

    **Implementation approach depends on how i18n.d.ts is structured today:**

    - **If i18n.d.ts uses `typeof import('./en.json')` to derive the type tree** — no manual edit needed; the type set will auto-update from en.json's structure. Verify by running `tsc -b --noEmit` after Task 2 lands and confirming MasonryFeed.tsx's `t('home.celebration.vineBloomTitle')` calls compile without error.

    - **If i18n.d.ts has hand-authored `interface CustomTypeOptions { resources: { home: { ... } } }`** — manually add the `celebration` sub-object with its 12 keys to the `home` interface, and remove `toast` (or its `noMorePosts` member).

    Read the file first to determine which approach applies, then make the minimal edit that makes `cd app && npx tsc -b --noEmit` exit 0 with the MasonryFeed.tsx t() calls in place.

    **DO NOT TOUCH:** Any other type declaration in i18n.d.ts that's unrelated to the home namespace.

    Atomic commit message: `chore(42): update i18n.d.ts module augmentation for home.celebration.* keys (and removed home.toast)`
  </action>
  <verify>
    <automated>cd /Users/Code/EchoLearn/app &amp;&amp; npx tsc -b --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `cd app && npx tsc -b --noEmit` exits 0 with MasonryFeed.tsx's t() calls in place
    - If i18n.d.ts is hand-authored: contains the string `celebration` referencing the new 12-key object; does NOT contain `noMorePosts` references
    - If i18n.d.ts uses `typeof import('./en.json')`: file is unchanged (auto-derived from en.json)
  </acceptance_criteria>
  <done>i18n.d.ts in sync with the bundle changes; tsc clean.</done>
</task>

</tasks>

<verification>
- `cd app && npx tsc -b --noEmit` exits 0
- `cd app && node --test tests/locales/bundle-parity.test.mjs` exits 0
- `cd app && node --test tests/locales/missing-key.test.mjs` exits 0 (fallback to EN works for any unmatched lookups during Sonnet review)
- VineBloomCard renders without runtime error when allExplored is true (manual UAT — phase close)
- `git diff app/src/services/trellis-actions.service.ts` shows ZERO changes (no new method added; RESEARCH.md § 1 path b)
</verification>

<success_criteria>
- VineBloomCard fully implemented and replaces the placeholder from plan 42-01
- 12 home.celebration.* keys present in all 4 locale bundles with parity
- home.toast.noMorePosts removed from all 4 locale bundles
- Zero new methods on trellisActionsService
- tsc + bundle-parity tests green
</success_criteria>

<output>
After completion, create `.planning/phases/42-masonry-feed-layout/42-04-SUMMARY.md` documenting:
- VineBloomCard final LOC count
- All 4 bundles' final key count delta (+11 net per bundle: +12 added − 1 deleted)
- Atomic commit hashes for the 4 tasks
- Confirmation that trellisActionsService surface is unchanged (RESEARCH.md § 1 path b honored)
- Bundle-parity test result snapshot
</output>
