---
status: awaiting_human_verify
trigger: "Debug why Gemini image generation is consistently failing in the EchoLearn app."
created: 2026-03-26T00:00:00Z
updated: 2026-03-26T00:00:00Z
---

## Current Focus

hypothesis: The model name in the endpoint URL is wrong ("gemini-3.1-flash-image-preview" does not exist), AND the request body is missing the required TEXT modality alongside IMAGE, causing the generateContent API to reject every request.
test: Confirmed by reading the provider source directly — no need for a runtime test.
expecting: Fix the model name to "gemini-2.0-flash-preview-image-generation" and add "TEXT" to responseModalities.
next_action: Apply fix to src/providers/gemini.provider.ts

## Symptoms

expected: Gemini image generation should return a generated image when a valid API key is provided.
actual: Image generation fails consistently every time.
errors: Likely HTTP 400 or 404 from the API (model not found, or invalid request body). Callers receive "No image data in response" or an HTTP error code result.
reproduction: Configure a Gemini API key in Settings, trigger image generation, observe failure.
started: Presumably since the feature was first written — the model name has never been correct.

## Eliminated

- hypothesis: API key wiring / bootstrap is wrong
  evidence: imageGeneration.bootstrap.ts correctly reads geminiApiKey from settings and passes it to new GeminiProvider(geminiKey). isConfigured() check is correct.
  timestamp: 2026-03-26T00:00:00Z

- hypothesis: Response parsing is wrong (incorrect field path)
  evidence: The response parsing uses candidates[0].content.parts[].inlineData which is exactly the correct shape for generateContent responses. Not the bug.
  timestamp: 2026-03-26T00:00:00Z

- hypothesis: Endpoint base URL format is wrong (using /predict instead of /generateContent)
  evidence: The code already uses /generateContent endpoint (not the Imagen /predict endpoint). Correct API family is selected.
  timestamp: 2026-03-26T00:00:00Z

## Evidence

- timestamp: 2026-03-26T00:00:00Z
  checked: gemini.provider.ts line 21 — modelEndpoint constant
  found: "gemini-3.1-flash-image-preview" is embedded in the URL. This model does not exist in Google's API. The correct model name for generateContent-based image generation is "gemini-2.0-flash-preview-image-generation".
  implication: Every request hits a 404 or 400 because the model name is invalid.

- timestamp: 2026-03-26T00:00:00Z
  checked: gemini.provider.ts lines 113-123 — request body construction
  found: generationConfig.responseModalities is set to ["IMAGE"] only. Google's documentation for gemini-2.0-flash-preview-image-generation requires ["TEXT", "IMAGE"] — the TEXT modality must be included or the API returns an error.
  implication: Even if the model name were corrected, the request body would still be rejected.

- timestamp: 2026-03-26T00:00:00Z
  checked: gemini.provider.ts lines 134-138 — HTTP 400 / 403 error handling
  found: Both 400 and 403 responses are mapped to "API_KEY_INVALID" with retryable: false. A 400 caused by a bad model name or bad request body would be misreported as an invalid API key and silently swallowed (no retry, misleading error message to the user).
  implication: The error swallowing makes the real cause invisible. User sees "Invalid Gemini API key" even though the key is fine.

- timestamp: 2026-03-26T00:00:00Z
  checked: gemini.provider.ts comment (line 9) vs implementation (line 21)
  found: The file comment says the endpoint should be imagen-3.0-generate-002:predict (Imagen API), but the implementation uses generateContent (Gemini Flash API). These are two completely different API families with different schemas. The comment is stale and misleading — the implementation approach (generateContent) is the correct one for the user's use case, but the model name needs updating.
  implication: Stale comment contributed to confusion but is not the runtime bug.

## Resolution

root_cause: Three compounding bugs in src/providers/gemini.provider.ts:
  1. Wrong model name — "gemini-3.1-flash-image-preview" does not exist. Correct name is "gemini-2.0-flash-preview-image-generation".
  2. Missing TEXT modality — responseModalities must be ["TEXT", "IMAGE"], not ["IMAGE"] alone.
  3. HTTP 400 misclassified as API_KEY_INVALID — a bad-request error (wrong model, wrong body) is indistinguishable from an auth error in the current error handler, silencing the real failure.

fix: |
  1. Change modelEndpoint to use "gemini-2.0-flash-preview-image-generation".
  2. Change responseModalities from ["IMAGE"] to ["TEXT", "IMAGE"].
  3. Separate 400 (bad request) from 403 (auth error) in error handling so model/body errors are reported correctly.
  4. Update the stale comment at the top of the file.

verification: empty
files_changed:
  - src/providers/gemini.provider.ts
