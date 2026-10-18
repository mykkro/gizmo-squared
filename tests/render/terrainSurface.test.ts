import { describe, expect, it } from 'vitest';
import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../../src/config';
import { TERRAIN_INDEX } from '../../src/data/terrains';
import { fillChunkPixels } from '../../src/render/chunkBaker';
import { terrainColorAt } from '../../src/render/terrainSurface';
import { texel } from '../../src/render/textures';
import { WorldGenerator } from '../../src/world/generator';

const G = TERRAIN_INDEX.grass;
const S = TERRAIN_INDEX.sand;
const half = (tx: number) => (tx < 0 ? S : G);

describe('terrain surface', () => {
  it('uniform areas are the plain texture', () => {
    expect(terrainColorAt(200, 200, () => G)).toEqual(texel(G, 200, 200));
  });

  it('pure on each side, mixed near the border', () => {
    expect(terrainColorAt(3 * TILE_PX, 10, half)).toEqual(texel(G, 3 * TILE_PX, 10));
    expect(terrainColorAt(-3 * TILE_PX, 10, half)).toEqual(texel(S, -3 * TILE_PX, 10));
    let mixed = 0;
    for (let y = 0; y < 256; y++) {
      const c = terrainColorAt(0, y, half);
      if (c.join() !== texel(G, 0, y).join() && c.join() !== texel(S, 0, y).join()) mixed++;
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
