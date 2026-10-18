import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { randomSeedText } from '../src/seedWords';

describe('randomSeedText', () => {
  it('produces readable adjective-noun-number seeds', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 50; i++) expect(randomSeedText(r)).toMatch(/^[a-z]+-[a-z]+-\d{1,2}$/);
  });

  it('is deterministic for a given random source', () => {
    expect(randomSeedText(mulberry32(9))).toBe(randomSeedText(mulberry32(9)));
  });
});
