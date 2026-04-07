import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('post-essay.service', () => {
  // POST-01: batch generation prompt does not request bodyMarkdown
  it('batch generation prompt excludes bodyMarkdown', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/concept-feed.service.ts', import.meta.url), 'utf-8');
    assert.ok(source.includes('Do NOT include bodyMarkdown'), 'concept-feed.service.ts should instruct LLM to skip bodyMarkdown');
  });

  // POST-04: patchPostEssayInCache function exists and handles all caches
  it('post-essay.service.ts exports patchPostEssayInCache', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/post-essay.service.ts', import.meta.url), 'utf-8');
    assert.ok(source.includes('patchPostEssayInCache'), 'post-essay.service.ts should export patchPostEssayInCache');
    assert.ok(source.includes('echolearn_daily_posts'), 'should patch main cache');
    assert.ok(source.includes('echolearn_video_cache'), 'should patch video cache');
    assert.ok(source.includes('echolearn_news_posts'), 'should patch news cache');
    assert.ok(source.includes('echolearn_short_posts'), 'should patch shorts cache');
  });

  // POST-02: PostDetailScreen imports and calls generatePostEssay from post-essay.service
  it('PostDetailScreen imports generatePostEssay from post-essay.service', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf-8');
    assert.ok(
      source.includes("from '../services/post-essay.service'"),
      'PostDetailScreen.tsx should import from post-essay.service',
    );
    assert.ok(
      source.includes('generatePostEssay'),
      'PostDetailScreen.tsx should reference generatePostEssay',
    );
    assert.ok(
      source.includes('patchPostEssayInCache'),
      'PostDetailScreen.tsx should call patchPostEssayInCache to cache the essay',
    );
  });

  // POST-02: PostDetailScreen has on-enter streaming state and effect
  it('PostDetailScreen wires on-enter streaming state for empty bodyMarkdown posts', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/screens/PostDetailScreen.tsx', import.meta.url), 'utf-8');
    assert.ok(
      source.includes('isStreamingOnEnter'),
      'PostDetailScreen.tsx should have isStreamingOnEnter state',
    );
    assert.ok(
      source.includes('streamingBody'),
      'PostDetailScreen.tsx should have streamingBody state for progressive rendering',
    );
    assert.ok(
      source.includes('onEnterError'),
      'PostDetailScreen.tsx should have onEnterError state for error handling',
    );
    assert.ok(
      source.includes("post.bodyMarkdown && post.bodyMarkdown.trim() !== ''") ||
      source.includes("post.bodyMarkdown.trim() !== ''"),
      'PostDetailScreen.tsx should check post.bodyMarkdown to decide whether to trigger on-enter generation',
    );
  });

  // POST-05: youtube.service._fetchNewVideoPosts defers LLM summary but keeps fetchTranscript
  it('youtube.service _fetchNewVideoPosts defers summarizeTranscript and keeps fetchTranscript', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/youtube.service.ts', import.meta.url), 'utf-8');

    // Find the _fetchNewVideoPosts function body
    const fnStart = source.indexOf('async _fetchNewVideoPosts(');
    assert.ok(fnStart !== -1, 'youtube.service.ts should contain _fetchNewVideoPosts');

    // Extract function body: from fn start to next top-level method (closing brace of method)
    // Heuristic: find the section of source from the function start
    const fnBody = source.slice(fnStart, fnStart + 3000);

    // Must call fetchTranscript inside _fetchNewVideoPosts
    assert.ok(
      fnBody.includes('fetchTranscript'),
      '_fetchNewVideoPosts should still call fetchTranscript (transcript needed for on-enter generation)',
    );

    // Must NOT call summarizeTranscript inside _fetchNewVideoPosts
    assert.ok(
      !fnBody.includes('summarizeTranscript'),
      '_fetchNewVideoPosts should NOT call summarizeTranscript (deferred to on-enter generation)',
    );

    // bodyMarkdown must be set to empty string in _fetchNewVideoPosts
    assert.ok(
      fnBody.includes("bodyMarkdown = ''") || fnBody.includes('bodyMarkdown: \'\''),
      '_fetchNewVideoPosts should set bodyMarkdown to empty string (deferred generation marker)',
    );
  });

  // POST-06: news.service generateNewsPosts does NOT call chatCompletion
  it('news.service generateNewsPosts does not call chatCompletion (deferred to on-enter)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('../../src/services/news.service.ts', import.meta.url), 'utf-8');

    // chatCompletion should not be imported or used anywhere in news.service.ts
    assert.ok(
      !source.includes('chatCompletion'),
      'news.service.ts should not import or call chatCompletion (LLM summary deferred to on-enter)',
    );

    // bodyMarkdown must be set to empty string in generateNewsPosts
    const fnStart = source.indexOf('async function generateNewsPosts(');
    assert.ok(fnStart !== -1, 'news.service.ts should contain generateNewsPosts');
    const fnBody = source.slice(fnStart, fnStart + 4000);
    assert.ok(
      fnBody.includes("bodyMarkdown: ''") || fnBody.includes("bodyMarkdown: \"\""),
      'generateNewsPosts should set bodyMarkdown to empty string (deferred generation marker)',
    );
  });
});
