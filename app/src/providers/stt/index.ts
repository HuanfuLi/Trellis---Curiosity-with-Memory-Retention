function timeoutSignal(ms: number): AbortSignal {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(new DOMException(`Request timed out after ${ms / 1000}s`, 'TimeoutError')), ms);
  ac.signal.addEventListener('abort', () => clearTimeout(id), { once: true });
  return ac.signal;
}

/**
 * Transcribe audio using OpenAI Whisper (/v1/audio/transcriptions).
 * Uses the TTS API key/base URL — both STT and TTS share the same OpenAI credentials.
 */
export async function transcribeAudio(audioBlob: Blob, config: { apiKey?: string; baseUrl?: string }): Promise<string> {
  if (!config.apiKey) throw new Error('No API key configured. Add your OpenAI key in Text-to-Speech & Speech Recognition settings.');

  const baseUrl = (config.baseUrl?.replace(/\/$/, '')) || 'https://api.openai.com';

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'json');

  const res = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: formData,
    signal: timeoutSignal(60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Whisper ${res.status}: ${body || res.statusText}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text.trim();
}
