import { describe, expect, it } from 'vitest';
import { hashString } from '../../src/core/rng';
import { BIOMES, BIOME_NAMES, type BiomeName } from '../../src/data/biomes';
import { BiomeField, classifyBiomeName, type Climate } from '../../src/world/biomeField';

const c = (elevation: number, temperature: number, moisture: number, landmark = 0): Climate => ({
  elevation,
  temperature,
  moisture,
  landmark,
});

describe('classifyBiomeName', () => {
  const cases: Array<[Climate, BiomeName]> = [
    [c(0.5, 0.2, 0.1), 'Tundra'],
    [c(0.5, 0.2, 0.4), 'Snowfield'],
    [c(0.5, 0.2, 0.6), 'Frozen Lake'],
    [c(0.5, 0.2, 0.9), 'Frozen Lake'],
    [c(0.5, 0.5, 0.1), 'Grassland'],
    [c(0.5, 0.5, 0.4), 'Forest'],
    [c(0.5, 0.5, 0.6), 'Marsh'],
    [c(0.5, 0.5, 0.8), 'Swamp'],
    [c(0.5, 0.8, 0.1), 'Desert'],
    [c(0.5, 0.8, 0.4), 'Savanna'],
    [c(0.5, 0.8, 0.6), 'Jungle'],
    [c(0.5, 0.8, 0.8), 'Swamp Forest'],
    [c(0.1, 0.2, 0.5), 'Iceberg'],
    [c(0.1, 0.5, 0.5), 'Beach'],
    [c(0.8, 0.5, 0.5), 'Mountains'],
    [c(0.8, 0.2, 0.5), 'Mountains'],
    [c(0.9, 0.8, 0.5), 'Volcano'],
    [c(0.85, 0.8, 0.5), 'Volcanic Plains'],
    [c(0.78, 0.8, 0.1), 'Badlands'],
    [c(0.78, 0.8, 0.5), 'Canyon'],
    [c(0.5, 0.5, 0.4, 0.9), 'Ruins'],
    [c(0.5, 0.8, 0.4, 0.9), 'Savanna'],
    // Band boundaries: 0.35 and 0.65 belong to the warmer band.
    [c(0.5, 0.35, 0.4), 'Forest'],
    [c(0.5, 0.65, 0.4), 'Savanna'],
  ];

  it.each(cases)('%o -> %s', (climate, expected) => {
    expect(classifyBiomeName(climate)).toBe(expected);
  });
});

describe('BiomeField', () => {
  it('is deterministic for a seed', () => {
    const a = new BiomeField(42);
    const b = new BiomeField(42);
    for (let i = 0; i < 50; i++)
      expect(a.biomeAt(i * 37, -i * 53)).toBe(b.biomeAt(i * 37, -i * 53));
  });

  it('produces climate values in [0, 1]', () => {
    const f = new BiomeField(7);
    for (let i = 0; i < 200; i++) {
      const cl = f.climateAt(i * 101 - 5000, i * 67 - 3000);
      for (const v of Object.values(cl)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('produces all 19 biomes within a 2048 x 2048 tile area', () => {
    const f = new BiomeField(hashString('coverage'));
    const counts = new Map<string, number>();
    for (let ty = -1024; ty < 1024; ty += 4) {
      for (let tx = -1024; tx < 1024; tx += 4) {
        const name = BIOMES[f.biomeAt(tx, ty)].name;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    const missing = BIOME_NAMES.filter((n) => !counts.has(n));
    expect(missing, `histogram: ${JSON.stringify(Object.fromEntries(counts))}`).toEqual([]);
  });
});
