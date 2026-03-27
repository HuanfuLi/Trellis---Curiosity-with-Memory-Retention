/**
 * GeminiProvider
 *
 * Fallback image generation provider using the Google Gemini Flash API.
 *
 * Requires API key in Settings. If key not configured or API fails,
 * returns a structured error — callers decide how to handle it.
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent
 * Auth: API key as query param (?key=...)
 *
 * Notes:
 * - responseModalities MUST include both "TEXT" and "IMAGE" — "IMAGE" alone is rejected.
 * - The Imagen API (/models/imagen-*:predict) uses a completely different request schema
 *   and is NOT used here.
 */

import type { ServiceResult, GeneratedImage, ImageStyle } from '../types';
import type { IImageProvider, ImageProviderOptions } from './imageProvider.interface';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';

export class GeminiProvider implements IImageProvider {
  readonly name = 'Gemini';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string = '', model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async generate(
    prompt: string,
    style: ImageStyle,
    options: ImageProviderOptions,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: {
          code: 'API_KEY_NOT_CONFIGURED',
          message: 'Gemini API key not configured. Add it in Settings → Image Generation.',
          retryable: false,
        },
      };
    }
    return this._callWithRetry(prompt, style, options);
  }

  private async _callWithRetry(
    prompt: string,
    style: ImageStyle,
    options: ImageProviderOptions,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    let attempt = 0;
    let backoffMs = 1000;
    let lastResult: ServiceResult<Omit<GeneratedImage, 'postId'>> | null = null;

    while (attempt < options.maxRetries) {
      attempt++;
      try {
        const result = await this._callApi(prompt, style, options.timeoutMs);
        if (result.success) return result;
        lastResult = result;
        if (result.error?.code === 'API_RATE_LIMITED') {
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, 8000);
          continue;
        }
        if (!result.error?.retryable) return result;
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 8000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastResult = { success: false, error: { code: 'NETWORK_ERROR', message: msg, retryable: true } };
        if (attempt >= options.maxRetries) return lastResult;
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 8000);
      }
    }

    return lastResult ?? {
      success: false,
      error: { code: 'RETRIES_EXHAUSTED', message: 'Gemini image generation failed after all retries.', retryable: true },
    };
  }

  private async _callApi(
    prompt: string,
    style: ImageStyle,
    timeoutMs: number,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const styleHint =
      style === 'infograph'
        ? 'infographic style, clean data visualization, bold typography'
        : style === 'illustration'
          ? 'digital illustration, vibrant colors, artistic'
          : 'photorealistic, cinematic lighting, high quality';
    const fullPrompt = `${prompt}. Visual style: ${styleHint}`;

    const endpoint = `${BASE_URL}/${this.model}:generateContent`;

    try {
      const response = await fetch(`${endpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: fullPrompt }],
            },
          ],
          generationConfig: {
            // TEXT must be included alongside IMAGE — the API rejects IMAGE alone.
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 429) {
        return {
          success: false,
          error: { code: 'API_RATE_LIMITED', message: 'Gemini rate limit exceeded', retryable: true },
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          error: { code: 'API_KEY_INVALID', message: 'Invalid Gemini API key', retryable: false },
        };
      }
      if (response.status === 404) {
        return {
          success: false,
          error: { code: 'INVALID_REQUEST', message: `Gemini model not found: "${this.model}". Check the model name in Settings → Image Generation.`, retryable: false },
        };
      }
      if (response.status === 400) {
        // Bad request — surface the API's own error message rather than misreporting as auth failure.
        let detail = 'Bad request';
        try {
          const errBody = (await response.json()) as { error?: { message?: string } };
          detail = errBody.error?.message ?? detail;
        } catch { /* ignore parse errors */ }
        return {
          success: false,
          error: { code: 'INVALID_REQUEST', message: `Gemini API rejected the request: ${detail}`, retryable: false },
        };
      }
      if (!response.ok) {
        return {
          success: false,
          error: { code: 'NETWORK_ERROR', message: `HTTP ${response.status}`, retryable: true },
        };
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: {
                mimeType?: string;
                data?: string;
              };
            }>;
          };
        }>;
      };

      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part?.inlineData?.data) {
        return {
          success: false,
          error: { code: 'UNKNOWN_ERROR', message: 'No image data in response', retryable: false },
        };
      }

      const mime = part.inlineData.mimeType ?? 'image/png';
      return {
        success: true,
        data: {
          id: crypto.randomUUID(),
          prompt,
          style,
          imageBase64: `data:${mime};base64,${part.inlineData.data}`,
          provider: 'gemini',
          generatedAt: Date.now(),
        },
      };
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: isTimeout ? 'Request timed out' : (err instanceof Error ? err.message : String(err)),
          retryable: true,
        },
      };
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const geminiProvider = new GeminiProvider();
