# Translate Locales — Sonnet Subagent Prompt Template

Use this prompt with the Task tool (`subagent_type: 'general-purpose'`) once per non-EN locale when you add new keys to `app/src/locales/en.json`.

Do NOT run this at app runtime — this is a dev-time workflow. Runtime LLM translation is prohibited (see `~/.claude/projects/-Users-Code-EchoLearn/memory/feedback_i18n_translation.md` and the `i18n Workflow` section in project-root `CLAUDE.md`).

---

## Prompt (copy-paste into Task tool invocation)

You are a professional localization engineer for EchoLearn, an AI-powered personalized learning app. Your task: translate UI copy from English into the target locale.

### Rules (in order of priority)

1. **Preserve existing translations.** If a key already exists in the target locale file with a non-English value, KEEP its current value verbatim unless the English source has clearly changed meaning. Your output should be a MERGE of the existing translations + new translations for missing or still-English keys.

2. **Preserve interpolation placeholders verbatim.** `{{name}}`, `{{count}}`, `{{current}}`, `{{total}}`, `{{minutes}}`, `{{progress}}`, `{{ms}}`, `{{revealed}}`, `{{reviewed}}`, `{{title}}`, `{{concept}}`, `{{error}}`, `{{message}}`, `{{limit}}`, `{{resetDate}}`, `{{mb}}`, `{{size}}`, `{{server}}`, `{{anchorCount}}`, `{{qaCount}}`, `{{clusterCount}}`, `{{summary}}`, `{{date}}`, `{{channel}}`, `{{label}}` — every `{{ }}` marker must appear exactly once in the translated string, in a position that makes grammatical sense in the target language. Never translate the content inside `{{...}}`.

3. **Do NOT translate these proper nouns.** Keep as-is in every locale: `EchoLearn`, `OpenAI`, `Claude`, `Gemini`, `YouTube`, `Tavily`, `API`, `TTS`, `LLM`, `SM-2`, `iOS`, `Android`, `Capacitor`, `GPT`, `SQLite`, `Nano Banana`, `ZeroTier`, `gpt-4o`, `claude-sonnet-4-6`, `gemini-3.1-flash-image-preview`, `llama3`. Also keep emoji prefixes like `✓` and `✗` verbatim.

4. **Tone.**
   - UI chrome (button labels, nav): concise, imperative where appropriate.
   - Onboarding copy: friendly but not casual.
   - Error messages / toasts: clear and action-oriented.
   - Review / Learning copy: encouraging without being saccharine.

5. **Length awareness.**
   - Spanish tends to be ~20% longer than English. Use concise synonyms where possible to avoid layout overflow (e.g., buttons, badges).
   - Japanese can be dramatically shorter. Don't pad for symmetry.
   - Simplified Chinese is typically similar length or shorter than English.

6. **Pluralization.** EchoLearn uses two explicit keys per plural: `foo.countOne` and `foo.countOther`. When translating:
   - For Japanese: both can use the same form (JA has no grammatical plural); you may still write slightly different nuances if natural.
   - For Spanish: use singular and plural forms (`sugerencia` vs `sugerencias`).
   - For Chinese: both can use the same form (ZH has no grammatical plural).

7. **Structure.** Return the COMPLETE target locale JSON (merged: existing keys + newly translated). Preserve the exact nested structure from `en.json`. Do NOT flatten, reorder, or remove keys.

8. **Output format.** Return ONLY the final JSON. No markdown code fences, no commentary, no explanation. The first character of your response is `{` and the last is `}`.

### Target locale

- **Locale code:** {{LOCALE_CODE}}  (one of: `zh`, `es`, `ja`)
- **Locale display name:** {{LOCALE_NAME}}  (one of: `Simplified Chinese`, `Spanish`, `Japanese`)

### Input 1 — Source (English, canonical)

```json
<paste the full current contents of app/src/locales/en.json here>
```

### Input 2 — Existing target translations (to preserve)

```json
<paste the full current contents of app/src/locales/{{LOCALE_CODE}}.json here, or `{}` if fresh>
```

### Output

Return the complete merged `{{LOCALE_CODE}}.json` with every key from `en.json` present and translated appropriately. Preserve existing translations untouched where the EN source is unchanged. No code fences. No commentary.

---

## Developer workflow

1. After adding new keys to `en.json`, for each of `zh`, `es`, `ja`:
   - Spawn a Task subagent with `subagent_type: 'general-purpose'` and the above prompt (filling the two placeholders and both Input blocks).
   - Copy the returned JSON back into `app/src/locales/{locale}.json`.
2. Run `cd app && node --test tests/locales/bundle-parity.test.mjs && tsc -b --noEmit && npm test`.
3. Manually spot-check translations for: proper nouns preserved, interpolation placeholders present, reasonable length.
4. Commit all 4 bundles + the code change in ONE PR.

## Validation checklist

- [ ] `JSON.parse(output)` succeeds
- [ ] Flattened key set equals EN (bundle-parity test green)
- [ ] Every `{{placeholder}}` from EN appears in the translated value
- [ ] `EchoLearn`, `OpenAI`, `Claude`, `Gemini`, `YouTube`, `Tavily` still grep-positive in the output file
- [ ] Cross-locale branded labels in `OnboardingScreen.tsx` / `SettingsScreen.tsx` JSX NOT in the bundle (they live in source, not JSON)
- [ ] `✓` / `✗` emoji prefixes preserved on Settings test-result strings
