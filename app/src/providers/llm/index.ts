import type { LLMConfig } from '../../types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── Routing ──────────────────────────────────────────────────────────────────

export async function chatCompletion(messages: ChatMessage[], config: LLMConfig): Promise<string> {
  switch (config.provider) {
    case 'claude':   return claudeCompletion(messages, config);
    case 'gemini':   return geminiCompletion(messages, config);
    default:         return openAICompletion(messages, config); // openai | local | lmstudio
  }
}

export async function* chatStream(messages: ChatMessage[], config: LLMConfig): AsyncGenerator<string> {
  switch (config.provider) {
    case 'claude':  yield* claudeStream(messages, config);  break;
    case 'gemini':  yield* geminiStream(messages, config);  break;
    default:        yield* openAIStream(messages, config);  break; // openai | local | lmstudio
  }
}

// ─── OpenAI / Local / LM Studio (OpenAI-compatible) ─────────────────────────

function openAIBaseUrl(config: LLMConfig): string {
  if (config.baseUrl) return config.baseUrl.replace(/\/$/, '');
  if (config.provider === 'lmstudio') return 'http://localhost:1234';
  return 'https://api.openai.com';
}

async function openAICompletion(messages: ChatMessage[], config: LLMConfig): Promise<string> {
  const response = await fetch(`${openAIBaseUrl(config)}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey ?? 'none'}`,
    },
    body: JSON.stringify({ model: config.model, messages }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${config.provider} API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

async function* openAIStream(messages: ChatMessage[], config: LLMConfig): AsyncGenerator<string> {
  const response = await fetch(`${openAIBaseUrl(config)}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey ?? 'none'}`,
    },
    body: JSON.stringify({ model: config.model, messages, stream: true }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${config.provider} API error ${response.status}: ${err}`);
  }
  yield* parseSseStream(response, (p) => p.choices?.[0]?.delta?.content ?? '');
}

// ─── Claude ──────────────────────────────────────────────────────────────────

async function claudeCompletion(messages: ChatMessage[], config: LLMConfig): Promise<string> {
  const system = messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: config.model, max_tokens: 4096, system, messages: userMessages }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.content[0].text;
}

async function* claudeStream(messages: ChatMessage[], config: LLMConfig): AsyncGenerator<string> {
  const system = messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      stream: true,
      system,
      messages: userMessages,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }
  yield* parseSseStream(
    response,
    (p) =>
      p.type === 'content_block_delta' && p.delta?.type === 'text_delta' ? p.delta.text : '',
  );
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Convert OpenAI-style messages to Gemini contents + systemInstruction. */
function toGeminiPayload(messages: ChatMessage[]) {
  const system = messages.find((m) => m.role === 'system')?.content;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  return {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: { maxOutputTokens: 4096 },
  };
}

async function geminiCompletion(messages: ChatMessage[], config: LLMConfig): Promise<string> {
  const url = `${GEMINI_BASE}/models/${config.model}:generateContent?key=${config.apiKey ?? ''}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toGeminiPayload(messages)),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function* geminiStream(messages: ChatMessage[], config: LLMConfig): AsyncGenerator<string> {
  const url = `${GEMINI_BASE}/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey ?? ''}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toGeminiPayload(messages)),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }
  yield* parseSseStream(
    response,
    (p) => p.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
  );
}

// ─── Shared SSE parser ────────────────────────────────────────────────────────

async function* parseSseStream(
  response: Response,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extract: (parsed: any) => string,
): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = JSON.parse(data) as any;
        const text = extract(parsed);
        if (text) yield text;
      } catch {
        // ignore malformed SSE line
      }
    }
  }
}

// ─── Test connection ──────────────────────────────────────────────────────────

export async function testLLMConnection(
  config: LLMConfig,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await chatCompletion([{ role: 'user', content: 'Say "ok".' }], config);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
