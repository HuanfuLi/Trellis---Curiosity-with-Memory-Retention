# Phase 44 Automated Verification Evidence

Source of truth: `44-02-automated-verification-native-sync-PLAN.md`
Dependency update evidence: `44-DEPENDENCY-SWEEP.md`
Recorded: 2026-05-12T08:37:09Z and later command runs

## Test Evidence

Post-Phase-43 baseline from `.planning/STATE.md` and `43-15-force-new-day-dedup-SUMMARY.md`: `npm run test:actions` exits 0; `npm run test:main` may fail only with known signatures involving `concept-feed.test.mjs`, `concept-feed-source-diversity-wiring`, `image-gen-key-gate`, `post-queue.test.mjs`, and `trellis-layout.test.mjs`.

### `npm run test:main`

exit code: 1

summary output:

```text
tests 844
suites 81
pass 839
fail 5
cancelled 0
skipped 0
todo 0
duration_ms 60624.737084
```

failing files/signatures:

- `concept-feed.test.mjs` - known pre-existing `ERR_MODULE_NOT_FOUND` for extensionless `youtube.service` import.
- `concept-feed-source-diversity-wiring` - known pre-existing source-reading assertion drift around `walkDerivedList(16, exploredIds, dismissedIds)`.
- `image-gen-key-gate` - known pre-existing image generation key gate assertion.
- `post-queue.test.mjs` - known pre-existing stale threshold assertion for `needsRefill` at 16 instead of current 24.
- `trellis-layout.test.mjs` - known pre-existing date-dependent `getVineColor` assertion.

Phase 44 regression status: none. No failing filename outside the documented post-Phase-43 baseline appeared.

### `npm run test:actions`

exit code: 0

summary output:

```text
tests 16
suites 0
pass 16
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 122.047375
```

### `npm test`

exit code: 0

summary output:

```text
npm test runs: npm run test:main; npm run test:actions

npm run test:main:
tests 844
suites 81
pass 839
fail 5
cancelled 0
skipped 0
todo 0
duration_ms 60620.883084

npm run test:actions:
tests 16
suites 0
pass 16
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 117.033417
```

`npm test` exits 0 because `app/package.json` chains `test:main; test:actions` with a semicolon, so the final action-suite success determines the script exit code. The main-suite failures are still recorded above and remain within the known baseline.
