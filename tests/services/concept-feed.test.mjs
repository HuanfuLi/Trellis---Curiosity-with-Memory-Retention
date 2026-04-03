/**
 * concept-feed.service.ts — Interleaving Unit Tests
 *
 * Phase 17, Plan 00 — Tests for D-04 (video posts interleaved in feed)
 * Tests run via: node --test tests/services/concept-feed.test.mjs
 *
 * The interleave function will be internal to concept-feed.service.ts (a
 * browser module). We test the algorithm directly here as a pure function.
 * Plan 02 must implement the identical logic in concept-feed.service.ts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Expected implementation (mirrored from Plan 02 spec) ────────────────────

/**
 * Interleaves video posts into the AI post feed.
 * Strategy: insert one video post after every 2nd AI post.
 * Any remaining video posts are appended at the end.
 *
 * D-04: Video posts mix into the existing feed alongside AI-generated posts.
 */
function interleaveVideoPosts(aiPosts, videoPosts) {
  if (videoPosts.length === 0) return aiPosts;
  const result = [];
  let vIdx = 0;
  for (let i = 0; i < aiPosts.length; i++) {
    result.push(aiPosts[i]);
    if ((i + 1) % 2 === 0 && vIdx < videoPosts.length) {
      result.push(videoPosts[vIdx++]);
    }
  }
  while (vIdx < videoPosts.length) result.push(videoPosts[vIdx++]);
  return result;
}

// ─── Mock post factories ──────────────────────────────────────────────────────

function makePost(id, sourceType = 'recent') {
  return { id, sourceType, title: `Post ${id}` };
}

function makeVideoPost(id) {
  return {
    id: `video-${id}`,
    sourceType: 'video',
    title: `Video ${id}`,
    videoMeta: { videoId: `yt-${id}` },
  };
}

// ─── Test group: interleaveVideoPosts (D-04) ─────────────────────────────────

describe('interleaveVideoPosts', () => {
  it('returns only AI posts when no video posts', () => {
    const aiPosts = [makePost('a1'), makePost('a2'), makePost('a3'), makePost('a4')];
    const result = interleaveVideoPosts(aiPosts, []);
    assert.deepEqual(result, aiPosts);
    assert.equal(result.length, 4);
  });

  it('inserts video post after every 2nd AI post', () => {
    // 6 AI posts + 3 video posts → video at positions after i=1 (idx2), i=3 (idx5), i=5 (idx8)
    // Result indices: A0, A1, V0, A2, A3, V1, A4, A5, V2
    const aiPosts = [
      makePost('a1'), makePost('a2'), makePost('a3'),
      makePost('a4'), makePost('a5'), makePost('a6'),
    ];
    const videoPosts = [makeVideoPost('v1'), makeVideoPost('v2'), makeVideoPost('v3')];
    const result = interleaveVideoPosts(aiPosts, videoPosts);

    assert.equal(result.length, 9, 'should have 6 AI + 3 video = 9 total');
    assert.equal(result[0].id, 'a1');
    assert.equal(result[1].id, 'a2');
    assert.equal(result[2].id, 'video-v1', 'video post after 2nd AI post (index 2)');
    assert.equal(result[3].id, 'a3');
    assert.equal(result[4].id, 'a4');
    assert.equal(result[5].id, 'video-v2', 'video post after 4th AI post (index 5)');
    assert.equal(result[6].id, 'a5');
    assert.equal(result[7].id, 'a6');
    assert.equal(result[8].id, 'video-v3', 'video post after 6th AI post (index 8)');
  });

  it('appends remaining video posts at end', () => {
    // 2 AI posts + 5 video posts → 1 video interleaved after i=1, then 4 appended
    // Result: A0, A1, V0, V1, V2, V3, V4
    const aiPosts = [makePost('a1'), makePost('a2')];
    const videoPosts = [
      makeVideoPost('v1'), makeVideoPost('v2'), makeVideoPost('v3'),
      makeVideoPost('v4'), makeVideoPost('v5'),
    ];
    const result = interleaveVideoPosts(aiPosts, videoPosts);

    assert.equal(result.length, 7, 'should have 2 AI + 5 video = 7 total');
    assert.equal(result[0].id, 'a1');
    assert.equal(result[1].id, 'a2');
    assert.equal(result[2].id, 'video-v1', '1 video interleaved after 2nd AI post');
    assert.equal(result[3].id, 'video-v2', 'remaining videos appended');
    assert.equal(result[4].id, 'video-v3', 'remaining videos appended');
    assert.equal(result[5].id, 'video-v4', 'remaining videos appended');
    assert.equal(result[6].id, 'video-v5', 'remaining videos appended');
  });

  it('handles empty AI posts array', () => {
    const videoPosts = [makeVideoPost('v1'), makeVideoPost('v2'), makeVideoPost('v3')];
    const result = interleaveVideoPosts([], videoPosts);
    // With 0 AI posts: loop doesn't execute, all videos appended
    assert.equal(result.length, 3, 'should return all video posts when AI posts is empty');
    assert.equal(result[0].id, 'video-v1');
    assert.equal(result[1].id, 'video-v2');
    assert.equal(result[2].id, 'video-v3');
  });

  it('handles single AI post', () => {
    // 1 AI post + 2 video posts → A0 (no even trigger at i=0), then V0, V1 appended
    const aiPosts = [makePost('a1')];
    const videoPosts = [makeVideoPost('v1'), makeVideoPost('v2')];
    const result = interleaveVideoPosts(aiPosts, videoPosts);

    assert.equal(result.length, 3, 'should have 1 AI + 2 video = 3 total');
    assert.equal(result[0].id, 'a1', 'AI post comes first');
    assert.equal(result[1].id, 'video-v1', 'video posts appended after single AI post');
    assert.equal(result[2].id, 'video-v2');
  });

  it('preserves post order within each group', () => {
    const aiPosts = [
      makePost('a1'), makePost('a2'), makePost('a3'),
      makePost('a4'), makePost('a5'), makePost('a6'),
    ];
    const videoPosts = [makeVideoPost('v1'), makeVideoPost('v2')];
    const result = interleaveVideoPosts(aiPosts, videoPosts);

    // Extract AI posts from result — should maintain original order
    const aiInResult = result.filter(p => p.sourceType !== 'video');
    assert.deepEqual(aiInResult.map(p => p.id), ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      'AI posts must maintain original order');

    // Extract video posts from result — should maintain original order
    const videoInResult = result.filter(p => p.sourceType === 'video');
    assert.deepEqual(videoInResult.map(p => p.id), ['video-v1', 'video-v2'],
      'Video posts must maintain original order');
  });

  it('handles equal numbers of AI and video posts (3+3)', () => {
    const aiPosts = [makePost('a1'), makePost('a2'), makePost('a3')];
    const videoPosts = [makeVideoPost('v1'), makeVideoPost('v2'), makeVideoPost('v3')];
    const result = interleaveVideoPosts(aiPosts, videoPosts);

    // Pattern: A0, A1, V0, A2, V1, V2 (V1 interleaved after i=2 which is 4th AI... wait)
    // i=0: push a1
    // i=1: push a2, (i+1)=2 is even → push V0; vIdx=1
    // i=2: push a3, (i+1)=3 not even → skip
    // Loop ends. vIdx=1 < 3, append V1, V2
    // Result: A1, A2, V0, A3, V1, V2
    assert.equal(result.length, 6);
    assert.equal(result[0].id, 'a1');
    assert.equal(result[1].id, 'a2');
    assert.equal(result[2].id, 'video-v1');
    assert.equal(result[3].id, 'a3');
    assert.equal(result[4].id, 'video-v2');
    assert.equal(result[5].id, 'video-v3');
  });

  // Integration contract — validates that concept-feed.service.ts uses this function
  it('concept-feed.service.ts uses interleaveVideoPosts for getDailyPosts', { todo: 'Awaiting Plan 02 implementation — getDailyPosts() must call interleaveVideoPosts(aiPosts, videoPosts)' });
});
