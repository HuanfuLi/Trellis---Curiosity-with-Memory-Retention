/** Maps a platform MIME type to a { ext, mime } pair that Whisper accepts. */
function whisperFormat(mimeType: string): { ext: string; mime: string } {
  if (mimeType.includes('aac') || mimeType.includes('m4a') || mimeType.includes('mp4'))
    return { ext: 'm4a', mime: 'audio/mp4' };
  if (mimeType.includes('ogg')) return { ext: 'ogg', mime: 'audio/ogg' };
  if (mimeType.includes('wav')) return { ext: 'wav', mime: 'audio/wav' };
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return { ext: 'mp3', mime: 'audio/mpeg' };
  return { ext: 'webm', mime: 'audio/webm' };
}

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

  const { ext, mime } = whisperFormat(audioBlob.type);
  // Re-wrap with a Whisper-accepted MIME type — Android returns 'audio/aac' for
  // what is actually an M4A (MP4 container) file, which Whisper rejects as-is.
  const uploadBlob = audioBlob.type === mime ? audioBlob : new Blob([audioBlob], { type: mime });

  const formData = new FormData();
  formData.append('file', uploadBlob, `recording.${ext}`);
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
    const msg = `Whisper ${res.status}: ${body || res.statusText}`;
    console.error('[STT]', msg);
    throw new Error(msg);
  }

  const data = (await res.json()) as { text: string };
  return data.text.trim();
}
