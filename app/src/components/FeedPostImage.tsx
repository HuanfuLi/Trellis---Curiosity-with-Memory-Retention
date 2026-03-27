/**
 * FeedPostImage
 *
 * Displays a large AI-generated image for a feed post with:
 * - Clean edge-to-edge artwork without an extra text scrim
 * - Loading skeleton while the image is being generated
 * - Error state with retry button
 * - Mobile-first safe-area aware layout
 *
 * Usage:
 *   <FeedPostImage
 *     imageData={generatedImage}        // null = loading, undefined = error
 *     isLoading={true}
 *     error="Image generation failed."
 *     onRetry={() => void handleRetry()}
 *   />
 */

import type { GeneratedImage } from '../types';

interface FeedPostImageProps {
  /** The generated image data. null while loading; undefined/absent if error. */
  imageData?: GeneratedImage | null;
  /** Loading state — shows skeleton animation. */
  isLoading?: boolean;
  /** Error message — shows error state with optional retry. */
  error?: string | null;
  /** Callback for retry button in error state. */
  onRetry?: () => void;
  /**
   * Aspect ratio as a percentage string for the padding-bottom trick
   * (e.g. '100%' = 1:1 square, '56.25%' = 16:9).
   * When provided, height = width × (value/100). Defaults to fixed minHeight.
   */
  aspectPadding?: string;
  /** Minimum image height in px. Used when aspectPadding is not set. Defaults to 220. */
  minHeight?: number;
  /** Additional CSS class names. */
  className?: string;
}

// ─── Shared wrapper: padding-bottom trick gives reliable height in all WebKit ──

function AspectBox({
  aspectPadding,
  minHeight,
  children,
  style,
}: {
  aspectPadding?: string;
  minHeight: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  if (aspectPadding) {
    // padding-bottom % is relative to width → creates exact aspect ratio.
    // height: 0 ensures the box height comes entirely from padding, not content.
    return (
      <div
        style={{
          width: '100%',
          height: 0,
          paddingBottom: aspectPadding,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--surface-variant)',
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        width: '100%',
        minHeight,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--surface-variant)',
        ...style,
      }}
    >
      {children}
      {/* Spacer ensures minHeight is respected even with absolute-positioned children */}
      <div style={{ minHeight }} />
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function ImageSkeleton({ minHeight, aspectPadding }: { minHeight: number; aspectPadding?: string }) {
  return (
    <AspectBox minHeight={minHeight} aspectPadding={aspectPadding}>
      {/* Shimmer sweep */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, white 15%, transparent) 50%, transparent 100%)',
          animation: 'shimmer 1.4s infinite',
        }}
      />
      {/* Inner label */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '1.8rem', opacity: 0.3 }}>🖼</span>
        <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', opacity: 0.7 }}>
          Generating image…
        </p>
      </div>
    </AspectBox>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────────

function ImageError({
  message,
  onRetry,
  minHeight,
  aspectPadding,
}: {
  message: string;
  onRetry?: () => void;
  minHeight: number;
  aspectPadding?: string;
}) {
  return (
    <AspectBox
      minHeight={minHeight}
      aspectPadding={aspectPadding}
      style={{ border: '1.5px dashed var(--border)' }}
    >
      <div
        role="alert"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: '1.8rem' }}>🖼</span>
        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--muted-foreground)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        {onRetry && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            style={{
              marginTop: '4px',
              padding: '8px 20px',
              borderRadius: 'var(--radius)',
              border: '1.5px solid var(--primary-40)',
              backgroundColor: 'transparent',
              color: 'var(--primary-40)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>
    </AspectBox>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function FeedPostImage({
  imageData,
  isLoading = false,
  error = null,
  onRetry,
  aspectPadding,
  minHeight = 220,
  className,
}: FeedPostImageProps) {
  // Loading state
  if (isLoading && !imageData) {
    return <ImageSkeleton minHeight={minHeight} aspectPadding={aspectPadding} />;
  }

  // Error state (no image, not loading)
  if (error && !imageData) {
    return <ImageError message={error} onRetry={onRetry} minHeight={minHeight} aspectPadding={aspectPadding} />;
  }

  // No data at all — show neutral placeholder
  if (!imageData) {
    return <ImageSkeleton minHeight={minHeight} aspectPadding={aspectPadding} />;
  }

  const imageSrc = imageData.imageBase64 ?? imageData.imageUrl ?? '';

  return (
    <AspectBox minHeight={minHeight} aspectPadding={aspectPadding} className={className}>
      <img
        src={imageSrc}
        alt="Post preview image"
        loading="lazy"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    </AspectBox>
  );
}
