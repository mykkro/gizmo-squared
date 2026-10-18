import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from './rng';

export type Noise2D = (x: number, y: number) => number;

export interface FractalOptions {
  /** Approximate feature size in tiles. */
  scale: number;
  octaves: number;
  persistence?: number;
  lacunarity?: number;
  /** Values > 1 stretch the output away from 0.5 (then clamp). */
  contrast?: number;
}

/** Fractal simplex noise normalised to [0, 1]. */
export function makeFractalNoise(seed: number, opts: FractalOptions): Noise2D {
  const rand = mulberry32(seed);
  const base = createNoise2D(rand);
  // Simplex is exactly 0 at lattice points such as the origin, whatever the seed; a seeded
  // offset keeps (0, 0) from looking the same in every world.
  const ox = rand() * 10000;
  const oy = rand() * 10000;
  const persistence = opts.persistence ?? 0.5;
  const lacunarity = opts.lacunarity ?? 2;
  const contrast = opts.contrast ?? 1;
  let ampSum = 0;
  for (let o = 0, a = 1; o < opts.octaves; o++, a *= persistence) ampSum += a;
  const baseFreq = 1 / opts.scale;

  return (x, y) => {
    let sum = 0;
    let amp = 1;
    let freq = baseFreq;
    for (let o = 0; o < opts.octaves; o++) {
      sum += amp * base((x + ox) * freq, (y + oy) * freq);
      amp *= persistence;
      freq *= lacunarity;
    }
    const v = 0.5 + 0.5 * contrast * (sum / ampSum);
    return v < 0 ? 0 : v > 1 ? 1 : v;
  };
}
