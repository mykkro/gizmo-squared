import { hash2 } from '../core/rng';

/**
 * Seamless (wrap-around) noise for generated textures. Coordinates are in texture space
 * [0, 1); lattice indices wrap with integer periods, so the result tiles exactly.
 * Lattice values and feature points are precomputed per (period, seed) and cached, which
 * keeps texture generation fast; results are identical to hashing on the fly.
 */

const mod = (a: number, n: number) => ((a % n) + n) % n;
const smooth = (t: number) => t * t * (3 - 2 * t);

const lattices = new Map<number, Float32Array>();

/** Hashed lattice values for a px x py grid (cached). */
function lattice(px: number, py: number, seed: number, salt: number): Float32Array {
  // Numeric key (no string building in the hot path); periods are < 4096.
  const key = ((seed * 7 + salt) * 4096 + px) * 4096 + py;
  let t = lattices.get(key);
  if (!t) {
    t = new Float32Array(px * py);
    for (let j = 0; j < py; j++)
      for (let i = 0; i < px; i++) t[j * px + i] = hash2(seed, i, j, salt);
    lattices.set(key, t);
  }
  return t;
}

/** Value noise in [0, 1] with a `px` x `py` cell lattice over the unit square. */
export function valueNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const t = lattice(px, py, seed, 0);
  const gx = x * px;
  const gy = y * py;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = smooth(gx - ix);
  const fy = smooth(gy - iy);
  const x0 = mod(ix, px);
  const x1 = mod(ix + 1, px);
  const y0 = mod(iy, py) * px;
  const y1 = mod(iy + 1, py) * px;
  const a = t[y0 + x0] + (t[y0 + x1] - t[y0 + x0]) * fx;
  const b = t[y1 + x0] + (t[y1 + x1] - t[y1 + x0]) * fx;
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

export interface Cell {
  /** Distance to the nearest feature point (cell units). */
  f1: number;
  /** Distance to the second-nearest feature point. */
  f2: number;
  /** Offset from the nearest feature point to the sample. */
  ox: number;
  oy: number;
  /** Random value in [0, 1) identifying the nearest cell. */
  id: number;
}

/**
 * Worley noise: distances (in cell units) to the nearest and second-nearest feature point,
 * one hashed point per cell of a `period` grid.
 */
export function cellular(x: number, y: number, period: number, seed: number): Cell {
  const px1 = lattice(period, period, seed, 1);
  const py1 = lattice(period, period, seed, 2);
  const ids = lattice(period, period, seed, 3);
  const gx = x * period;
  const gy = y * period;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  let f1 = Infinity;
  let f2 = Infinity;
  let ox = 0;
  let oy = 0;
  let id = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const wx = mod(cx, period);
      const wy = mod(cy, period);
      const k = wy * period + wx;
      const fx = cx + px1[k];
      const fy = cy + py1[k];
      const d = Math.hypot(fx - gx, fy - gy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        ox = gx - fx;
        oy = gy - fy;
        id = ids[k];
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1, f2, ox, oy, id };
}
