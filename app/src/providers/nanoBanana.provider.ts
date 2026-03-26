/**
 * NanoBananaProvider
 *
 * Primary image generation provider.
 *
 * NOTE: Nano Banana is not a real public API. This provider is structured
 * so that it can accept a real API key and make real HTTP requests when
 * (if) the service becomes available. Until then it falls back to
 * deterministic mock images so that the UI can be developed and tested
 * without API access.
 *
 * Endpoint (placeholder): https://api.nanobanana.ai/v1/generate
 * Auth: Bearer token in Authorization header.
 * Rate limiting: 429 responses are handled gracefully (retryable error).
 */

import type { ServiceResult, GeneratedImage, ImageStyle } from '../types';
import type { IImageProvider, ImageProviderOptions } from './imageProvider.interface';

// ─── Mock image palette ───────────────────────────────────────────────────────

const MOCK_GRADIENTS: Record<ImageStyle, string[]> = {
  infograph: [
    'linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 50%, #4fc3f7 100%)',
    'linear-gradient(135deg, #1a237e 0%, #3949ab 50%, #7986cb 100%)',
    'linear-gradient(135deg, #004d40 0%, #00796b 50%, #4db6ac 100%)',
  ],
  illustration: [
    'linear-gradient(135deg, #4a148c 0%, #7b1fa2 50%, #ce93d8 100%)',
    'linear-gradient(135deg, #e65100 0%, #f57c00 50%, #ffcc02 100%)',
    'linear-gradient(135deg, #880e4f 0%, #c2185b 50%, #f48fb1 100%)',
  ],
  photo: [
    'linear-gradient(135deg, #263238 0%, #546e7a 50%, #b0bec5 100%)',
    'linear-gradient(135deg, #33691e 0%, #558b2f 50%, #aed581 100%)',
    'linear-gradient(135deg, #bf360c 0%, #e64a19 50%, #ffab91 100%)',
  ],
};

function deterministicIndex(seed: string, length: number): number {
  let h = 0;
  for (const ch of seed) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return ((h % length) + length) % length;
}

function buildMockSvg(prompt: string, style: ImageStyle): string {
  const gradients = MOCK_GRADIENTS[style];
  const gradient = gradients[deterministicIndex(prompt, gradients.length)];
  void gradient; // referenced for future real implementation
  const icon = style === 'infograph' ? '[chart]' : style === 'illustration' ? '[art]' : '[photo]';
  const label = prompt.slice(0, 40) + (prompt.length > 40 ? '...' : '');

  // Return a gradient as a data URI (SVG-based placeholder).
  // Uses charset=utf-8 data URI (no btoa) to avoid non-ASCII encoding errors.
  // In production this would be replaced by the real API response image.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="50%" style="stop-color:#16213e"/>
      <stop offset="100%" style="stop-color:#0f3460"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <text x="320" y="185" text-anchor="middle" font-size="20" fill="rgba(255,255,255,0.5)" font-family="system-ui">${icon}</text>
  <text x="320" y="220" text-anchor="middle" font-size="16" fill="rgba(255,255,255,0.8)" font-family="system-ui">${label}</text>
  <text x="320" y="248" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.5)" font-family="system-ui">NanoBanana - ${style}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class NanoBananaProvider implements IImageProvider {
  readonly name = 'NanoBanana';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string = '', baseUrl = 'https://api.nanobanana.ai/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async generate(
    prompt: string,
    style: ImageStyle,
    options: ImageProviderOptions,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    // If no API key, use mock immediately.
    if (!this.isConfigured()) {
      return this._mockResult(prompt, style);
    }

    // Attempt real API call with retry logic.
    return this._callWithRetry(prompt, style, options);
  }

  // ─── Real API call (placeholder implementation) ────────────────────────────

  private async _callWithRetry(
    prompt: string,
    style: ImageStyle,
    options: ImageProviderOptions,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    let attempt = 0;
    let backoffMs = 1000;

    while (attempt < options.maxRetries) {
      attempt++;
      try {
        const result = await this._callApi(prompt, style, options.timeoutMs);
        if (result.success) return result;

        // Rate limited — wait with backoff.
        if (result.error?.code === 'API_RATE_LIMITED') {
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, 8000);
          continue;
        }

        // Non-retryable error.
        if (!result.error?.retryable) return result;

        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 8000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt >= options.maxRetries) {
          return {
            success: false,
            error: { code: 'NETWORK_ERROR', message: msg, retryable: true },
          };
        }
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 8000);
      }
    }

    // All retries exhausted — fall back to mock.
    console.warn('[NanoBananaProvider] All retries failed, returning mock result');
    return this._mockResult(prompt, style);
  }

  private async _callApi(
    prompt: string,
    style: ImageStyle,
    timeoutMs: number,
  ): Promise<ServiceResult<Omit<GeneratedImage, 'postId'>>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          style,
          width: 640,
          height: 400,
          output_format: 'url',
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 429) {
        return {
          success: false,
          error: { code: 'API_RATE_LIMITED', message: 'Rate limit exceeded', retryable: true },
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: { code: 'API_KEY_INVALID', message: 'Invalid API key', retryable: false },
        };
      }
      if (!response.ok) {
        return {
          success: false,
          error: { code: 'NETWORK_ERROR', message: `HTTP ${response.status}`, retryable: true },
        };
      }

      const data = (await response.json()) as { image_url?: string; image_base64?: string };
      return {
        success: true,
        data: {
          id: crypto.randomUUID(),
          prompt,
          style,
          imageUrl: data.image_url,
          imageBase64: data.image_base64,
          provider: 'nanoBanana',
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

  // ─── Mock (development / offline) ─────────────────────────────────────────

  private _mockResult(prompt: string, style: ImageStyle): ServiceResult<Omit<GeneratedImage, 'postId'>> {
    return {
      success: true,
      data: {
        id: crypto.randomUUID(),
        prompt,
        style,
        imageBase64: buildMockSvg(prompt, style),
        provider: 'mock',
        generatedAt: Date.now(),
      },
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Default export instance (used in service bootstrap).
export const nanoBananaProvider = new NanoBananaProvider();
