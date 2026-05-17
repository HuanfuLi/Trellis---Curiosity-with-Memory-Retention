import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const graphScreenPath = path.resolve(__dirname, '../../src/screens/GraphScreen.tsx');
const source = readFileSync(graphScreenPath, 'utf8');

test('MindElixir container keeps Android drag layer hints scoped locally', () => {
  assert.match(source, /data-no-swipe-nav="true"/);

  const containerIndex = source.indexOf('ref={containerRef}', source.indexOf('data-no-swipe-nav="true"') - 200);
  assert.notEqual(containerIndex, -1, 'GraphScreen must render the MindElixir container ref');

  const containerRegion = source.slice(containerIndex, containerIndex + 500);
  assert.match(containerRegion, /touchAction:\s*'none'/);
  assert.match(containerRegion, /willChange:\s*'transform'/);
  assert.match(containerRegion, /transform:\s*'translateZ\(0\)'/);
});

test('GraphScreen Header ancestors are not layer-promoted', () => {
  const headerIndex = source.indexOf("title={t('graph.headerTitle')}");
  assert.notEqual(headerIndex, -1, 'GraphScreen Header must remain present');

  const rootStart = source.lastIndexOf('<div ref={containerRef}', headerIndex);
  assert.notEqual(rootStart, -1, 'GraphScreen root container must remain detectable');

  const rootThroughHeader = source.slice(rootStart, headerIndex);
  assert.doesNotMatch(rootThroughHeader, /willChange:\s*'transform'/);
  assert.doesNotMatch(rootThroughHeader, /transform:\s*'translateZ\(0\)'/);
});
