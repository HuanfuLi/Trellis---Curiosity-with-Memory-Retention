/**
 * Unit tests for image generation pipeline.
 *
 * Tests are deliberately isolated — they don't import DOM APIs or Vite-bundled
 * modules. The services are tested through simple inline mocks.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock provider that always succeeds.
 */
function makeSuccessProvider(name = 'mock') {
  return {
    name,
    isConfigured: () => true,
    async generate(prompt, style) {
      return {
        success: true,
        data: {
          id: `img-${Math.random().toString(16).slice(2)}`,
          prompt,
          style,
          imageBase64: `data:image/svg+xml;base64,PHN2Zy8+`, // minimal SVG
          provider: 'mock',
          generatedAt: Date.now(),
        },
      };
    },
  };
}

/**
 * Build a mock provider that always fails.
 */
function makeFailProvider(name = 'fail') {
  return {
    name,
    isConfigured: () => true,
    async generate() {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Simulated failure', retryable: true },
      };
    },
  };
}

// ─── PostFormattingService tests ──────────────────────────────────────────────

function inferImageStyle(post, index) {
  const ROTATION = ['infograph', 'illustration', 'photo'];
  if (post.sourceType === 'connection') return 'illustration';
  if (post.sourceType === 'starter') return 'infograph';
  return ROTATION[index % ROTATION.length];
}

function buildImagePrompt(post) {
  const emoji = /\b(brain|memory|neuroscience|cognitive|psychology)\b/i.test(
    [...(post.keywords ?? []), post.title ?? ''].join(' ')
  )
    ? '🧠'
    : '💡';
  const headline = (post.teaser?.hook || post.title || '').slice(0, 58);
  const caption = (post.teaser?.preview || post.takeaway || post.whyCare || '').slice(0, 96);
  const chips = (post.keywords ?? []).slice(0, 3).join(' | ');
  return [
    'Create a mobile discovery-feed cover image for an educational post.',
    `EMOJI: ${emoji}`,
    `HEADLINE: ${headline}`,
    `CAPTION: ${caption}`,
    `CHIPS: ${chips}`,
    `ROW_1: Topic | ${(post.sourceQuestionTitles?.[0] || post.title || '').slice(0, 28)}`,
    `ROW_2: Angle | ${(post.quickAskPrompts?.[0] || post.takeaway || post.whyCare || '').replace(/\?+$/, '').slice(0, 34)}`,
    `ROW_3: Signals | ${(post.keywords ?? []).slice(0, 3).join(' • ').slice(0, 30)}`,
  ].join('\n');
}

const makePost = (overrides = {}) => ({
  id: 'post-1',
  title: 'How memory works',
  teaser: { hook: 'Why does the brain forget things?', preview: 'Memory is selective...' },
  keywords: ['memory', 'brain', 'neuroscience'],
  sourceType: 'recent',
  contextLabel: 'Learning',
  narrativeMode: 'example-first',
  takeaway: 'Retrieval and repetition make memory durable.',
  whyCare: 'This explains why some ideas stick and others disappear.',
  quickAskPrompts: ['What makes a memory retrievable?'],
  sourceQuestionTitles: ['How memory works'],
  ...overrides,
});

// ─── Tests: PostFormattingService ─────────────────────────────────────────────

test('inferImageStyle rotates styles across feed indices', () => {
  const post = makePost();
  const style0 = inferImageStyle(post, 0);
  const style1 = inferImageStyle(post, 1);
  const style2 = inferImageStyle(post, 2);
  const style3 = inferImageStyle(post, 3);

  assert.notEqual(style0, style1);
  assert.notEqual(style1, style2);
  assert.equal(style0, style3); // rotation repeats at index 3
});

test('inferImageStyle forces illustration for connection posts', () => {
  const post = makePost({ sourceType: 'connection' });
  assert.equal(inferImageStyle(post, 0), 'illustration');
  assert.equal(inferImageStyle(post, 1), 'illustration');
});

test('inferImageStyle forces infograph for starter posts', () => {
  const post = makePost({ sourceType: 'starter' });
  assert.equal(inferImageStyle(post, 0), 'infograph');
  assert.equal(inferImageStyle(post, 1), 'infograph');
});

test('buildImagePrompt creates structured hook-card instructions', () => {
  const longTitle = 'A very long title that goes on and on and on and will still be converted into a structured image prompt';
  const post = makePost({ title: longTitle, keywords: ['a', 'b', 'c'] });
  const prompt = buildImagePrompt(post);
  assert.match(prompt, /EMOJI:/);
  assert.match(prompt, /HEADLINE:/);
  assert.match(prompt, /ROW_1:/);
  assert.match(prompt, /ROW_3:/);
  assert.match(prompt, /CHIPS:/);
});

// ─── Tests: Provider mock interface ───────────────────────────────────────────

test('success provider returns image data', async () => {
  const provider = makeSuccessProvider('test-provider');
  const result = await provider.generate('test prompt', 'infograph', {});
  assert.equal(result.success, true);
  assert.ok(result.data?.id);
  assert.equal(result.data?.style, 'infograph');
  assert.equal(result.data?.prompt, 'test prompt');
});

test('fail provider returns error result', async () => {
  const provider = makeFailProvider();
  const result = await provider.generate('test', 'photo', {});
  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'NETWORK_ERROR');
  assert.equal(result.error?.retryable, true);
});

// ─── Tests: ImageGenerationService fallback logic ─────────────────────────────

// Inline a minimal ImageGenerationService to test the core fallback logic
// without DOM/localStorage dependencies.
class TestImageGenerationService {
  providers = [];

  setProviders(providers) {
    this.providers = providers;
  }

  async generateImage(postId, prompt, style) {
    for (const provider of this.providers) {
      const result = await provider.generate(prompt, style, {});
      if (result.success && result.data) {
        return { success: true, data: { ...result.data, postId } };
      }
    }
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: 'All providers failed', retryable: true },
    };
  }
}

test('generateImage succeeds with first provider', async () => {
  const svc = new TestImageGenerationService();
  svc.setProviders([makeSuccessProvider('primary'), makeFailProvider('fallback')]);

  const result = await svc.generateImage('post-1', 'test prompt', 'photo');
  assert.equal(result.success, true);
  assert.equal(result.data?.postId, 'post-1');
  assert.equal(result.data?.provider, 'mock');
});

test('generateImage falls back to second provider when first fails', async () => {
  const svc = new TestImageGenerationService();
  svc.setProviders([makeFailProvider('primary'), makeSuccessProvider('fallback')]);

  const result = await svc.generateImage('post-2', 'test prompt', 'illustration');
  assert.equal(result.success, true);
  assert.equal(result.data?.postId, 'post-2');
});

test('generateImage fails when all providers fail', async () => {
  const svc = new TestImageGenerationService();
  svc.setProviders([makeFailProvider('primary'), makeFailProvider('fallback')]);

  const result = await svc.generateImage('post-3', 'test prompt', 'infograph');
  assert.equal(result.success, false);
  assert.ok(result.error?.message);
});

test('generateImage with no providers returns error', async () => {
  const svc = new TestImageGenerationService();
  svc.setProviders([]);

  const result = await svc.generateImage('post-4', 'test prompt', 'photo');
  assert.equal(result.success, false);
});
