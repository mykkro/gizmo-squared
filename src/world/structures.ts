import { hash2 } from '../core/rng';

/**
 * Wall layout of a ruin (1 = wall tile), a pure function of the building's seed so the
 * generator (collision) and the painter (drawing) always agree. Outer walls are broken by
 * random gaps, the middle of the bottom wall is always an entrance, and there may be one
 * short inner wall stub (never in front of the entrance).
 */
export function ruinsWallMask(seed: number, w: number, h: number): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (edge && hash2(seed, x, y, 1) > 0.3) m[y * w + x] = 1;
    }
  }
  const door = w >> 1;
  m[(h - 1) * w + door] = 0;
  // Guarantee two more gaps: a crumbled top-left corner and one tile of the top wall.
  m[0] = 0;
  m[1 + ((hash2(seed, 0, 0, 2) * (w - 2)) | 0)] = 0;

  // A short inner wall stub, horizontal, away from the entrance column.
  if (w >= 5 && h >= 5 && hash2(seed, 0, 0, 3) < 0.7) {
    const sy = 1 + ((hash2(seed, 0, 0, 4) * (h - 4)) | 0);
    const sx = hash2(seed, 0, 0, 5) < 0.5 ? 1 : w - 3;
    for (let x = sx; x < sx + 2; x++) if (x !== door) m[sy * w + x] = 1;
  }
  return m;
}
