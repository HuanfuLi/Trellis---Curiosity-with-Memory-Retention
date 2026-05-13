---
phase: 46-news-prefetch-multi-source-gap-closure
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/services/concept-feed.service.ts
  - app/tests/services/concept-feed-source-diversity-wiring.test.mjs
  - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VERIFY.md
  - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md
  - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-PHASE-SUMMARY.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
autonomous: true
requirements: [CONTENT-03]
gap_closure: true
must_haves:
  truths:
    - "Queued news posts generated from refillQueue prefetch can carry 2-3 Tavily sources into newsMeta.sources."
    - "Direct no-prefetch news generation still uses filtered.slice(0, 3)."
    - "generateNewsEssay continues to consume sources.slice(0, 3), with no prompt rewrite."
    - "CONTENT-03 can be marked complete after targeted regression, build, lint, and test evidence is recorded."
  artifacts:
    - path: "app/src/services/concept-feed.service.ts"
      provides: "PreFetchCache.news array cache and cached-news topSources wiring"
      contains: "news: Map<string, WebSearchResult[]>"
    - path: "app/tests/services/concept-feed-source-diversity-wiring.test.mjs"
      provides: "Regression proving queued-news prefetch stores topSources and cached generation maps them into newsMeta.sources"
      contains: "queued-news prefetch preserves multiple sources"
    - path: ".planning/phases/46-news-prefetch-multi-source-gap-closure/46-VERIFY.md"
      provides: "Final command evidence for Phase 46"
    - path: ".planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md"
      provides: "Nyquist sign-off flipped to validated/compliant"
  key_links:
    - from: "app/src/services/concept-feed.service.ts refillQueue prefetch loop"
      to: "PreFetchCache.news"
      via: "preFetched.news.set(a.conceptId, topSources)"
      pattern: "preFetched\\.news\\.set\\(a\\.conceptId, topSources\\)"
    - from: "app/src/services/concept-feed.service.ts generatePostBatch cached news branch"
      to: "newsMeta.sources"
      via: "topSources = cached.slice(0, 3) then topSources.map((r, i) => ({ index: i + 1, ... }))"
      pattern: "topSources = cached\\.slice\\(0, 3\\)[\\s\\S]*sources: topSources\\.map\\(\\(r, i\\)"
    - from: "app/src/services/post-essay.service.ts generateNewsEssay"
      to: "DailyPost.newsMeta.sources"
      via: "sources.slice(0, 3)"
      pattern: "sources\\s*\\.slice\\(0, 3\\)"
---

<objective>
Close the Phase 46 CONTENT-03 milestone-audit gap by carrying the filtered top 2-3 Tavily results through queued-news prefetch into `newsMeta.sources`.

Purpose: Normal queued news posts must receive the same multi-snippet grounding as the direct no-prefetch news generation path.
Output: One scoped service fix, one targeted regression update, and final Phase 46 verification/close-out artifacts.
</objective>

<execution_context>
@/Users/Code/EchoLearn/.codex/get-shit-done/workflows/execute-plan.md
@/Users/Code/EchoLearn/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/v1.5-MILESTONE-AUDIT.md
@.planning/phases/46-news-prefetch-multi-source-gap-closure/46-CONTEXT.md
@.planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md
@CLAUDE.md
@AGENTS.md
@app/src/services/concept-feed.service.ts
@app/src/services/post-essay.service.ts
@app/tests/services/concept-feed-source-diversity-wiring.test.mjs
@app/package.json

<interfaces>
Current implementation seams extracted before planning:

From `app/src/services/concept-feed.service.ts`:
```typescript
interface PreFetchCache {
  youtube: Map<string, YouTubeSearchResult[]>;
  news: Map<string, WebSearchResult>;
}

const cached = preFetched?.news.get(a.conceptId);
let result: WebSearchResult | undefined;
let topSources: WebSearchResult[] = [];
if (cached) {
  result = cached;
  topSources = [cached];
} else {
  const usedDomains = sourceDiversityService.getUsedDomains(a.conceptId);
  const searchResult = await webSearch(
    conceptName + ' latest research findings',
    { maxResults: 3, excludeDomains: [...usedDomains] },
  );
  if (searchResult.success && searchResult.data?.results.length) {
    const filtered = sourceDiversityService.filterForDiversity(searchResult.data.results, usedDomains);
    result = filtered[0];
    topSources = filtered.slice(0, 3);
  }
}

newsMeta: {
  sources: topSources.map((r, i) => ({ index: i + 1, title: r.title, url: r.url, snippet: r.content })),
  fetchedAt: Date.now(),
}

const filtered = sourceDiversityService.filterForDiversity(results.data.results, usedDomains);
const chosen = filtered[0];
preFetched.news.set(a.conceptId, chosen);
```

From `app/src/services/post-essay.service.ts`:
```typescript
const sources = post.newsMeta?.sources ?? [];
const sourceText = sources
  .slice(0, 3)
  .map(s => {
    const head = `[${s.index}] ${s.title} - ${s.url}`;
    return s.snippet ? `${head}\n${s.snippet}` : head;
  })
  .join('\n\n');
```
</interfaces>

Do not broaden scope into Tavily ranking/domain scoring, prompt wording, domain-tier changes, queue refactors, or a new news service. Preserve the `bodyMarkdown: ''` news creation invariant from `CLAUDE.md`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add RED regression for queued-news prefetch multi-source cache</name>
  <files>app/tests/services/concept-feed-source-diversity-wiring.test.mjs</files>
  <read_first>
    - app/tests/services/concept-feed-source-diversity-wiring.test.mjs
    - app/src/services/concept-feed.service.ts
    - app/src/services/post-essay.service.ts
    - .planning/v1.5-MILESTONE-AUDIT.md
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-CONTEXT.md
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md
    - CLAUDE.md
  </read_first>
  <behavior>
    - Test 1: `PreFetchCache.news` must be `Map<string, WebSearchResult[]>`, not `Map<string, WebSearchResult>`.
    - Test 2: The cached news branch must assign `result = cached[0]` and `topSources = cached.slice(0, 3)`; it must not contain `topSources = [cached]`.
    - Test 3: The refillQueue prefetch loop must store `topSources` with `preFetched.news.set(a.conceptId, topSources)` after `const topSources = filtered.slice(0, 3)`.
    - Test 4: The direct no-prefetch branch must still contain `topSources = filtered.slice(0, 3)`.
    - Test 5: `newsMeta.sources` must still map `topSources` with `index: i + 1`, and `generateNewsEssay` must still consume `sources.slice(0, 3)`.
  </behavior>
  <action>
    Update the existing source-reading test file, not a new test file. Add a new `describe('CONTENT-03: queued-news prefetch preserves multiple sources', ...)` block using `readFileSync` on both `concept-feed.service.ts` and `post-essay.service.ts`.

    Replace the old prefetch counterweight that searches for `preFetched.news.set(a.conceptId, chosen)` with the new required cache contract:
    - `preFetched.news.set(a.conceptId, topSources)`
    - `const topSources = filtered.slice(0, 3)`
    - `const chosen = topSources[0]` is allowed only for title/domain selection; `const chosen = filtered[0]` must be absent.

    Keep the existing Phase 39 walker and Phase 41 source-diversity assertions intact. This task intentionally creates a RED regression before Task 2 changes production code.
  </action>
  <verify>
    <automated>cd app && (node --test tests/services/concept-feed-source-diversity-wiring.test.mjs; test "$?" -ne 0)</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "queued-news prefetch preserves multiple sources" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 1 match.
    - `rg -n "Map<string, WebSearchResult\\[\\]>" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 1 match.
    - `rg -n "topSources = cached\\.slice\\(0, 3\\)" app/tests/services/concept-feed-source-diversity-wiring.test.mjs` returns at least 1 match.
    - The RED command exits 0 because the updated test suite currently fails against the old one-source prefetch cache.
  </acceptance_criteria>
  <done>The regression describes the exact CONTENT-03 gap and fails before the production fix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Carry top 2-3 Tavily results through PreFetchCache.news</name>
  <files>app/src/services/concept-feed.service.ts, app/tests/services/concept-feed-source-diversity-wiring.test.mjs</files>
  <read_first>
    - app/src/services/concept-feed.service.ts
    - app/tests/services/concept-feed-source-diversity-wiring.test.mjs
    - app/src/services/post-essay.service.ts
    - .planning/v1.5-MILESTONE-AUDIT.md
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-CONTEXT.md
    - CLAUDE.md
  </read_first>
  <behavior>
    - Cached queued-news generation preserves every prefetched Tavily result up to three sources.
    - The first cached source still drives the news title, teaser, and source-diversity domain record.
    - Direct no-prefetch behavior remains `topSources = filtered.slice(0, 3)`.
    - `bodyMarkdown: ''` remains unchanged so PostDetail continues streaming news bodies on open.
  </behavior>
  <action>
    In `app/src/services/concept-feed.service.ts`, make only these scoped edits:

    1. Change `PreFetchCache.news` from `Map<string, WebSearchResult>` to `Map<string, WebSearchResult[]>`.
    2. In `generatePostBatch` news loop, treat `const cached = preFetched?.news.get(a.conceptId)` as an array. Use:
       - `if (cached?.length) {`
       - `result = cached[0];`
       - `topSources = cached.slice(0, 3);`
       - `} else { ...existing direct webSearch path... }`
       Keep the direct branch's existing `topSources = filtered.slice(0, 3)` line unchanged.
    3. In the `refillQueue` news prefetch loop, replace `const chosen = filtered[0]; preFetched.news.set(a.conceptId, chosen);` with:
       - `const topSources = filtered.slice(0, 3);`
       - `const chosen = topSources[0];`
       - `if (!chosen) { failedIds.add(a.conceptId); return; }`
       - `preFetched.news.set(a.conceptId, topSources);`
       Keep `const domain = extractDomain(chosen.url); if (domain) sourceDiversityService.recordServedDomain(a.conceptId, domain);` after the cache set.
    4. Update only adjacent comments that now lie about Tavily `maxResults:1`, single chosen result storage, or one-element cached `topSources`. The new comments must say the prefetch loop stores the filtered top 2-3 results and the cached branch maps up to three entries into `newsMeta.sources`.

    Do not edit `post-essay.service.ts`, Tavily ranking/domain scoring, prompt wording, style assignment, queue sizing, or `bodyMarkdown: ''`.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "news: Map<string, WebSearchResult\\[\\]>" app/src/services/concept-feed.service.ts` returns exactly 1 match.
    - `rg -n "topSources = cached\\.slice\\(0, 3\\)" app/src/services/concept-feed.service.ts` returns exactly 1 match.
    - `rg -n "topSources = \\[cached\\]" app/src/services/concept-feed.service.ts` returns no matches.
    - `rg -n "const topSources = filtered\\.slice\\(0, 3\\)" app/src/services/concept-feed.service.ts` returns exactly 1 match in the prefetch loop.
    - `rg -n "preFetched\\.news\\.set\\(a\\.conceptId, topSources\\)" app/src/services/concept-feed.service.ts` returns exactly 1 match.
    - `rg -n "const chosen = filtered\\[0\\]" app/src/services/concept-feed.service.ts` returns no matches.
    - `rg -n "topSources = filtered\\.slice\\(0, 3\\)" app/src/services/concept-feed.service.ts` still returns at least 1 match for the direct no-prefetch branch.
    - `rg -n "sources\\.slice\\(0, 3\\)" app/src/services/post-essay.service.ts` still returns at least 1 match.
    - The targeted test command exits 0.
  </acceptance_criteria>
  <done>Queued-news prefetch stores top source arrays, cached generation writes those arrays into `newsMeta.sources`, and the direct path is unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Record final verification and mark CONTENT-03 ready for milestone re-audit</name>
  <files>.planning/phases/46-news-prefetch-multi-source-gap-closure/46-VERIFY.md, .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md, .planning/phases/46-news-prefetch-multi-source-gap-closure/46-PHASE-SUMMARY.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/STATE.md</files>
  <read_first>
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-CONTEXT.md
    - .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md
    - .planning/v1.5-MILESTONE-AUDIT.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - app/package.json
  </read_first>
  <action>
    Run and record these commands in a new `46-VERIFY.md` with command, exit code, and short result:
    - `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs`
    - `cd app && npm run build`
    - `cd app && npm run lint`
    - `cd app && npm test`

    If `npm test` exits 0 because `package.json` chains `test:main; test:actions`, still record any known `test:main` baseline lines. Do not fix the known deferred `app/tests/concept-feed.test.mjs` stale `buildFallbackPosts` contract in this phase.

    Update `46-VALIDATION.md` frontmatter to `status: validated`, `nyquist_compliant: true`, and `wave_0_complete: true`. In its verification map, mark `46-FIX-01` and `46-CLOSE-01` as pass. Check all validation sign-off boxes and set approval to `validated 2026-05-13`.

    Update `.planning/REQUIREMENTS.md` so `CONTENT-03` is checked `[x]` and its traceability row says Phase 41+46 / Wave 2+5 / Complete after Phase 46 queued-news prefetch closure.

    Update `.planning/ROADMAP.md` Phase 46 with `Plans: 1/1 plans complete`, mark `46-01-news-prefetch-multi-source-PLAN.md` checked, and set the Progress table row for Phase 46 to `1/1 | Complete | 2026-05-13`.

    Update `.planning/STATE.md` with a concise last-decisions block stating that Phase 46 closed CONTENT-03 by changing `PreFetchCache.news` to top-source arrays, preserving the direct no-prefetch `filtered.slice(0, 3)` path, and adding the queued-prefetch regression. Keep the next action as rerun `$gsd-audit-milestone 1.5`, then `$gsd-complete-milestone 1.5`.

    Create `46-PHASE-SUMMARY.md` with the changed files, test evidence, and explicit note that Tavily ranking/domain scoring, prompt wording, and broad concept-feed refactors stayed out of scope.
  </action>
  <verify>
    <automated>cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs && npm run build && npm run lint && npm test</automated>
  </verify>
  <acceptance_criteria>
    - `rg -n "status: validated" .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md` returns exactly 1 match.
    - `rg -n "nyquist_compliant: true" .planning/phases/46-news-prefetch-multi-source-gap-closure/46-VALIDATION.md` returns exactly 1 match.
    - `rg -n "\\[x\\] \\*\\*CONTENT-03\\*\\*" .planning/REQUIREMENTS.md` returns exactly 1 match.
    - `rg -n "46-01-news-prefetch-multi-source-PLAN.md" .planning/ROADMAP.md` returns at least 1 match and the Phase 46 plan list row is checked.
    - `rg -n "PreFetchCache.news.*top-source arrays|top-source arrays.*PreFetchCache.news" .planning/STATE.md .planning/phases/46-news-prefetch-multi-source-gap-closure/46-PHASE-SUMMARY.md` returns at least 1 match.
    - `rg -n "Tavily ranking|prompt wording|concept-feed refactors" .planning/phases/46-news-prefetch-multi-source-gap-closure/46-PHASE-SUMMARY.md` returns at least 1 match.
  </acceptance_criteria>
  <done>Phase 46 verification evidence is durable, CONTENT-03 is ready for milestone re-audit, and the phase close-out docs reflect the narrow scope.</done>
</task>

</tasks>

<verification>
Required automated checks:
- `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs`
- `cd app && npm run build`
- `cd app && npm run lint`
- `cd app && npm test`

Required source checks:
- `PreFetchCache.news` is an array cache.
- The refillQueue prefetch loop stores `topSources`.
- The generatePostBatch cached branch slices cached top sources.
- The direct no-prefetch branch still uses `filtered.slice(0, 3)`.
- `generateNewsEssay` still uses `sources.slice(0, 3)`.
</verification>

<success_criteria>
CONTENT-03 is closed when queued-news prefetch preserves the filtered top 2-3 Tavily results into `newsMeta.sources`, the targeted regression passes, full build/lint/test evidence is recorded, and the milestone audit can be rerun without the prior prefetch cache-shape gap.
</success_criteria>

<output>
After completion, create `.planning/phases/46-news-prefetch-multi-source-gap-closure/46-01-news-prefetch-multi-source-SUMMARY.md`.
</output>
