import { describe, expect, it } from 'vitest';
import { CHUNK_PX, TILE_PX } from '../../src/config';
import { BLOCKS, BLOCK_ID } from '../../src/data/blocks';
import { ITEM_KEYS } from '../../src/data/items';
import { TERRAIN_INDEX } from '../../src/data/terrains';
import { BakeCache } from '../../src/render/BakeCache';
import { Camera, computeZoom } from '../../src/render/camera';
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
  it('chooses the integer zoom closest to ~14 tiles on the short side', () => {
    expect(TILE_PX).toBe(32);
    expect(computeZoom(800)).toBe(2);
    expect(computeZoom(1080)).toBe(2);
    expect(computeZoom(1170)).toBe(3);
    expect(computeZoom(2160)).toBe(5);
    expect(computeZoom(300)).toBe(1);
    for (let side = 640; side <= 2400; side += 40) {
      const tiles = side / (TILE_PX * computeZoom(side));
      expect(tiles, `side ${side}`).toBeGreaterThanOrEqual(10);
      expect(tiles, `side ${side}`).toBeLessThan(21);
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
    const boulder = parseHex(BLOCKS[BLOCK_ID.boulder - 1].color);
    const o = ((TILE_PX + 8) * CHUNK_PX + TILE_PX + 8) * 4;
    expect([out[o], out[o + 1], out[o + 2]]).toEqual(boulder);
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
