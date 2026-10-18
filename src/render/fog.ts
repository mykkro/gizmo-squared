import type { ExploredMap } from '../world/explored';

/**
 * Fog alpha per fog cell for a w x h block of cells starting at (c0x, c0y): 0 where explored,
 * 255 where not. The renderer stretches this tiny mask over the view with smoothing, which
 * turns cell edges into soft gradients.
 */
export function fogMask(
  explored: ExploredMap,
  c0x: number,
  c0y: number,
  w: number,
  h: number,
): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      mask[y * w + x] = explored.isCellRevealed(c0x + x, c0y + y) ? 0 : 255;
    }
  }
  return mask;
}
