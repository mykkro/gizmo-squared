import { describe, expect, it } from 'vitest';
import { BIOME_INDEX } from '../../src/data/biomes';
import { createDiscoveryState, updateDiscovery } from '../../src/systems/discovery';

const FOREST = BIOME_INDEX.Forest;
const DESERT = BIOME_INDEX.Desert;

describe('updateDiscovery', () => {
  it('commits the first biome immediately as new', () => {
    const s = createDiscoveryState();
    expect(updateDiscovery(s, FOREST, 0.1)).toEqual({ biome: FOREST, isNew: true });
    expect(updateDiscovery(s, FOREST, 0.1)).toBeNull();
  });

  it('requires a new biome to hold for 0.4 s', () => {
    const s = createDiscoveryState();
    updateDiscovery(s, FOREST, 0.1);
    for (let i = 0; i < 4; i++) expect(updateDiscovery(s, DESERT, 0.1)).toBeNull();
    expect(updateDiscovery(s, DESERT, 0.1)).toEqual({ biome: DESERT, isNew: true });
  });

  it('flickering back across a border resets the timer (no toast spam)', () => {
    const s = createDiscoveryState();
    updateDiscovery(s, FOREST, 0.1);
    for (let i = 0; i < 20; i++) {
      expect(updateDiscovery(s, DESERT, 0.1)).toBeNull();
      expect(updateDiscovery(s, DESERT, 0.1)).toBeNull();
      expect(updateDiscovery(s, FOREST, 0.1)).toBeNull();
    }
  });

  it('reports known biomes as not new', () => {
    const s = createDiscoveryState(['Forest']);
    expect(updateDiscovery(s, FOREST, 0.1)).toEqual({ biome: FOREST, isNew: false });
    expect(s.discovered.has('Forest')).toBe(true);
  });
});
