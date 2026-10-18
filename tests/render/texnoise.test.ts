import { describe, expect, it } from 'vitest';
import { cellular, fbm, valueNoise } from '../../src/render/texnoise';

const N = 128;
const at = (f: (x: number, y: number) => number, i: number, j: number) => f(i / N, j / N);

describe('texnoise', () => {
  it.each([
    ['valueNoise', (x: number, y: number) => valueNoise(x, y, 4, 4, 1)],
    ['fbm', (x: number, y: number) => fbm(x, y, 4, 4, 2)],
    ['cellular f1', (x: number, y: number) => cellular(x, y, 5, 3).f1],
  ])('%s is seamless: the wrap step is like any other step', (_n, f) => {
    let maxStep = 0;
    let wrapStep = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N - 1; i++) {
        maxStep = Math.max(maxStep, Math.abs(at(f, i + 1, j) - at(f, i, j)));
      }
      wrapStep = Math.max(wrapStep, Math.abs(at(f, 0, j) - at(f, N - 1, j)));
    }
    expect(wrapStep).toBeLessThanOrEqual(maxStep * 1.05 + 1e-9);
  });

  it('is deterministic and in range', () => {
    expect(fbm(0.3, 0.7, 4, 3, 9)).toBe(fbm(0.3, 0.7, 4, 3, 9));
    for (let i = 0; i < 500; i++) {
      const v = fbm((i * 0.37) % 1, (i * 0.61) % 1, 4, 4, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('cellular f2 >= f1', () => {
    for (let i = 0; i < 200; i++) {
      const c = cellular((i * 0.13) % 1, (i * 0.29) % 1, 6, 1);
      expect(c.f2).toBeGreaterThanOrEqual(c.f1);
    }
  });
});
