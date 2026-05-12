# Phase 44 Manual Smoke / UAT

## Setup

Commands run from `app/`.

Start the local app with:

```bash
npm run dev -- --host 127.0.0.1
```

Build precheck:

- `npm run build`
- build precheck exit code: 0

## Manual Smoke Rows

| id | surface | steps | expected | status | evidence | tester |
|----|---------|-------|----------|--------|----------|--------|
| locale-switch | Settings locale runtime | Switch English to Chinese to Spanish to Japanese in Settings. | Visible UI strings change and no runtime error appears. | pending | Awaiting human verification. | pending |
| ask-streaming | Ask streaming runtime | Start an Ask request. | Streaming text appears and the request completes or aborts without a stuck loading state. | pending | Awaiting human verification. | pending |
| queue-refill | Home feed refill runtime | Trigger Home feed refill or swipe-for-more. | Feed content appears and no duplicate React key warning appears. | pending | Awaiting human verification. | pending |
| saved-route-navigation | Saved route runtime | Open `/saved`, switch Saved and Liked tabs, then return to `/home`. | Route navigation works. | pending | Awaiting human verification. | pending |
| android-sync-sanity | Capacitor native sync sanity | Confirm Plan 44-02 recorded `npx cap sync` exit code 0; if native files changed, confirm changed paths are under `app/android/`. | Sync evidence is present and Android native diff is either absent or under `app/android/`. | pending | Awaiting human verification. | pending |
