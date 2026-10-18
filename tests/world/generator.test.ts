import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '../../src/config';
import { NO_BLOCK, blockById } from '../../src/data/blocks';
import { BUILDINGS } from '../../src/data/buildings';
import { NO_ITEM } from '../../src/data/items';
import { localIndex, tileToChunk, tileToLocal } from '../../src/world/chunk';
import { WorldGenerator } from '../../src/world/generator';

const SEED = 123456;
const LAYERS = ['terrain', 'biome', 'item', 'block', 'solid'] as const;

describe('chunk helpers', () => {
  it('maps negative tiles to the right chunk and local index', () => {
    expect(tileToChunk(-1)).toBe(-1);
    expect(tileToLocal(-1)).toBe(CHUNK_SIZE - 1);
    expect(tileToChunk(-CHUNK_SIZE)).toBe(-1);
    expect(tileToLocal(-CHUNK_SIZE)).toBe(0);
    expect(tileToChunk(-CHUNK_SIZE - 1)).toBe(-2);
    expect(tileToChunk(CHUNK_SIZE)).toBe(1);
    expect(tileToLocal(CHUNK_SIZE)).toBe(0);
    expect(localIndex(3, 2)).toBe(2 * CHUNK_SIZE + 3);
  });
});

describe('WorldGenerator', () => {
  it('produces identical chunks for the same seed regardless of generation order', () => {
    const a = new WorldGenerator(SEED);
    const b = new WorldGenerator(SEED);
    const a11 = a.generateChunk(1, 1);
    const a00 = a.generateChunk(0, 0);
    const b00 = b.generateChunk(0, 0);
    const b11 = b.generateChunk(1, 1);
    for (const layer of LAYERS) {
      expect(a00[layer]).toEqual(b00[layer]);
      expect(a11[layer]).toEqual(b11[layer]);
    }
  });

  it('differs between seeds', () => {
    const a = new WorldGenerator(1).generateChunk(0, 0);
    const b = new WorldGenerator(2).generateChunk(0, 0);
    expect(a.terrain).not.toEqual(b.terrain);
  });

  it('matches direct per-tile sampling across chunk borders, including negative chunks', () => {
    const g = new WorldGenerator(SEED);
    let mismatches = 0;
    for (let cy = -1; cy <= 0; cy++) {
      for (let cx = -1; cx <= 0; cx++) {
        const chunk = g.generateChunk(cx, cy);
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const s = g.sampleTile(cx * CHUNK_SIZE + lx, cy * CHUNK_SIZE + ly);
            const i = localIndex(lx, ly);
            if (chunk.biome[i] !== s.biome || chunk.terrain[i] !== s.terrain) mismatches++;
          }
        }
      }
    }
    expect(mismatches).toBe(0);
  });

  it('never places obstacles next to each other, even across chunk borders', () => {
    const g = new WorldGenerator(SEED);
    const size = 3 * CHUNK_SIZE;
    const grid = new Uint8Array(size * size);
    for (let cy = 0; cy < 3; cy++) {
      for (let cx = 0; cx < 3; cx++) {
        const chunk = g.generateChunk(cx, cy);
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            if (blockById(chunk.block[localIndex(lx, ly)])?.kind === 'obstacle') {
              grid[(cy * CHUNK_SIZE + ly) * size + cx * CHUNK_SIZE + lx] = 1;
            }
          }
        }
      }
    }
    let adjacent = 0;
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        if (!grid[y * size + x]) continue;
        if (grid[y * size + x + 1] || grid[(y + 1) * size + x] || grid[(y + 1) * size + x + 1])
          adjacent++;
        if (x > 0 && grid[(y + 1) * size + x - 1]) adjacent++;
      }
    }
    expect(adjacent).toBe(0);
  });

  it('marks blocks solid and keeps items off solid tiles', () => {
    const g = new WorldGenerator(SEED);
    let violations = 0;
    for (let cy = -1; cy <= 1; cy++) {
      for (let cx = -1; cx <= 1; cx++) {
        const chunk = g.generateChunk(cx, cy);
        for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
          if (chunk.block[i] !== NO_BLOCK && chunk.solid[i] !== 1) violations++;
          if (chunk.solid[i] === 1 && chunk.item[i] !== NO_ITEM) violations++;
        }
      }
    }
    expect(violations).toBe(0);
  });

  it('places buildings somewhere in a 12 x 12 chunk area', () => {
    const g = new WorldGenerator(SEED);
    let found = false;
    for (let cy = -6; cy < 6 && !found; cy++) {
      for (let cx = -6; cx < 6 && !found; cx++) {
        found = g.generateChunk(cx, cy).block.some((b) => blockById(b)?.kind === 'brick');
      }
    }
    expect(found).toBe(true);
  });

  it('places items at a sensible density', () => {
    const g = new WorldGenerator(SEED);
    let items = 0;
    let tiles = 0;
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        const chunk = g.generateChunk(cx, cy);
        items += chunk.item.filter((v) => v !== NO_ITEM).length;
        tiles += chunk.item.length;
      }
    }
    expect(items / tiles).toBeGreaterThan(0.002);
    expect(items / tiles).toBeLessThan(0.08);
  });
});

describe('placed buildings', () => {
  it('are recorded inside the chunk with a one-tile margin, with solid house footprints', () => {
    const g = new WorldGenerator(SEED);
    let houses = 0;
    for (let cy = -6; cy < 6; cy++) {
      for (let cx = -6; cx < 6; cx++) {
        const c = g.generateChunk(cx, cy);
        for (const b of c.buildings) {
          const def = BUILDINGS[b.index];
          const w = def.blueprint[0].length;
          const h = def.blueprint.length;
          // One-tile margin, so roof overhang and drop shadow stay inside this chunk.
          expect(b.ox).toBeGreaterThanOrEqual(1);
          expect(b.oy).toBeGreaterThanOrEqual(1);
          expect(b.ox + w).toBeLessThanOrEqual(CHUNK_SIZE - 1);
          expect(b.oy + h).toBeLessThanOrEqual(CHUNK_SIZE - 1);
          if (def.kind !== 'house') continue;
          houses++;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              expect(c.solid[localIndex(b.ox + x, b.oy + y)]).toBe(1);
              expect(c.item[localIndex(b.ox + x, b.oy + y)]).toBe(NO_ITEM);
            }
          }
        }
      }
    }
    expect(houses).toBeGreaterThan(0);
  });
});
