# EchoLearn — Claude Instructions

Project root instructions for Claude Code agents working on this repository.

## Project Overview

EchoLearn is an AI-powered personalized learning platform (React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Capacitor 8). Local-first, privacy-preserving. Multi-provider LLM support (OpenAI, Claude, Gemini, local endpoints like LM Studio). See `.planning/PROJECT.md` for full vision.

**Working directory for the app:** `app/`

**Test framework:** Node.js built-in `node --test` with esbuild tsx loader — see `app/tests/canonical-knowledge.test.mjs` for the pattern. Phase 27 locale tests avoid the JSON-import-attribute failure chain by importing `i18next` directly; follow the same pattern for any new pure-logic helpers.

## Style Conventions

- **Inline styles with CSS variables** (NOT Tailwind classes for most UI)
- Key CSS vars: `--primary-40`, `--surface`, `--surface-variant`, `--muted-foreground`, `--radius-xl`, `--shadow-1/2/3`
- Services return `ServiceResult<T> = { success, data?, error? }`
- localStorage for all user preferences via `settingsService`
- Event bus (`src/lib/event-bus.ts`) for cross-screen notifications (LOCALE_CHANGED, REVIEW_COMPLETED, etc.)

---

## i18n Workflow (Phase 27+)

EchoLearn supports 4 locales: **English** (canonical/source), **Simplified Chinese**, **Spanish**, **Japanese**.

### Bundle files

All translation bundles live at:

- `app/src/locales/en.json` — **canonical** (source of truth, hand-authored)
- `app/src/locales/zh.json` — Simplified Chinese
- `app/src/locales/es.json` — Spanish
- `app/src/locales/ja.json` — Japanese

Related infrastructure:

- `app/src/locales/index.ts` — i18next init, `SUPPORTED_LOCALES`, `LOCALE_NAMES`, data-locale listener
- `app/src/locales/i18n.d.ts` — module augmentation for type-safe `t()` keys
- `app/src/lib/locale.ts` — `normalizeLocale`, `detectInitialLocale`, `detectDeviceLocale`
- `app/src/providers/llm/locale-directive.ts` — central `applyLocaleDirective` for LLM calls (D-12)
- `app/src/services/youtube-locale-url.ts` — `buildYoutubeSearchUrl` with locale params (D-14)

### The ONE rule (no exceptions)

**Runtime LLM translation is PROHIBITED.** The app's `llmProvider` (`app/src/providers/llm/index.ts`) must NEVER be invoked to translate UI copy at runtime. Any code path that calls `chatCompletion` / `chatStream` for translation is a bug. This rule is enforced by:

- `app/tests/services/web-search-no-locale.test.mjs` — guards Tavily neutrality (D-15)
- The central `applyLocaleDirective` in `providers/llm/locale-directive.ts` is for TELLING the LLM what locale to respond in during normal Q&A, NOT for translating UI copy

See `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_i18n_translation.md` for the durable rule and rationale.

### Adding a new UI string — the EN-first workflow

Every PR that adds a user-visible string MUST land all 4 locale bundles in the SAME PR. No exceptions.

1. **Add the canonical EN value** to `app/src/locales/en.json` (nested under the right namespace — see list below).
2. **Run the Sonnet subagent** (see prompt template at `app/scripts/translate-locales.md`) three times — once per non-EN locale — to fill in zh/es/ja values. Prompt the subagent with: the full current `en.json`, the existing target locale file, and the translation rules.
3. **Review the generated translations.** Never commit raw subagent output — always human-review. Pay special attention to: proper nouns (don't translate "EchoLearn", "OpenAI", "Claude", etc.), interpolation placeholders (`{{name}}`, `{{count}}` must appear verbatim), and length (Spanish runs ~20% longer; watch for overflow).
4. **Commit all 4 bundles + code in one PR.** The `bundle-parity.test.mjs` test will block merges where key sets diverge.

### Namespaces (as of Phase 27)

Flat nested JSON. Top-level groups:

- `common.*` — shared across screens: buttons, nav labels (`common.nav.*`), toast messages (`common.toast.*`), greetings (`common.greeting.*`), actions (`common.action.*`)
- `home.*` — HomeScreen (includes `home.bento.*`, `home.toast.*`)
- `planner.*` — PlannerScreen (includes `planner.trellis.*` for trellis panel, `planner.toast.*`)
- `ask.*` — AskScreen and AskScreen sub-flows (includes `ask.drawer`, `ask.history`, `ask.welcome`, `ask.suggestedPrompts`, `ask.rateLimit`, `ask.postThread`)
- `review.*` — ReviewScreen (includes `review.library.*`, `review.miniMap.*`, `review.session.*`, `review.done.*`)
- `graph.*` — GraphScreen (includes `graph.anchor.*`, `graph.cluster.*`, `graph.reorganizeModal`, `graph.selected`, `graph.toast`)
- `podcast.*` — PodcastScreen (includes `podcast.player.*`, `podcast.generateCard.*`, `podcast.knowledgeToday.*`, `podcast.insertBanner.*`, `podcast.toast.*`)
- `posts.*` — Post feed and detail (includes `posts.detail.*`, `posts.qa.*`, `posts.connection.*`, `posts.image.*`)
- `settings.*` — SettingsScreen (14 sub-namespaces: `sections`, `fields`, `descriptions`, `placeholders`, `providerLabels`, `voices`, `themes`, `toast`, `confirm`, `test`, `planner`, `buttons`, `cacheStats`, `usageTable`, `zerotier`, `about`)
- `onboarding.*` — OnboardingScreen (includes `onboarding.welcome.*`, `onboarding.consent.*`, `onboarding.llm.*`)
- `questionDetail.*` — QuestionDetailScreen (promoted to top-level)

### Validation

Run from `app/`:
```bash
node --test tests/locales/bundle-parity.test.mjs   # asserts identical key sets across 4 bundles
node --test tests/locales/missing-key.test.mjs     # asserts missing-key handler fires + fallback renders EN
tsc -b --noEmit                                    # typos in t('...') keys fail compilation (via module augmentation)
npm test                                           # full suite
```

### Subagent prompt template

See `app/scripts/translate-locales.md` for the copy-paste-ready prompt.

### What NOT to translate

- **Proper nouns:** EchoLearn, OpenAI, Claude, Gemini, YouTube, Tavily, API, TTS, LLM, SM-2, iOS, Android, Capacitor, GPT, SQLite, Nano Banana, ZeroTier
- **LLM system prompts** (in services that call `chatCompletion`) — those stay English so the LLM understands; the user-facing RESPONSE is what gets translated, via the central locale directive in `applyLocaleDirective`
- **Tavily web-search queries** — intentionally English for broader coverage (D-15). The test `web-search-no-locale.test.mjs` enforces this.
- **Cross-locale branded labels** — "Language / 语言 / Idioma / 言語" in SettingsScreen + OnboardingScreen language pickers stay hardcoded so users in any locale can recognize them. Also: "Continue · 继续 · Continuar · 続ける" and "Choose your language · 选择语言 · Elige tu idioma · 言語を選択" in the Onboarding language step. These MUST NEVER enter `en.json`.
- **Provider/model identifiers:** `gpt-4o`, `claude-sonnet-4-6`, `gemini-3.1-flash-image-preview`, `llama3`, etc. — technical identifiers, not user-facing content.
- **Emoji prefix on Settings test results:** `'✓'` / `'✗'` — downstream color logic (`.startsWith('✓')`) depends on it.
- **Static content blurbs:** HomeScreen `MILESTONE_POOL` (5 trivia/milestone cards) deliberately left hardcoded — content vs UI-chrome distinction; deferred to a future content-localization phase.

### Reference docs

- `.planning/phases/27-add-i18n-l10n-support/27-CONTEXT.md` — all 24 locked decisions (D-01..D-24)
- `.planning/phases/27-add-i18n-l10n-support/27-RESEARCH.md` — technical research, versions, patterns, pitfalls
- `.planning/phases/27-add-i18n-l10n-support/27-VALIDATION.md` — Nyquist test contract
- `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_i18n_translation.md` — durable rule, rationale
