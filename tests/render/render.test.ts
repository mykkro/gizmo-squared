import { describe, expect, it } from 'vitest';
import { CHUNK_PX, TILE_PX } from '../../src/config';
import { BLOCK_ID } from '../../src/data/blocks';
import { ITEM_KEYS } from '../../src/data/items';
import { TERRAIN_INDEX } from '../../src/data/terrains';
import { BakeCache } from '../../src/render/BakeCache';
import { Camera, chunkRect, computeZoom, spanRect } from '../../src/render/camera';
import { fillChunkPixels, type CanvasLike } from '../../src/render/chunkBaker';
import { parseHex, shade } from '../../src/render/color';
import { texel } from '../../src/render/textures';
import { GIZMO_FRAMES, GIZMO_TIRED, ITEM_SPRITES, spriteErrors } from '../../src/render/sprites';
import { createChunkData, localIndex } from '../../src/world/chunk';

describe('color', () => {
  it('parses short and long hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#4fa836')).toEqual([0x4f, 0xa8, 0x36]);
  });

  it('shades and clamps', () => {
    expect(shade([100, 200, 250], 0.5)).toEqual([50, 100, 125]);
    expect(shade([200, 200, 200], 2)).toEqual([255, 255, 255]);
  });
});

describe('camera', () => {
  it('zoom is continuous: about 14 tiles on the short side', () => {
    expect(TILE_PX).toBe(32);
    expect(computeZoom(1120)).toBeCloseTo(2.5);
    expect(computeZoom(100)).toBe(0.5);
    for (const s of [700, 1080, 1500]) expect(s / (TILE_PX * computeZoom(s))).toBeCloseTo(14);
  });

  it('spans (e.g. the fog layer) round both ends once: width error stays within 1 px', () => {
    for (let origin = 600; origin < 700; origin += 0.37) {
      const z = 2.41;
      const [start, size] = spanRect(-3 * 128, 9 * 128, z, origin);
      expect(start).toBe(Math.round(origin - 3 * 128 * z));
      expect(Math.abs(size - 12 * 128 * z)).toBeLessThanOrEqual(1);
    }
  });

  it('chunk rectangles tile without gaps or overlap at fractional zoom', () => {
    for (const z of [1.37, 2.5, 3.14159]) {
      for (let i = -5; i < 5; i++) {
        const [a, sa] = chunkRect(i, 512, z, 640.3);
        const [b] = chunkRect(i + 1, 512, z, 640.3);
        expect(a + sa).toBe(b);
        expect(Number.isInteger(a)).toBe(true);
      }
    }
  });

  it('follows its target smoothly and converges', () => {
    const c = new Camera();
    c.follow(100, 50, 1 / 60);
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(100);
    for (let i = 0; i < 300; i++) c.follow(100, 50, 1 / 60);
    expect(c.x).toBeCloseTo(100, 1);
    expect(c.y).toBeCloseTo(50, 1);
  });
});

describe('sprites', () => {
  it('are well-formed', () => {
    for (const s of [...GIZMO_FRAMES, GIZMO_TIRED]) {
      expect(spriteErrors(s)).toEqual([]);
      expect([s.w, s.h]).toEqual([32, 32]);
    }
    for (const key of ITEM_KEYS)
      expect([ITEM_SPRITES[key].w, ITEM_SPRITES[key].h]).toEqual([16, 16]);
    for (const key of ITEM_KEYS) expect(spriteErrors(ITEM_SPRITES[key]), key).toEqual([]);
  });
});

describe('fillChunkPixels', () => {
  it('paints the terrain texture and blocks with their colour', () => {
    const chunk = createChunkData(0, 0);
    chunk.terrain.fill(TERRAIN_INDEX.grass);
    chunk.block[localIndex(1, 1)] = BLOCK_ID.boulder;
    const out = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4);
    fillChunkPixels(chunk, () => TERRAIN_INDEX.grass, out);

    expect([out[0], out[1], out[2]]).toEqual(texel(TERRAIN_INDEX.grass, 0, 0));
    const o = ((TILE_PX + 16) * CHUNK_PX + TILE_PX + 16) * 4;
    expect([out[o], out[o + 1], out[o + 2]]).not.toEqual(
      texel(TERRAIN_INDEX.grass, TILE_PX + 16, TILE_PX + 16),
    );
    for (let i = 3; i < out.length; i += 4) {
      if (out[i] !== 255) throw new Error(`alpha ${out[i]} at ${i}`);
    }
  });
});

describe('BakeCache', () => {
  it('respects the per-frame budget and serves cache hits for free', () => {
    let bakes = 0;
    const cache = new BakeCache(
      () => {
        bakes++;
        return {} as CanvasLike;
      },
      32,
      2,
    );
    const chunks = [0, 1, 2].map((i) => createChunkData(i, 0));
    cache.beginFrame();
    expect(cache.get(chunks[0])).toBeDefined();
    expect(cache.get(chunks[1])).toBeDefined();
    expect(cache.get(chunks[2])).toBeUndefined();
    expect(cache.get(chunks[0])).toBeDefined();
    expect(bakes).toBe(2);
    expect(cache.bakesThisFrame).toBe(2);
    cache.beginFrame();
    expect(cache.get(chunks[2])).toBeDefined();
    expect(bakes).toBe(3);
  });

  it('evicts least recently used canvases', () => {
    const cache = new BakeCache(() => ({}) as CanvasLike, 2, 10);
    cache.beginFrame();
    for (let i = 0; i < 3; i++) cache.get(createChunkData(i, 0));
    expect(cache.size).toBe(2);
  });
});
