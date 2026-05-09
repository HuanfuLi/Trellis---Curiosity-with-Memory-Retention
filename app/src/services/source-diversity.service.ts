// Source-diversity service — Phase 40 (D-01 through D-15).
//
// Pure-logic leaf module that owns per-anchor web-domain rotation state
// (session-scoped Map), the bundled ~180-entry domain quality table, URL
// normalization (PSL slice for multi-segment TLDs), and the two-pass
// re-ranking algorithm with a best-of-the-bad fallback.
//
// Phase 40 ships THIS LEAF + its tests. Phase 41 wires the leaf into
// concept-feed.service.ts's news branch (NOT this phase's job). Phase 41
// will:
//   1. Pass `[...sourceDiversityService.getUsedDomains(anchorId)]` into
//      Tavily's `exclude_domains` field.
//   2. Widen `maxResults` from 1 to ~5 in the two news call sites.
//   3. Call `sourceDiversityService.filterForDiversity(results, used)` on
//      the returned array, then take `filtered[0]`.
//   4. Call `sourceDiversityService.recordServedDomain(anchorId, domain)`
//      after committing a result to a post.
//   5. Call `sourceDiversityService.reset()` from `loadCache()`'s
//      date-mismatch branch on day boundary.
//
// Leaf-module discipline (Phase 37 D-01 / D-08):
//   - No JSON imports (would require `with { type: 'json' }` and break
//     Node `--test` loadability).
//   - No `react-i18next` import.
//   - No `lib/date.ts` import (would re-introduce the i18next dependency
//     chain).
//   - No module-init cross-service imports.
//   - `.ts` extension on all relative imports (Plan 37-02 close decision —
//     Node ESM requires it for the esbuild tsx loader).
//
// Sync-only invariant (Phase 40 SC-4 — locked by the source-reading
// anti-wire test in tests/services/source-diversity-anti-wire.test.mjs):
//   - No I/O: no network round-trip, no Promise-based delay, no LLM call,
//     no browser-storage read or write.
//   - No deferred-execution function declarations anywhere (proves no
//     suspending expression can exist — every suspending expression
//     requires a deferred-execution function wrapper).
//
// Naming convention (CONTEXT.md "Specific Ideas"):
//   - Every variable named `domain` in this file means web hostname (e.g.,
//     'nature.com'), NEVER concept/cluster/mindmap domain.
//
// State scope (D-13/D-14):
//   - Session-only, in-memory `Map<anchorId, Set<registrable-root-domain>>`.
//   - Lost on cold-boot — by design (acts like an "in this session, don't
//     repeat" hint, not a multi-day commitment).
//   - No browser-storage persistence. No event emission. `reset()` is
//     wholesale-wipe and emits NOTHING per CLAUDE.md "one signal per
//     semantic event" (Phase 32.1 best practice rule 6).

import type { WebSearchResult } from '../types/index.ts';

// MULTI_SEGMENT_TLDS — covers ~99% of real Tavily URLs. Add more as data shows.
// RESEARCH § 2: gob.mx + ac.nz added beyond CONTEXT's initial 10
// (covers MX gov + NZ academic).
export const MULTI_SEGMENT_TLDS: ReadonlySet<string> = new Set([
  'co.uk', 'co.jp', 'com.au', 'co.nz', 'org.uk',
  'ac.uk', 'edu.au', 'gov.uk', 'co.kr', 'com.br',
  'gob.mx', 'ac.nz',
]);

// UNKNOWN_DOMAIN_SCORE — neutral mid-score for domains not in DOMAIN_TIERS.
// 0.5 places unknown domains below established journalism (0.85+) and above
// known-low sites (0.15-0.38). NOT 0.0 — that's reserved for known-bad.
// Future tuning is a one-line change.
export const UNKNOWN_DOMAIN_SCORE = 0.5;

/**
 * Collapse a hostname to its registrable-root domain (D-09 + D-11).
 *
 * If the last two segments form a known multi-segment TLD (e.g. `co.uk`),
 * the registrable root is the last 3 segments. Otherwise it is the last 2.
 *
 * Examples:
 *   'science.nature.com'   -> 'nature.com'
 *   'www.bbc.co.uk'        -> 'bbc.co.uk'
 *   'm.wikipedia.org'      -> 'wikipedia.org'
 *   'gobierno.gob.mx'      -> 'gobierno.gob.mx'
 */
export function normalizeHost(hostname: string): string {
  const parts = hostname.split('.');
  const twoSuffix = parts.slice(-2).join('.');
  if (MULTI_SEGMENT_TLDS.has(twoSuffix)) {
    return parts.slice(-3).join('.');
  }
  return twoSuffix;
}

/**
 * Collapse a URL to its registrable-root domain. Returns undefined if the
 * URL is malformed (D-10) — caller filters these out of the re-ranked array.
 *
 * Defensive try/catch around `new URL(...)` — one bad URL must never crash
 * a refill cycle.
 */
export function extractDomain(url: string): string | undefined {
  try {
    const { hostname } = new URL(url);
    return normalizeHost(hostname);
  } catch {
    return undefined;
  }
}

// Session-scoped per-anchor served-domain bookkeeping.
// Map<anchorId, Set<registrable-root-domain>>. Lost on cold-boot — by design.
const usedByAnchor = new Map<string, Set<string>>();

/**
 * Re-rank Tavily results to prefer unseen domains (Pass A) over seen domains
 * (Pass B). Within each pass, sort by `scoreSource(domain)` descending. Stable
 * sort (V8 since 2018) preserves Tavily's original ordering for ties (D-07).
 *
 * Phase 40 D-06 best-of-the-bad fallback: if BOTH passes are empty (every
 * input had a malformed URL — `extractDomain` returned undefined for all),
 * return the single highest-scoring raw result. Prevents the silent
 * zero-posts-for-concept failure that ROADMAP success criterion #1 forbids.
 *
 * IMPORTANT: Valid-but-seen results still surface via Pass B. The fallback
 * is NOT triggered when Pass A is empty but Pass B has entries.
 *
 * @param results - Tavily WebSearchResult array (un-modified)
 * @param usedDomains - registrable-root domains already served for this anchor
 * @returns re-ranked WebSearchResult array (may be shorter than input if
 *          malformed URLs were dropped per D-10)
 */
export function filterForDiversity(
  results: WebSearchResult[],
  usedDomains: Set<string>,
): WebSearchResult[] {
  // Annotate each result with its registrable-root domain; drop malformed URLs (D-10).
  const scored = results
    .map(r => ({ r, domain: extractDomain(r.url) }))
    .filter((entry): entry is { r: WebSearchResult; domain: string } =>
      entry.domain !== undefined,
    );

  // Pass A: unseen domains, sorted by score desc.
  const unseen = scored
    .filter(({ domain }) => !usedDomains.has(domain))
    .sort((a, b) => scoreSource(b.domain) - scoreSource(a.domain));

  // Pass B: seen domains, sorted by score desc.
  const seen = scored
    .filter(({ domain }) => usedDomains.has(domain))
    .sort((a, b) => scoreSource(b.domain) - scoreSource(a.domain));

  const ranked = [...unseen, ...seen].map(({ r }) => r);

  // Phase 40 D-06: best-of-the-bad fallback — load-bearing per ROADMAP
  // success criterion #1 ("no silent zero-posts-for-concept failure").
  // Fires only when ALL inputs had malformed URLs (extractDomain returned
  // undefined for every entry). Valid-but-seen results surface via Pass B
  // and do NOT trigger this branch.
  if (ranked.length === 0 && results.length > 0) {
    const fallback = [...results].sort(
      (a, b) =>
        scoreSource(extractDomain(b.url) ?? '') -
        scoreSource(extractDomain(a.url) ?? ''),
    );
    return [fallback[0]];
  }

  return ranked;
}

/**
 * Record a domain served for an anchor. Idempotent (Set semantics).
 * Note: 'domain' here means web hostname like 'nature.com', NOT mindmap cluster.
 */
export function recordServedDomain(anchorId: string, domain: string): void {
  let set = usedByAnchor.get(anchorId);
  if (!set) {
    set = new Set<string>();
    usedByAnchor.set(anchorId, set);
  }
  set.add(domain);
}

/**
 * Get the set of registrable-root domains already served for an anchor.
 * Returns a fresh empty Set for unknown anchorIds (no throw).
 * Phase 41 will pass `[...result]` into Tavily's `exclude_domains` field.
 */
export function getUsedDomains(anchorId: string): Set<string> {
  return usedByAnchor.get(anchorId) ?? new Set<string>();
}

/**
 * Returns a quality score in [0, 1] for the given registrable-root domain.
 * Unknown domains return UNKNOWN_DOMAIN_SCORE (0.5) — neutral mid-score.
 * O(1) lookup via module-level Map (RESEARCH § 8 Pitfall 5 — initialized once
 * at import time, NOT lazy-init).
 */
export function scoreSource(domain: string): number {
  return _tierMap.get(domain) ?? UNKNOWN_DOMAIN_SCORE;
}

/**
 * Clear the entire session Map. Called by Phase 41's loadCache() on
 * date-mismatch detection. Emits NOTHING (D-08 — wholesale wipe is not
 * a per-id change; UI consumers re-read on day boundary).
 */
export function reset(): void {
  usedByAnchor.clear();
}

/**
 * Source diversity leaf service — Phase 40 (D-12/D-13/D-14).
 * Pure-logic singleton; no I/O; no events; session-scoped state.
 */
export const sourceDiversityService = {
  filterForDiversity,
  recordServedDomain,
  getUsedDomains,
  scoreSource,
  reset,
};

/**
 * DOMAIN_TIERS — ~180-entry hand-curated quality table (D-01 through D-04).
 *
 * Tier ranges (D-03):
 *   0.90-0.97  Top: peer-reviewed academic, .gov primary, named-author research
 *   0.80-0.88  Upper-mid: established journalism, wire services, intl news
 *   0.60-0.78  Mid: encyclopedic, trade pubs, expert blogs (Wikipedia=0.72)
 *   0.15-0.38  Low: blog platforms, UGC aggregators, niche-quality news
 *   0.0        Blocked: AI content farms, SEO mills, scraper sites
 *
 * Editorial line (D-03): mainstream outlets get the same score regardless
 * of partisan lean. Quality is judged by editorial process, fact-check
 * standards, and reputation — not viewpoint. arxiv.org is 0.88 (preprint —
 * extremely valuable but NOT peer-reviewed; sits between peer-reviewed
 * and journalism per RESEARCH § 11 Risk 3).
 *
 * Both bbc.com (0.88) and bbc.co.uk (0.88) are listed because Tavily
 * returns both depending on query (RESEARCH § 11 Risk 2).
 *
 * Operator can override any entry in PR review. Future tuning is a
 * single-file edit.
 */
export const DOMAIN_TIERS: Readonly<Record<string, number>> = {
  // ─── Top tier — peer-reviewed scientific publishers (0.95) ──────────────
  'nature.com': 0.95,
  'science.org': 0.95,
  'cell.com': 0.95,
  'nejm.org': 0.95,
  'thelancet.com': 0.95,
  'pnas.org': 0.95,
  'bmj.com': 0.95,
  'jamanetwork.com': 0.95,
  'sciencemag.org': 0.95,
  'annals.org': 0.93,
  'asm.org': 0.93,
  'royalsocietypublishing.org': 0.93,
  'plos.org': 0.93,
  'springer.com': 0.92,
  'sciencedirect.com': 0.92,
  'wiley.com': 0.92,
  'oup.com': 0.92,
  'cambridge.org': 0.92,
  'tandfonline.com': 0.90,
  'frontiersin.org': 0.88,

  // ─── Top tier — engineering / CS publishers (0.88-0.93) ─────────────────
  'ieee.org': 0.93,
  'acm.org': 0.93,
  'arxiv.org': 0.88,  // preprint — high value but NOT peer-reviewed (Risk 3)
  'biorxiv.org': 0.85,
  'medrxiv.org': 0.85,
  'usenix.org': 0.90,

  // ─── Top tier — government primary sources (0.92) ───────────────────────
  'nih.gov': 0.92,
  'cdc.gov': 0.92,
  'nasa.gov': 0.92,
  'noaa.gov': 0.92,
  'nist.gov': 0.92,
  'who.int': 0.92,
  'fda.gov': 0.92,
  'epa.gov': 0.92,
  'census.gov': 0.92,
  'usgs.gov': 0.92,
  'energy.gov': 0.92,
  'state.gov': 0.90,
  'gov.uk': 0.92,
  'europa.eu': 0.90,

  // ─── Top tier — academic institutions (0.90) ────────────────────────────
  'mit.edu': 0.90,
  'stanford.edu': 0.90,
  'harvard.edu': 0.90,
  'caltech.edu': 0.90,
  'berkeley.edu': 0.90,
  'princeton.edu': 0.90,
  'yale.edu': 0.90,
  'cmu.edu': 0.90,
  'columbia.edu': 0.90,
  'cornell.edu': 0.90,
  'ox.ac.uk': 0.90,
  'cam.ac.uk': 0.90,
  'ucl.ac.uk': 0.90,
  'imperial.ac.uk': 0.90,
  'ethz.ch': 0.90,
  'epfl.ch': 0.90,

  // ─── Upper-mid tier — wire services + intl broadcasting (0.88) ──────────
  'reuters.com': 0.88,
  'apnews.com': 0.88,
  'bbc.com': 0.88,    // RESEARCH § 11 Risk 2 — paired with bbc.co.uk
  'bbc.co.uk': 0.88,
  'npr.org': 0.85,
  'pbs.org': 0.85,

  // ─── Upper-mid tier — major newspapers (0.85) ───────────────────────────
  'nytimes.com': 0.85,
  'washingtonpost.com': 0.85,
  'wsj.com': 0.85,
  'theguardian.com': 0.85,
  'economist.com': 0.85,
  'ft.com': 0.85,
  'latimes.com': 0.85,
  'chicagotribune.com': 0.85,
  'bostonglobe.com': 0.85,
  'theatlantic.com': 0.85,
  'newyorker.com': 0.85,
  'foreignpolicy.com': 0.85,
  'foreignaffairs.com': 0.85,
  'usatoday.com': 0.78,
  'csmonitor.com': 0.82,

  // ─── Upper-mid tier — major international news (0.85) ───────────────────
  'spiegel.de': 0.85,
  'lemonde.fr': 0.85,
  'elpais.com': 0.85,
  'asahi.com': 0.85,
  'scmp.com': 0.85,
  'aljazeera.com': 0.85,
  'dw.com': 0.85,
  'france24.com': 0.85,
  'thehindu.com': 0.82,
  'japantimes.co.jp': 0.82,
  'globeandmail.com': 0.82,
  'cbc.ca': 0.82,
  'abc.net.au': 0.82,

  // ─── Upper-mid tier — science / tech journalism with editors (0.83) ─────
  'scientificamerican.com': 0.83,
  'newscientist.com': 0.83,
  'technologyreview.com': 0.83,
  'wired.com': 0.83,
  'arstechnica.com': 0.83,
  'theconversation.com': 0.83,
  'nautil.us': 0.78,
  'undark.org': 0.82,

  // ─── Upper-mid tier — government policy / statistics (0.82) ─────────────
  'bls.gov': 0.82,
  'federalreserve.gov': 0.82,
  'worldbank.org': 0.82,
  'imf.org': 0.82,
  'oecd.org': 0.82,
  'un.org': 0.82,
  'unesco.org': 0.82,
  'eia.gov': 0.82,
  'gao.gov': 0.82,

  // ─── Mid tier — encyclopedic reference (0.72-0.78) ──────────────────────
  'wikipedia.org': 0.72,
  'britannica.com': 0.75,
  'plato.stanford.edu': 0.85,  // SEP — peer-reviewed encyclopedia, scored as research
  'iep.utm.edu': 0.78,

  // ─── Mid tier — science communication (0.70-0.78) ───────────────────────
  'phys.org': 0.70,
  'sciencedaily.com': 0.70,
  'eurekalert.org': 0.70,
  'popsci.com': 0.70,
  'discovermagazine.com': 0.70,
  'quantamagazine.org': 0.78,
  'mayoclinic.org': 0.78,
  'clevelandclinic.org': 0.75,
  'health.harvard.edu': 0.85,
  'sciencenews.org': 0.78,

  // ─── Mid tier — tech / business trade publications (0.68) ───────────────
  'hbr.org': 0.68,
  'techcrunch.com': 0.68,
  'theverge.com': 0.68,
  'engadget.com': 0.68,
  'zdnet.com': 0.68,
  'cnet.com': 0.68,
  'venturebeat.com': 0.68,
  'bloomberg.com': 0.68,
  'businessinsider.com': 0.68,
  'forbes.com': 0.68,
  'inc.com': 0.68,
  'fastcompany.com': 0.68,
  'entrepreneur.com': 0.62,
  'protocol.com': 0.65,
  'restofworld.org': 0.78,

  // ─── Mid tier — well-known general-interest aggregators (0.65) ──────────
  'time.com': 0.65,
  'newsweek.com': 0.65,
  'thehill.com': 0.65,
  'politico.com': 0.65,
  'axios.com': 0.65,
  'vox.com': 0.65,
  'slate.com': 0.65,
  'salon.com': 0.65,
  'theintercept.com': 0.65,
  'propublica.org': 0.85,  // investigative — scored as journalism
  'motherjones.com': 0.65,

  // ─── Mid tier — niche / expert blogs from named orgs (0.62) ─────────────
  'psychologytoday.com': 0.62,
  'livescience.com': 0.62,
  'healthline.com': 0.62,
  'medicalnewstoday.com': 0.62,
  'webmd.com': 0.55,
  'verywellhealth.com': 0.55,
  'space.com': 0.62,
  'history.com': 0.55,

  // ─── Mid tier — educational platforms (0.60) ────────────────────────────
  'khanacademy.org': 0.60,
  'coursera.org': 0.60,
  'edx.org': 0.60,
  'ted.com': 0.60,
  'udemy.com': 0.45,
  'duolingo.com': 0.55,

  // ─── Low tier — blog platforms (0.15-0.30) ──────────────────────────────
  'medium.com': 0.30,
  'substack.com': 0.25,
  'tumblr.com': 0.15,
  'blogspot.com': 0.15,
  'wordpress.com': 0.20,
  'ghost.io': 0.25,
  'dev.to': 0.30,

  // ─── Low tier — social media / UGC (0.20-0.35) ──────────────────────────
  'reddit.com': 0.20,
  'quora.com': 0.20,
  'stackexchange.com': 0.35,
  'stackoverflow.com': 0.45,  // structured technical Q&A — slightly higher
  'twitter.com': 0.10,
  'x.com': 0.10,
  'facebook.com': 0.10,
  'linkedin.com': 0.25,
  'youtube.com': 0.30,

  // ─── Low tier — news aggregators / mid-quality outlets (0.35) ───────────
  'msn.com': 0.35,
  'yahoo.com': 0.35,
  'huffpost.com': 0.35,
  'dailymail.co.uk': 0.35,
  'nypost.com': 0.35,
  'foxnews.com': 0.35,
  'breitbart.com': 0.35,
  'thefederalist.com': 0.35,
  'dailywire.com': 0.35,
  'thedailybeast.com': 0.35,
  'rt.com': 0.20,
  'sputniknews.com': 0.20,

  // ─── Low tier — link aggregators (0.25) ─────────────────────────────────
  'digg.com': 0.25,
  'flipboard.com': 0.25,
  'pocket.co': 0.25,
  'mix.com': 0.25,

  // ─── Blocked tier — AI content farms / sensationalism factories (0.0) ───
  'articleforge.com': 0.0,
  'spinrewriter.com': 0.0,
  'ilovewiki.com': 0.0,
  'thesun.co.uk': 0.0,
  'mirror.co.uk': 0.0,
  'tmz.com': 0.0,

  // ─── Blocked tier — SEO aggregators / scraper sites (0.0) ───────────────
  'ezinearticles.com': 0.0,
  'hubpages.com': 0.0,
  'infobarrel.com': 0.0,
  'squidoo.com': 0.0,  // defunct but may appear in old caches
  'suite101.com': 0.0,
  'helium.com': 0.0,
  'associated-content.com': 0.0,
  'buzzle.com': 0.0,
  'answerbag.com': 0.0,
  'examiner.com': 0.0,
  'demandstudios.com': 0.0,
  'ehow.com': 0.0,

  // ─── Blocked tier — doorway / thin-content sites (0.0) ──────────────────
  'reference.com': 0.0,
  'ask.com': 0.0,
  'answers.com': 0.0,
  'factmonster.com': 0.0,
  'funtrivia.com': 0.0,
  'wikihow.com': 0.0,
  'about.com': 0.0,
  'chacha.com': 0.0,
} as const;

// Module-level Map initialized once at import time (RESEARCH § 8 Pitfall 5
// — do NOT lazy-init inside scoreSource; one-time module load is < 1ms).
// Declared after DOMAIN_TIERS so the Object.entries call sees the populated
// const. scoreSource() is only invoked AFTER module-load completes (from
// external callers + tests), so the function-declaration vs. _tierMap-init
// ordering is safe in practice.
const _tierMap = new Map<string, number>(Object.entries(DOMAIN_TIERS));
