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
    'linear-gradient(135deg, #1b5e20 0%, #2e7d32 50%, #66bb6a 100%)',
  ],
  illustration: [
    'linear-gradient(135deg, #4a148c 0%, #7b1fa2 50%, #ce93d8 100%)',
    'linear-gradient(135deg, #e65100 0%, #f57c00 50%, #ffcc02 100%)',
    'linear-gradient(135deg, #880e4f 0%, #c2185b 50%, #f48fb1 100%)',
    'linear-gradient(135deg, #311b92 0%, #512da8 50%, #7e57c2 100%)',
  ],
  photo: [
    'linear-gradient(135deg, #263238 0%, #546e7a 50%, #b0bec5 100%)',
    'linear-gradient(135deg, #33691e 0%, #558b2f 50%, #aed581 100%)',
    'linear-gradient(135deg, #bf360c 0%, #e64a19 50%, #ffab91 100%)',
    'linear-gradient(135deg, #1a237e 0%, #283593 50%, #5c6bc0 100%)',
  ],
};

function deterministicIndex(seed: string, length: number): number {
  let h = 0;
  for (const ch of seed) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return ((h % length) + length) % length;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function readPromptField(prompt: string, key: string): string {
  const match = prompt.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function wrapText(value: string, maxChars: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function parsePromptCard(prompt: string) {
  const emoji = readPromptField(prompt, 'EMOJI') || '💡';
  const headline = readPromptField(prompt, 'HEADLINE') || 'Concept preview';
  const caption = readPromptField(prompt, 'CAPTION') || 'Open the post to explore the idea in detail.';
  const chips = readPromptField(prompt, 'CHIPS')
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3);
  const rows = [1, 2, 3]
    .map((index) => readPromptField(prompt, `ROW_${index}`))
    .filter(Boolean)
    .map((row) => {
      const [label, value] = row.split('|').map((part) => part.trim());
      return { label: label || 'Key', value: value || '' };
    });

  return { emoji, headline, caption, chips, rows };
}

function buildMockSvg(prompt: string, style: ImageStyle): string {
  const gradients = MOCK_GRADIENTS[style];
  const gradient = gradients[deterministicIndex(prompt, gradients.length)];
  const { emoji, headline, caption, chips } = parsePromptCard(prompt);
  const [start, mid, end] = gradient.match(/#[0-9a-fA-F]{6}/g) ?? ['#1a1a2e', '#16213e', '#0f3460'];
  
  // Wrap headline with emoji integrated naturally
  const headlineWithEmoji = `${emoji} ${headline}`;
  const headlineLines = wrapText(headlineWithEmoji, 28);
  const captionLines = wrapText(caption, 45);
  const chipText = chips.length > 0 ? chips.join(' · ') : 'explore · discover · learn';
  
  // Decorative accent circles (varied for visual interest)
  const accentCircles = [
    { x: 520, y: 60, r: 48, opacity: 0.15 },
    { x: 80, y: 340, r: 52, opacity: 0.12 },
    { x: 600, y: 320, r: 36, opacity: 0.1 },
  ];
  
  const accentMarkup = accentCircles
    .map(({ x, y, r, opacity }) => `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,${opacity})" />`)
    .join('');

  // Main headline with emoji integrated
  const headlineMarkup = headlineLines
    .map((line, index) => 
      `<text x="36" y="${100 + index * 42}" font-size="36" font-weight="800" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" letter-spacing="-0.5">${escapeXml(line)}</text>`
    )
    .join('');
  
  // Secondary caption
  const captionMarkup = captionLines
    .map((line, index) => 
      `<text x="36" y="${226 + index * 24}" font-size="15" fill="rgba(255,255,255,0.88)" font-family="system-ui, -apple-system, sans-serif" line-height="1.4">${escapeXml(line)}</text>`
    )
    .join('');

  // Chip/tag bar with visual separation
  const chipMarkup = `
  <rect x="0" y="270" width="640" height="1" fill="rgba(255,255,255,0.2)"/>
  <text x="36" y="297" font-size="12" font-weight="600" letter-spacing="1" fill="rgba(255,255,255,0.72)" font-family="system-ui, -apple-system, sans-serif">CONCEPTS</text>
  <text x="36" y="324" font-size="14" fill="rgba(255,255,255,0.92)" font-family="system-ui, -apple-system, sans-serif">${escapeXml(chipText)}</text>
  `;

  // Visual indicator bar at bottom (different colors per style)
  const indicatorColor = style === 'infograph' ? '#4fc3f7' : style === 'illustration' ? '#ce93d8' : '#ffab91';
  const indicatorMarkup = `<rect x="0" y="376" width="640" height="4" fill="${indicatorColor}" opacity="0.8" />`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${start}"/>
          <stop offset="50%" style="stop-color:${mid}"/>
          <stop offset="100%" style="stop-color:${end}"/>
        </linearGradient>
      </defs>
      
      <!-- Background gradient -->
      <rect width="640" height="400" fill="url(#bg)"/>
      
      <!-- Decorative accent circles -->
      ${accentMarkup}
      
      <!-- Main content area with gentle background -->
      <rect x="0" y="0" width="640" height="360" fill="rgba(0,0,0,0.08)"/>
      
      <!-- Headline with integrated emoji -->
      ${headlineMarkup}
      
      <!-- Caption text -->
      ${captionMarkup}
      
      <!-- Concept chips and separator -->
      ${chipMarkup}
      
      <!-- Style indicator bar -->
      ${indicatorMarkup}
    </svg>
  `)}`;
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
