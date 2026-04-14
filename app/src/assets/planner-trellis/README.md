# Planner Trellis — Asset Generation Guide

Assets here are **pre-generated externally** by the user via Nano Banana / image services (per CONTEXT D-30/D-31/D-32). Do NOT use the app's runtime image pipeline (imageGeneration.bootstrap / concept-feed).

## Files expected

| File | Variant | Format | Budget |
|------|---------|--------|--------|
| `trellis-bg-default.webp` | A, V (poster) | WebP or PNG, 2:1 landscape, 2048x1024 recommended | <=200 KB |
| `trellis-loop.mp4` | V | MP4 H.264, 480p (960x480), <=2s seamless loop, muted | <=300 KB |
| `trellis-loop.webm` | V | WebM VP9, 480p, <=2s seamless loop, muted | <=200 KB |

Mockup files (`mockup-variant-a.png`, `mockup-variant-c.png`, `mockup-variant-v.png`) live under `.planning/phases/25-.../` and are for design review only — NOT shipped in the bundle.

## Asset 1 — Variant A primary background (empty trellis)

**Target file:** `trellis-bg-default.webp` (or `.png`)
**Aspect ratio:** 2:1 landscape (recommend 2048x1024 for retina)

> A Studio Ghibli-inspired soft watercolor illustration of an empty wooden garden trellis standing in a peaceful backyard garden. The trellis is a simple square lattice of warm-brown weathered bamboo or wooden posts, centered in the scene. Morning golden sunlight filters through with soft bokeh and dappled light. The ground at the base is gentle grass with a hint of pebbled earth. A dreamy pastel sky gradient — peach to warm cream — fills the background, fading into soft atmospheric haze. Low contrast, warm palette, painterly watercolor style, subtly textured like hand-painted animation backgrounds. **No leaves on the trellis, no vines, no people, no characters, no text, no borders.** Landscape orientation, wide 2:1 aspect ratio.

## Asset 2 — Variant V loop video

**Target files:** `trellis-loop.mp4` AND `trellis-loop.webm` (both encodings)
**Spec:** 480p (960x480 or similar 2:1), <=2s seamless loop, <=500 KB total, H.264 / VP9, muted
**Tool:** Generate a base still with Nano Banana using the prompt below, then animate with an image-to-video service (Runway, Kling, Luma, or similar).

**Base still prompt:**
> Same scene as Asset 1 (Studio Ghibli watercolor empty wooden trellis in morning garden), reserved for atmospheric motion. Identical composition to Asset 1.

**Motion prompt (for image-to-video tool):**
> Subtle seamless 2-second loop. Gentle wind moves faint dust motes and pollen particles diagonally across the scene, catching the golden morning light. Very soft light shimmer on the trellis wood. Slow atmospheric drift only — no new objects appearing, no camera movement, no people, no text. Last frame must blend seamlessly with first frame. Avoid dramatic changes; aim for ambient, barely-perceptible life.

## Mockup 1 — Variant A rendered state (design review, not shipped)

**Target file:** `mockup-variant-a.png` (store in `.planning/phases/25-.../`, NOT here)

> The same Ghibli watercolor wooden trellis scene as Asset 1, now with lush green vines climbing up and through the lattice. Vines curve organically, crossing grid cells freely with bezier-like paths. Several rounded pastel mint-green leaves are scattered along the vines. A handful of soft pink cherry-blossom petals cluster at 2-3 vine tips (representing mastered concepts). One or two small red apples hang near those blossoms (representing sustained mastery). A couple of yellowed autumn leaves drift partway down in mid-fall, and 3-4 fallen leaves rest at the base of the trellis on the gentle grass. Morning golden light, warm palette, dreamy painterly quality. **No text, no people, no borders.** Landscape 2:1.

## Mockup 2 — Variant C rendered state (design review, not shipped)

**Target file:** `mockup-variant-c.png`

> Flat vector illustration of a wooden garden trellis with green vines winding through it. Vines curve organically, not confined to grid lines. Rounded pastel mint-green leaves along the vines, a few soft pink blossoms at vine tips, one or two small red fruits hanging from the vines. A couple of yellowed leaves mid-fall, and a few fallen leaves at the base. Clean geometric shapes, limited pastel palette — mint green, warm brown, soft pink, amber, cream. No shading or photorealistic textures — just clean flat fills with subtle gradients. Modern high-end illustration aesthetic like a premium indie game UI or Figma illustration. Rounded shapes with soft 1.5px outlines. **No text, no people, no borders.** Landscape 2:1.

## Mockup 3 — Variant V still frame (design review, not shipped)

**Target file:** `mockup-variant-v.png`

> Same composition as Mockup 1 (Ghibli watercolor trellis with vines, leaves, blossoms, fruits) with added subtle atmospheric motion cues implied by the still — faint light dust motes floating through sunbeams, very gentle leaf-sway implied by slight motion blur on 2-3 leaves, one small firefly or butterfly somewhere in the composition. Everything else static. This is a representative frame from a 2-second looping atmosphere video. **No text, no people, no borders.** Landscape 2:1.

## Placement

Commit files to this directory as they arrive. Until then, Variant A and Variant V will fall back to a solid gradient background (see 25-03 and 25-04 plans). Variant C requires no assets.
