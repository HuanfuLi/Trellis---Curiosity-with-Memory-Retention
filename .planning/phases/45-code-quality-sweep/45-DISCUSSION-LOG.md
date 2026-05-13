# Phase 45: Code Quality Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 45-code-quality-sweep
**Areas discussed:** Audit vs fix boundary, TypeScript/lint/test hygiene, dead-code cleanup, performance profiling, operator notes and debug bugs

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| All of them | Discuss every Phase 45 gray area | x |
| Audit vs fix boundary | Discuss only audit/fix policy | |
| Performance scope | Discuss only profiling scope | |
| Operator notes/debug bugs | Discuss only notes and bugs | |
| Test failures and strictness | Discuss only tests and TypeScript | |

**User's choice:** All areas.
**Notes:** The earlier generated context had not been discussed with the user and was reverted before this real discussion.

---

## Audit Vs Fix Boundary

| Question | Selected | Notes |
|----------|----------|-------|
| How aggressive should Phase 45 be? | Fix low-risk/local issues only; defer broad changes with rationale | User chose 1A |
| Existing failing tests rule | Fix stale tests when canonical behavior is documented; fix code only when behavior is actually wrong | User chose 2A |
| TODO/FIXME/HACK handling | Catalogue every item, close obvious stale ones, defer future-work items | User chose 3A |
| Debug/operator note standard | Verify whether newer Phase 43 work already closed notes, then only fix remaining live bugs | User chose 4A |

---

## TypeScript, Lint, And Test Hygiene

| Question | Selected | Notes |
|----------|----------|-------|
| TypeScript strictness posture | Enable stricter flags if the diff looks manageable | User chose 1B |
| Suppression comments | Triage all; remove/narrow only where the local type fix is obvious | User chose 2A |
| Source-reading tests | Keep where dynamic imports are blocked, but fix brittle windows/regex drift | User chose 3A |
| Known stale test baselines | Treat Phase 42/43 constant drift and import behavior as Phase 45 targets | User chose 4A |

---

## Dead Code And Removed-Feature Residue

| Question | Selected | Notes |
|----------|----------|-------|
| Dead code removal posture | Remove true orphan exports/imports/helpers/residue only; avoid aesthetic refactors | User chose 1A |
| Removed YouTube short/video residue | Verify Phase 38 closed it; remove only remaining read/write paths or stale tests/docs | User chose 2A |
| Legacy EchoLearn compatibility | Preserve on-disk path and legacy localStorage migration unless proven harmful | User chose 3A |
| i18n and locale cleanup | Remove stale locale keys only when no live source/test references remain; preserve four-locale parity | User chose 4A |

---

## Performance Profiling

| Question | Selected | Notes |
|----------|----------|-------|
| Required profiling targets | First paint, queue refill, masonry scroll, and GraphScreen Android drag lag | User chose 1A |
| Evidence standard | Require documented profile artifact with observed evidence and reproduction notes | User chose 2A |
| Fix threshold | Fix any clear performance issue found, even if moderate scope | User chose 3B |
| Instrumentation | Temporary/local profiling only; no persistent telemetry or user-visible diagnostics | User chose 4A |

---

## Operator Notes And Debug Bugs

| Question | Selected | Notes |
|----------|----------|-------|
| Phase 43 late debug notes | Verify whether 43-14/43-15 already closed dismiss filtering and Force-New-Day duplicate keys before planning new work | User chose 1A |
| Older Force-New-Day notes | Check supersession against later Phase 36/43 fixes; close if covered, fix only remaining live defects | User chose 2A |
| GraphScreen Android drag lag | Treat as profiling target first; fix if the cause is clear and bounded | User chose 3A |
| Notes disposition | Each note must end as closed, folded into Phase 45, or explicitly deferred with rationale | User chose 4A |

---

## the agent's Discretion

- Exact audit artifact names beyond required content.
- Exact profiling toolchain.
- Whether to group fixes by concern area or by file, provided commits remain reviewable.

## Deferred Ideas

- Broad UI polish and tile-metadata redesign.
- Dependency version bumps and package migrations.
- Persistent telemetry or user-visible diagnostic tooling.
- Backend/cross-device sync for engagement or notes.
