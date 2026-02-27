import type { TTSConfig } from '../../types';

export async function synthesize(text: string, config: TTSConfig): Promise<string> {
  const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com';
  const response = await fetch(`${baseUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: config.voice,
      speed: config.speed,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS API error ${response.status}: ${err}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function testTTSConnection(
  config: TTSConfig,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const blobUrl = await synthesize('Hello.', config);
    URL.revokeObjectURL(blobUrl);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
