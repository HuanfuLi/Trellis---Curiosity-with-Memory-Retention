/**
 * PostFormattingService
 *
 * Derives display metadata from a DailyPost for use in preview images:
 * - inferImageStyle(post, index) → ImageStyle
 * - buildImagePrompt(post) → prompt string for image generation
 */

import type { DailyPost, ImageStyle } from '../types';


function trimSentence(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 1).trimEnd() + '…';
}

// ─── Style rotation ────────────────────────────────────────────────────────────

const STYLE_ROTATION: ImageStyle[] = ['infograph', 'illustration', 'photo'];

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Infer the best image style for a post.
 * Derived from post.id hash so the style is stable regardless of feed position.
 * (Position-based rotation caused cache misses when connection/milestone cards
 * shifted a post's index between renders.)
 *
 * @param post  The post to style.
 */
export function inferImageStyle(post: DailyPost): ImageStyle {
  // Override: connection posts and long-form content suit 'illustration'.
  if (post.sourceType === 'connection') return 'illustration';

  // Override: starter / seed posts suit 'infograph' (clean, structural).
  if (post.sourceType === 'starter') return 'infograph';

  // Hash post.id for deterministic rotation that is stable across re-renders.
  const hash = Array.from(post.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return STYLE_ROTATION[hash % STYLE_ROTATION.length];
}

/**
 * Build a purely visual prompt for a cover image.
 * The image must contain NO text, labels, or overlays — only visual imagery
 * that conveys the concept through scene, metaphor, or composition.
 */
export function buildImagePrompt(post: DailyPost): string {
  const keywords = post.keywords.slice(0, 4).join(', ');
  const context = trimSentence(post.contextLabel, 48);
  const style = post.narrativeMode.replace(/-/g, ' ');

  return [
    'Create a square educational concept image.',
    'IMPORTANT: Do NOT include any text, words, labels, captions, numbers, or typography anywhere in the image.',
    'The image must be entirely visual — communicate the concept through scene, metaphor, objects, or abstract composition only.',
    `CONCEPT: ${trimSentence(post.title, 64)}`,
    `KEYWORDS: ${keywords}`,
    `CONTEXT: ${context}`,
    `MOOD: ${style}`,
  ].join('\n');
}
