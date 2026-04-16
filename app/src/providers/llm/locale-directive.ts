// ─── Locale injection (D-12) ─────────────────────────────────────────────────
// Central pre-flight rewrite: every outbound LLM request gets a "Respond in
// {localeName}." directive. Idempotent. Zero per-call-site changes required.
//
// IMPORTANT (D-07): This module is the ONLY code path that reads i18n locale
// for an LLM request. Do NOT add a `locale` param to CompletionOptions or any
// call site. Do NOT call chatCompletion/chatStream for translation — dev-time
// Sonnet subagent owns all UI translation (see CLAUDE.md i18n Workflow).
//
// This file is intentionally extracted from `./index.ts` so it can be imported
// by `node --test` on Node 25+ without pulling in the provider's JSON-import
// chain (src/locales/index.ts statically imports *.json bundles; Node 25
// rejects those imports without `with { type: 'json' }` attributes).
// `applyLocaleDirective` reads the i18next global singleton's current language
// — the same instance that `src/locales/index.ts` configures at app startup.
import i18next from 'i18next';
import type { SupportedLocale } from '../../types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Human-readable names for LLM "Respond in {name}" directive (D-12).
// Duplicated intentionally (and kept in lockstep with `src/locales/index.ts`
// `LOCALE_NAMES`) so this module does NOT transitively import JSON bundles.
// Explicit "Simplified Chinese" avoids LLMs defaulting to Traditional/Cantonese.
const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  zh: 'Simplified Chinese',
  es: 'Spanish',
  ja: 'Japanese',
};

export function applyLocaleDirective(messages: ChatMessage[]): ChatMessage[] {
  const lng = i18next.language as SupportedLocale;
  const locale: SupportedLocale = lng in LOCALE_NAMES ? lng : 'en';
  const directive = `Respond in ${LOCALE_NAMES[locale]}.`;

  const systemIdx = messages.findIndex((m) => m.role === 'system');
  if (systemIdx === -1) {
    return [{ role: 'system', content: directive }, ...messages];
  }
  const existing = messages[systemIdx];
  // Idempotent: don't re-inject if this exact directive is already present.
  if (existing.content.includes(directive)) return messages;
  const merged: ChatMessage = {
    ...existing,
    content: `${existing.content.trimEnd()}\n\n${directive}`,
  };
  return [...messages.slice(0, systemIdx), merged, ...messages.slice(systemIdx + 1)];
}
