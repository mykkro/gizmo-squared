import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '../../src/config';
import { BIOMES, BIOME_INDEX } from '../../src/data/biomes';
import { BLOCKS, BLOCK_ID, NO_BLOCK, blockById } from '../../src/data/blocks';
import { BUILDINGS, BUILDING_STYLES } from '../../src/data/buildings';
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

  it('every biome has walkable terrain covering at least half its weight', () => {
    for (const b of BIOMES) {
      const keys = Object.keys(b.terrains) as TerrainKey[];
      const total = keys.reduce((s, k) => s + (b.terrains[k] ?? 0), 0);
      const open = keys
        .filter((k) => !TERRAINS[TERRAIN_INDEX[k]].solid)
        .reduce((s, k) => s + (b.terrains[k] ?? 0), 0);
      const walkable = open / total >= 0.5;
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
  it('have a style and a footprint that fits a chunk with a one-tile margin', () => {
    for (const b of BUILDINGS) {
      expect(BUILDING_STYLES, b.name).toContain(b.style);
      expect(b.w, b.name).toBeGreaterThan(0);
      expect(b.h, b.name).toBeGreaterThan(0);
      expect(b.w, b.name).toBeLessThanOrEqual(CHUNK_SIZE - 2);
      expect(b.h, b.name).toBeLessThanOrEqual(CHUNK_SIZE - 2);
    }
  });

  it('houses have roof and wall materials', () => {
    for (const b of BUILDINGS.filter((x) => x.style === 'house')) {
      expect(b.roof, b.name).toBeDefined();
      expect(b.wall, b.name).toBeDefined();
    }
  });

  it('include every landmark style', () => {
    expect(new Set(BUILDINGS.map((b) => b.style))).toEqual(new Set(BUILDING_STYLES));
  });

  it('leave only solid obstacle props as blocks (no old building bricks)', () => {
    for (const b of BLOCKS) expect(b.kind, b.key).toBe('obstacle');
    expect(BLOCKS.map((b) => b.key).sort()).toEqual(['boulder', 'cactus', 'chest', 'tree']);
  });
});
