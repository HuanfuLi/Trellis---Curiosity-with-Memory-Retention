import assert from 'node:assert/strict';
import test from 'node:test';

test('shouldPauseVideo: off-screen and document visible → pause', async () => {
  const { shouldPauseVideo } = await import('../../src/state/useVideoPauseGuard.ts');
  assert.equal(shouldPauseVideo(0, false), 'pause');
});

test('shouldPauseVideo: on-screen but document hidden → pause', async () => {
  const { shouldPauseVideo } = await import('../../src/state/useVideoPauseGuard.ts');
  assert.equal(shouldPauseVideo(1, true), 'pause');
});

test('shouldPauseVideo: on-screen and document visible → play', async () => {
  const { shouldPauseVideo } = await import('../../src/state/useVideoPauseGuard.ts');
  assert.equal(shouldPauseVideo(0.5, false), 'play');
});

test('shouldPauseVideo: off-screen and document hidden → pause (both true)', async () => {
  const { shouldPauseVideo } = await import('../../src/state/useVideoPauseGuard.ts');
  assert.equal(shouldPauseVideo(0, true), 'pause');
});
