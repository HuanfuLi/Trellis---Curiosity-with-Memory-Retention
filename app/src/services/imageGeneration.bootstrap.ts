/**
 * imageGeneration.bootstrap
 *
 * Wires the NanoBanana and Gemini providers into the ImageGenerationService
 * and syncs API keys from user settings.
 *
 * Call `bootstrapImageGeneration()` once at app start (or after settings change).
 */

import { imageGenerationService } from './imageGeneration.service';
import { NanoBananaProvider } from '../providers/nanoBanana.provider';
import { GeminiProvider } from '../providers/gemini.provider';
import { mockSettingsService } from './mock/settings.mock';

export function bootstrapImageGeneration(): void {
  const settings = mockSettingsService.getSync();
  const imageSettings = settings.imageGeneration;

  const nanoBananaKey = imageSettings?.nanoBananaApiKey ?? '';
  const geminiKey = imageSettings?.geminiApiKey ?? '';

  // Provider order: NanoBanana (primary) → Gemini (fallback).
  imageGenerationService.setProviders([
    new NanoBananaProvider(nanoBananaKey),
    new GeminiProvider(geminiKey),
  ]);

  imageGenerationService.configure({
    nanoBananaApiKey: nanoBananaKey,
    geminiApiKey: geminiKey,
  });
}
