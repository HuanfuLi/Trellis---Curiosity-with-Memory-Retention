---
phase: 46
slug: news-prefetch-multi-source-gap-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for closing the v1.5 CONTENT-03 milestone-audit gap.
> Source: `.planning/v1.5-MILESTONE-AUDIT.md` and `46-CONTEXT.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` with a behavioral helper regression plus supplemental service source-reading checks |
| **Config file** | `app/package.json` test scripts |
| **Quick run command** | `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs` |
| **Full suite command** | `cd app && npm run build && npm run lint && npm test` |
| **Estimated runtime** | < 5 seconds for targeted test; ~60-180 seconds for full suite |

---

## Sampling Rate

- **After implementation task:** Run `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs`.
- **Before phase close-out:** Run `cd app && npm run build && npm run lint && npm test`.
- **Max feedback latency:** 5 seconds for targeted regression, 180 seconds for full automated verification.

---

## Per-Task Verification Map

| Task ID | Behavior | Requirement | Test Type | Automated Command | Status |
|---------|----------|-------------|-----------|-------------------|--------|
| 46-FIX-01 | `PreFetchCache.news` carries top 2-3 filtered Tavily results through queued-news prefetch into `newsMeta.sources` with stable source indexes | CONTENT-03 | behavioral helper regression + source-reading | `cd app && node --test tests/services/concept-feed-source-diversity-wiring.test.mjs` | pending |
| 46-CLOSE-01 | Direct no-prefetch and queued-prefetch paths both use the tested top-source selection helper; final docs mark CONTENT-03 ready for re-audit | CONTENT-03 | source-reading + full suite | `cd app && npm run build && npm run lint && npm test` | pending |

---

## Manual-Only Verifications

None required. The gap is a static queued-prefetch wiring issue and must be closed by automated regression evidence.

---

## Validation Sign-Off

- [ ] Targeted queued-news prefetch regression uses mocked Tavily results and proves at least two cached sources become `newsMeta.sources`.
- [ ] The regression asserts stable source indexes `1, 2, ...` and preserves title/url/snippet fields.
- [ ] Direct no-prefetch news path uses the same top-source helper as queued prefetch.
- [ ] Full build, lint, and test commands are recorded in Phase 46 verification evidence.
- [ ] `CONTENT-03` is marked complete only after the regression and final verification pass.
- [ ] `nyquist_compliant: true` set in frontmatter during phase close-out.

**Approval:** pending
