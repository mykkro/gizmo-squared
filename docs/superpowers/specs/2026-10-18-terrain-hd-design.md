# Gizmo's World — Sub-project 2: Terrain rendering 2.0 (smooth HD)

Date: 2026-10-18
Status: Approved in conversation; written for the record.

## Direction change

The art style switches from crisp pixel art to **smooth HD**: textured terrain that blends
between types, anti-aliased sprites and objects, continuous zoom, and soft fog of war. This
replaces the "crisp pixel art" decision in the foundation spec. World logic (32 px tiles,
16-tile chunks, generation, saves) is unchanged.

## Requirements

1. **Procedural seamless textures.** Each of the 16 terrain types has a 128 × 128 px texture
   (4 × 4 tiles) generated at runtime from wrap-around noise, so it tiles seamlessly. The
   textures are built from a small set of generators (fBm, anisotropic streaks, ripples, waves,
   cellular cracks/spots, sparkles) and a palette per terrain. They are deterministic, created
   lazily on first use, and sampled at **world pixel** coordinates.
2. **Blending.** Each terrain pixel is a pure function of its world position. Weights come from
   the four nearest tile centres (bilinear), multiplied by a per-terrain noise factor and
   sharpened, giving an organic transition about one tile wide. Uniform areas take a fast path
   (a single texel). Chunk seams are impossible by construction and are tested.
3. **Objects.** Trees, boulders, cacti and building bricks are drawn as shaded, anti-aliased
   shapes into the chunk bake.
4. **HD sprites.** Gizmo and the items are rasterised from their shape definitions at screen
   resolution with 2 × 2 supersampling and an outline in shape space, cached per zoom.
5. **Renderer.** Smoothing is on and zoom is continuous: short side / (32 × 14), clamped to
   [0.5, 8]. Chunks are drawn into whole-device-pixel rectangles so no gaps appear between
   them. Interpolation and device-pixel snapping are kept. CSS `image-rendering: pixelated` is
   removed. The bake budget is 1 chunk per frame, and the debug overlay shows the last bake
   time.
6. **Fog of war in the main view.** One mask texel per fog cell (4 × 4 tiles), alpha 0 where
   explored and 1 where not, drawn stretched with smoothing so the edges form soft gradients.
7. **Minimap.** One tile per map pixel; colours come from each texture's average colour.

## Non-goals

Animated water and lava, decorations beyond obstacles (flowers, grass tufts), lighting or a
day/night cycle, and Web Worker baking (only if profiling shows stalls).

## Done criteria

- All tests pass: seamless textures, determinism, blending (uniform areas, mixed borders,
  chunk seams), object coverage, sprite rasteriser anti-aliasing, fog mask, continuous zoom,
  minimap colours.
- The browser check passes, and the screenshots show textured, blended terrain, smooth
  sprites and soft fog.
- No visible chunk seams or gaps; 60 fps while walking (debug overlay).
