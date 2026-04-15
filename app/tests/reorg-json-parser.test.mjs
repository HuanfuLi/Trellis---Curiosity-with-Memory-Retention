import assert from 'node:assert/strict';
import test from 'node:test';
import { repairJson } from '../src/services/canonical-knowledge.service.ts';

test('repairJson: valid JSON passes through unchanged', () => {
  const input = '{"a":1,"b":[1,2,3]}';
  const out = repairJson(input);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out), { a: 1, b: [1, 2, 3] });
});

test('repairJson: strips markdown json fences', () => {
  const input = '```json\n{"hello":"world"}\n```';
  const out = repairJson(input);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out), { hello: 'world' });
});

test('repairJson: strips bare markdown fences', () => {
  const input = '```\n{"x":42}\n```';
  const out = repairJson(input);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out), { x: 42 });
});

test('repairJson: strips leading preamble before first {', () => {
  const input = 'Here is the JSON you requested:\n{"ok":true}';
  const out = repairJson(input);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out), { ok: true });
});

test('repairJson: removes trailing commas before }', () => {
  const input = '{"a":1,"b":2,}';
  const out = repairJson(input);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out), { a: 1, b: 2 });
});

test('repairJson: removes trailing commas before ]', () => {
  const input = '{"arr":[1,2,3,]}';
  const out = repairJson(input);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out), { arr: [1, 2, 3] });
});

test('repairJson: closes truncated object (missing closing brace)', () => {
  const input = '{"a":1,"b":2';
  const out = repairJson(input);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out), { a: 1, b: 2 });
});

test('repairJson: closes truncated nested array and object', () => {
  const input = '{"outer":{"inner":[1,2,3';
  const out = repairJson(input);
  assert.ok(out);
  assert.deepEqual(JSON.parse(out), { outer: { inner: [1, 2, 3] } });
});

test('repairJson: truncation mid-string cuts back to safe point', () => {
  // Response cut off inside a string literal — repair should drop the partial
  // string and close remaining containers.
  const input = '{"a":1,"b":"unclosed string valu';
  const out = repairJson(input);
  assert.ok(out);
  const parsed = JSON.parse(out);
  assert.equal(parsed.a, 1);
  // The "b" field should be gone or recovered — either way, parse must succeed
  assert.ok(typeof parsed === 'object');
});

test('repairJson: returns null when no { is found', () => {
  assert.equal(repairJson('no json here'), null);
  assert.equal(repairJson(''), null);
});

test('repairJson: real-world LLM output with fence + trailing comma + preamble', () => {
  const input = 'Sure, here is the hierarchy:\n```json\n{\n  "hierarchy": [\n    {"rootLabel": "Knowledge", "branches": []},\n  ]\n}\n```';
  const out = repairJson(input);
  assert.ok(out);
  const parsed = JSON.parse(out);
  assert.ok(Array.isArray(parsed.hierarchy));
});
