import { describe, expect, it } from 'vitest';
import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../../src/config';
import { TERRAIN_INDEX } from '../../src/data/terrains';
import { fillChunkPixels } from '../../src/render/chunkBaker';
import { terrainColorAt } from '../../src/render/terrainSurface';
import { TEX_PX, texel } from '../../src/render/textures';
import { WorldGenerator } from '../../src/world/generator';

const G = TERRAIN_INDEX.grass;
const S = TERRAIN_INDEX.sand;
const half = (tx: number) => (tx < 0 ? S : G);

describe('terrain surface', () => {
  it('uniform areas are the texture, gently tinted by world-scale variation', () => {
    let differs = 0;
    for (let i = 0; i < 40; i++) {
      const wx = 37 * i * TILE_PX;
      const c = terrainColorAt(wx, 200, () => G);
      const t = texel(G, wx, 200);
      for (let k = 0; k < 3; k++)
        expect(Math.abs(c[k] - t[k])).toBeLessThanOrEqual(t[k] * 0.15 + 2);
      if (c.join() !== t.join()) differs++;
    }
    expect(differs).toBeGreaterThan(20);
  });

  it('the same texel several textures apart looks different (no visible repeats)', () => {
    expect(terrainColorAt(10, 10, () => G)).not.toEqual(
      terrainColorAt(10 + 3 * TEX_PX, 10, () => G),
    );
  });

  it('pure on each side, mixed near the border', () => {
    const uniG = (x: number, y: number) => terrainColorAt(x, y, () => G).join();
    const uniS = (x: number, y: number) => terrainColorAt(x, y, () => S).join();
    expect(terrainColorAt(3 * TILE_PX, 10, half).join()).toBe(uniG(3 * TILE_PX, 10));
    expect(terrainColorAt(-3 * TILE_PX, 10, half).join()).toBe(uniS(-3 * TILE_PX, 10));
    let mixed = 0;
    for (let y = 0; y < 256; y++) {
      const c = terrainColorAt(0, y, half).join();
      if (c !== uniG(0, y) && c !== uniS(0, y)) mixed++;
    }
    expect(mixed).toBeGreaterThan(64);
  });

  it('baked chunks agree with direct sampling at their shared edge (no seams)', () => {
    const gen = new WorldGenerator(77);
    const terrainAt = (tx: number, ty: number) => gen.sampleTile(tx, ty).terrain;
    const a = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4);
    const b = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4);
    const ca = gen.generateChunk(0, 0);
    const cb = gen.generateChunk(1, 0);
    const t0 = performance.now();
    fillChunkPixels(ca, terrainAt, a);
    console.log(`bake ms: ${(performance.now() - t0).toFixed(1)}`);
    fillChunkPixels(cb, terrainAt, b);
    let mismatches = 0;
    for (let y = 0; y < CHUNK_PX; y++) {
      const left = terrainColorAt(CHUNK_PX - 1, y, terrainAt);
      const right = terrainColorAt(CHUNK_PX, y, terrainAt);
      const oa = (y * CHUNK_PX + CHUNK_PX - 1) * 4;
      const ob = y * CHUNK_PX * 4;
      const row = Math.floor(y / TILE_PX) * CHUNK_SIZE;
      if (
        ca.block[row + CHUNK_SIZE - 1] === 0 &&
        [a[oa], a[oa + 1], a[oa + 2]].join() !== left.join()
      )
        mismatches++;
      if (cb.block[row] === 0 && [b[ob], b[ob + 1], b[ob + 2]].join() !== right.join())
        mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});
