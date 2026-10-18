import { hash2 } from '../core/rng';

/**
 * Seamless (wrap-around) noise for generated textures. Coordinates are in texture space
 * [0, 1); lattice indices wrap with integer periods, so the result tiles exactly.
 */

const mod = (a: number, n: number) => ((a % n) + n) % n;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise in [0, 1] with a `px` x `py` cell lattice over the unit square. */
export function valueNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const gx = x * px;
  const gy = y * py;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = smooth(gx - ix);
  const fy = smooth(gy - iy);
  const v = (i: number, j: number) => hash2(seed, mod(i, px), mod(j, py));
  const a = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * fx;
  const b = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * fx;
  return a + (b - a) * fy;
}

/** Fractal value noise in [0, 1]; the period doubles each octave so it stays seamless. */
export function fbm(x: number, y: number, period: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let p = period;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x, y, p, p, seed + o * 101);
    total += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / total;
}

/**
 * Worley noise: distances (in cell units) to the nearest and second-nearest feature point,
 * one hashed point per cell of a `period` grid.
 */
export function cellular(
  x: number,
  y: number,
  period: number,
  seed: number,
): { f1: number; f2: number } {
  const gx = x * period;
  const gy = y * period;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  let f1 = Infinity;
  let f2 = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const wx = mod(cx, period);
      const wy = mod(cy, period);
      const fx = cx + hash2(seed, wx, wy, 1);
      const fy = cy + hash2(seed, wx, wy, 2);
      const d = Math.hypot(fx - gx, fy - gy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1, f2 };
}
