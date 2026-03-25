---
status: testing
phase: 06-question-quality-evaluation
source: [06-VERIFICATION.md, 06-01-SUMMARY.md]
started: 2026-03-25T05:50:00Z
updated: 2026-03-25T05:50:00Z
---

## Current Test

number: 2
name: Pattern Detection: Multiple Off-Topic Categories
expected: |
  Try each category: (a) Greeting: "Hey!", (b) Meta: "What's your name?", 
  (c) Joke: "Tell me a joke", (d) Test: "lol", (e) Trivial: "ok"
  All should flag with "Off-topic" badge. Valid questions like "What is photosynthesis?" should NOT flag.
awaiting: user response

## Tests

### 1. Off-topic Badge Visual Appearance
expected: |
  Ask a greeting (e.g., "Hello!" or "Hi there") — after AI responds, 
  a non-intrusive badge reading "Off-topic" with warning icon appears below the response. 
  Substantive questions do NOT show a badge.
result: PASS - Greeting "Hello!" correctly flagged. Substantive question "What is photosynthesis?" correctly NOT flagged.

### 2. Pattern Detection: Multiple Off-Topic Categories
expected: |
  Try each category: (a) Greeting: "Hey!", (b) Meta: "What's your name?", 
  (c) Joke: "Tell me a joke", (d) Test: "lol", (e) Trivial: "ok"
  All should flag with "Off-topic" badge. Valid questions like "What is photosynthesis?" should NOT flag.
result: ISSUE - PARTIAL PATTERN COVERAGE
  ✓ "Hey there!" (greeting) — FLAGGED (confidence 0.9)
  ✓ "Tell me a joke" (joke) — FLAGGED (confidence 0.95)
  ✗ "What's your name?" (meta) — NOT FLAGGED - pattern requires exact prefix "what can you do" etc.
  ✗ "lol" (test/trivial) — NOT FLAGGED - pattern requires exact prefix "test|asdf|xyz|lol|..."
  ✗ "ok" (trivial acknowledgment) — NOT FLAGGED - pattern requires exact match "^(ok|okay)$" but user input may have trailing context
  ✗ "Are you serious?" (test) — NOT FLAGGED - pattern missing
  ✗ "Alright" (acknowledgment) — NOT FLAGGED - not in trivial pattern list
  
  Root cause: Regex patterns use ^ anchor and require exact prefix match. Questions like "What's your name?" 
  need pattern to match "what (is your|'s your|are your)? name" not just "what can you do...". 
  Pattern library incomplete for common meta-question variations.

### 3. Badge Styling and Position
expected: |
  Badge is styled with warning colors (background lighter red/orange, dark red text). 
  Badge appears on the right side of the message area, below the AI response text, 
  not obstructing the response or next input area.
result: [pending]

### 4. Override Flow: Click Badge
expected: |
  Click the "Off-topic" badge on a flagged message. 
  An inline confirmation panel appears reading "This looks off-topic. Save anyway?" 
  with two buttons: "Yes, save anyway" and "Discard" (no modal popup).
result: [pending]

### 5. Override Flow: Yes, Save Anyway
expected: |
  After clicking "Yes, save anyway", a toast message appears at the bottom 
  saying "Question saved to knowledge base" (or similar success message). 
  The "Off-topic" badge disappears immediately.
result: [pending]

### 6. Override Flow: Discard Button
expected: |
  Click the "Off-topic" badge, see the confirmation panel, click "Discard". 
  The panel collapses (disappears), the badge persists, and the question is NOT overridden.
result: [pending]

### 7. Knowledge Graph Exclusion (Not Overridden)
expected: |
  Ask a flagged greeting (e.g., "Hello!") and do NOT override it (do NOT click "Yes, save anyway"). 
  Navigate to Review, Knowledge Graph, or Flashcards screens. 
  The greeting does NOT appear in any of these screens' data.
result: [pending]

### 8. Knowledge Graph Inclusion (Overridden)
expected: |
  Ask a flagged greeting, click "Yes, save anyway" (override), 
  then navigate to Review or Knowledge Graph. 
  The greeting now APPEARS in the knowledge base (with the override applied).
result: [pending]

### 9. Follow-up Context Awareness
expected: |
  Ask a substantive question (e.g., "What is photosynthesis?"), get a response, 
  then ask a follow-up (e.g., "Can you elaborate?"). 
  The follow-up should NOT be flagged as off-topic because it is clearly a follow-up 
  to the previous question (context-aware detection).
result: [pending]

### 10. Session Context: Prior Q&A Pair
expected: |
  Ask "What is machine learning?", get response, 
  then ask "What does that mean?" — this should be recognized as a follow-up 
  asking for clarification of the ML explanation and NOT flagged.
result: [pending]

## Summary

total: 10
passed: 1
issues: 1
pending: 8
skipped: 0
blocked: 0

## Gaps

**Issue #1: Incomplete pattern library (Severity: MAJOR)**
- Root cause: PATTERN_LIBRARY in question-filter.service.ts has hardcoded regex patterns that are too narrow
- Evidence: 
  - "What's your name?" doesn't match pattern (needs "what (is your|'s your) name" variation)
  - "Are you serious?" doesn't match any pattern
  - "Alright" not in trivial acknowledgments list
  - Pattern for trivial words requires exact prefix match, missing common variations
- Files affected: app/src/services/question-filter.service.ts (lines 14-29)
- Fix required: Expand PATTERN_LIBRARY with missing meta-question variations and acknowledgments

**Issue #2: LLM fallback endpoint failure (Severity: MAJOR)**
- Root cause: LLM endpoint error "Unexpected endpoint or method (POST /api/embeddings)" prevents fallback classification
- Evidence: User reported persistent error in console; LLM fallback in evaluateQuestion() line 114-120 will catch error and default to "not off-topic"
- Files affected: question-filter.service.ts line 69-85 (isOffTopicByLLM graceful degradation)
- Impact: All medium-confidence pattern matches (0 < confidence < 0.75) that should be classified by LLM are incorrectly assumed valid
- Fix required: Investigate LLM provider configuration or use pattern-only mode temporarily

**Issue #3: Pattern matching too strict (Severity: MINOR)**
- Root cause: Some patterns use exact match anchors (^...$) or strict prefix matching
- Evidence: "ok" should flag but doesn't, likely due to formatting in user input
- Files affected: question-filter.service.ts line 28 (trivial acknowledgments pattern)
- Fix required: Review pattern flexibility, consider case-insensitive word boundary matching
