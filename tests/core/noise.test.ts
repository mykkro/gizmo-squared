import { describe, expect, it } from 'vitest';
import { makeFractalNoise } from '../../src/core/noise';
import { mulberry32 } from '../../src/core/rng';

const opts = { scale: 50, octaves: 3 };

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

function sample(contrast: number): number[] {
  const n = makeFractalNoise(3, { ...opts, contrast });
  const out: number[] = [];
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) out.push(n(x * 5, y * 5));
  return out;
}

describe('makeFractalNoise', () => {
  it('is deterministic per seed', () => {
    expect(makeFractalNoise(5, opts)(12.5, -40)).toBe(makeFractalNoise(5, opts)(12.5, -40));
  });

  it('differs between seeds', () => {
    expect(makeFractalNoise(5, opts)(10, 10)).not.toBe(makeFractalNoise(6, opts)(10, 10));
  });

  it('differs between seeds at the origin (simplex is 0 at lattice points)', () => {
    const values = new Set([1, 2, 3, 4, 5].map((s) => makeFractalNoise(s, opts)(0, 0)));
    expect(values.size).toBe(5);
  });

  it('stays within [0, 1] even with high contrast', () => {
    const n = makeFractalNoise(1, { ...opts, contrast: 3 });
    const r = mulberry32(9);
    for (let i = 0; i < 10000; i++) {
      const v = n((r() - 0.5) * 10000, (r() - 0.5) * 10000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous', () => {
    const n = makeFractalNoise(1, opts);
    for (let i = 0; i < 100; i++) {
      const x = i * 7.3;
      expect(Math.abs(n(x, 3) - n(x + 0.05, 3))).toBeLessThan(0.05);
    }
  });

  it('contrast widens the distribution', () => {
    expect(stdDev(sample(2))).toBeGreaterThan(stdDev(sample(1)) * 1.5);
  });
});
