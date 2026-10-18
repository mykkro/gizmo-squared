import { describe, expect, it } from 'vitest';
import { hash2, hashString, mulberry32, pickWeighted } from '../../src/core/rng';

describe('hashString', () => {
  it('is deterministic, unsigned and distinguishes inputs', () => {
    expect(hashString('maple-17')).toBe(hashString('maple-17'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(Number.isInteger(hashString('x'))).toBe(true);
    expect(hashString('x')).toBeGreaterThanOrEqual(0);
  });
});

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('returns values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hash2', () => {
  it('is deterministic', () => {
    expect(hash2(1, 5, -7, 3)).toBe(hash2(1, 5, -7, 3));
  });

  it('varies with every argument and is not symmetric in x/y', () => {
    const base = hash2(1, 5, 7, 0);
    expect(hash2(2, 5, 7, 0)).not.toBe(base);
    expect(hash2(1, 6, 7, 0)).not.toBe(base);
    expect(hash2(1, 5, 8, 0)).not.toBe(base);
    expect(hash2(1, 5, 7, 1)).not.toBe(base);
    expect(hash2(1, 7, 5, 0)).not.toBe(base);
  });

  it('is roughly uniform over a grid including negative coordinates', () => {
    let sum = 0;
    let n = 0;
    let min = 1;
    let max = 0;
    for (let y = -50; y < 50; y++) {
      for (let x = -50; x < 50; x++) {
        const v = hash2(99, x, y);
        sum += v;
        n++;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
  });
});

describe('pickWeighted', () => {
  it('maps u across the cumulative weights, skipping zero weights', () => {
    const w = { a: 1, b: 0, c: 3 };
    expect(pickWeighted(w, 0)).toBe('a');
    expect(pickWeighted(w, 0.24)).toBe('a');
    expect(pickWeighted(w, 0.26)).toBe('c');
    expect(pickWeighted(w, 0.9999)).toBe('c');
  });

  it('returns null when nothing has positive weight', () => {
    expect(pickWeighted({ a: 0 }, 0.5)).toBeNull();
    expect(pickWeighted({}, 0.5)).toBeNull();
  });
});
