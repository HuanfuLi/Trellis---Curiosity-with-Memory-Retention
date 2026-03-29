# Repository Guidelines

## Project Structure & Module Organization
This repo is organized around the app in [`app/`](/Users/Code/EchoLearn/app) and product/spec docs in [`openspec/`](/Users/Code/EchoLearn/openspec). Main frontend code lives in [`app/src/`](/Users/Code/EchoLearn/app/src): `components/` for reusable UI, `screens/` for routed views, `services/` for business logic, `providers/` for AI and media integrations, `state/` for shared hooks/store, and `lib/` for utilities. Tests live in [`app/tests/`](/Users/Code/EchoLearn/app/tests) by area (`components`, `screens`, `services`, `providers`, `hooks`). Native Android output is under [`app/android/`](/Users/Code/EchoLearn/app/android). Use [`Documents/`](/Users/Code/EchoLearn/Documents), [`ROADMAP.md`](/Users/Code/EchoLearn/ROADMAP.md), and [`openspec/changes/`](/Users/Code/EchoLearn/openspec/changes) for planning and change context.

## Build, Test, and Development Commands
Run commands from [`app/`](/Users/Code/EchoLearn/app):

```bash
npm install       # install dependencies
npm run dev       # start the Vite dev server
npm run build     # type-check and produce a production build
npm run lint      # run ESLint on TS/TSX source
npm test          # run node:test suites in app/tests/**/*.test.mjs
npx cap sync      # sync the web build into Capacitor platforms
```

## Coding Style & Naming Conventions
The app uses TypeScript, React 19, Vite, and Tailwind CSS 4. Follow the existing style: functional React components, hooks for shared behavior, and one responsibility per service module. Use `PascalCase` for components/screens (`MoveCard.tsx`), `camelCase` for utilities/hooks/services (`useInfiniteScroll.ts`, `planner.service.ts`), and `kebab-case` for spec change folders. ESLint is configured in [`app/eslint.config.js`](/Users/Code/EchoLearn/app/eslint.config.js); `_`-prefixed unused variables are allowed. Match the surrounding file’s formatting exactly.

## Testing Guidelines
Tests use Node’s built-in `node:test` runner with `assert/strict`. Add unit tests beside the relevant area in [`app/tests/`](/Users/Code/EchoLearn/app/tests) and name files `*.test.mjs`. Prefer targeted service/component tests before manual UAT notes. For API/provider behavior, mock network calls instead of hitting live services.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style, often scoped by phase, for example `feat(12-01): wire MoveCard Add button to navigateToMove` and `docs(phase-12): Add Phase 12 planning`. Keep commits focused and descriptive. PRs should include: a short problem/solution summary, linked phase/spec/issue, test evidence (`npm test`, `npm run lint`, build status), and screenshots or recordings for UI changes.

## Specs & Change Management
When behavior changes, update the relevant OpenSpec artifacts in [`openspec/specs/`](/Users/Code/EchoLearn/openspec/specs) or add a change proposal under [`openspec/changes/`](/Users/Code/EchoLearn/openspec/changes). Keep docs aligned with shipped code.
