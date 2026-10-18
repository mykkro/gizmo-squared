import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '../../src/config';
import { BIOMES, BIOME_INDEX } from '../../src/data/biomes';
import { BLOCKS, BLOCK_ID, NO_BLOCK, blockById } from '../../src/data/blocks';
import { BLUEPRINT_CHARS, BUILDINGS } from '../../src/data/buildings';
import { ITEMS, ITEM_ID, NO_ITEM, itemById } from '../../src/data/items';
import { TERRAINS, TERRAIN_INDEX, type TerrainKey } from '../../src/data/terrains';

describe('biomes', () => {
  it('has all 19 original biomes with unique names and a matching index', () => {
    expect(BIOMES).toHaveLength(19);
    expect(new Set(BIOMES.map((b) => b.name)).size).toBe(19);
    BIOMES.forEach((b, i) => expect(BIOME_INDEX[b.name]).toBe(i));
  });

  it('every biome has positive terrain and item weights', () => {
    for (const b of BIOMES) {
      const tw = Object.values(b.terrains) as number[];
      const iw = Object.values(b.items) as number[];
      expect(tw.length, b.name).toBeGreaterThan(0);
      expect(
        tw.every((w) => w > 0),
        b.name,
      ).toBe(true);
      expect(
        iw.every((w) => w > 0),
        b.name,
      ).toBe(true);
    }
  });

  it('every biome except Iceberg has walkable terrain', () => {
    for (const b of BIOMES) {
      if (b.name === 'Iceberg') continue;
      const walkable = (Object.keys(b.terrains) as TerrainKey[]).some(
        (k) => !TERRAINS[TERRAIN_INDEX[k]].solid && !b.solidTerrains?.includes(k),
      );
      expect(walkable, b.name).toBe(true);
    }
  });

  it('biome obstacles are obstacle blocks', () => {
    for (const b of BIOMES) {
      for (const key of Object.keys(b.obstacles) as (keyof typeof BLOCK_ID)[]) {
        expect(blockById(BLOCK_ID[key])?.kind, `${b.name}/${key}`).toBe('obstacle');
      }
    }
  });
});

describe('items and blocks', () => {
  it('item ids are 1-based and round-trip; 0 means none', () => {
    expect(itemById(NO_ITEM)).toBeUndefined();
    ITEMS.forEach((it, i) => {
      expect(it.id).toBe(i + 1);
      expect(itemById(it.id)).toBe(it);
      expect(ITEM_ID[it.key]).toBe(it.id);
    });
  });

  it('block ids round-trip; 0 means none', () => {
    expect(blockById(NO_BLOCK)).toBeUndefined();
    BLOCKS.forEach((b) => expect(blockById(b.id)).toBe(b));
  });
});

describe('buildings', () => {
  it('blueprints are rectangular, fit in a chunk and use known characters', () => {
    for (const b of BUILDINGS) {
      const w = b.blueprint[0].length;
      expect(w).toBeLessThanOrEqual(CHUNK_SIZE);
      expect(b.blueprint.length).toBeLessThanOrEqual(CHUNK_SIZE);
      for (const row of b.blueprint) {
        expect(row.length, b.name).toBe(w);
        for (const ch of row) {
          expect(ch === ' ' || ch in BLUEPRINT_CHARS, `${b.name} '${ch}'`).toBe(true);
        }
      }
    }
  });

  it('blueprint characters map to brick blocks', () => {
    for (const key of Object.values(BLUEPRINT_CHARS)) {
      if (key === null) continue;
      expect(blockById(BLOCK_ID[key])?.kind, key).toBe('brick');
    }
  });
});
