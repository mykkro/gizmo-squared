import { describe, expect, it } from 'vitest';
import { TERRAINS, TERRAIN_INDEX } from '../../src/data/terrains';
import { parseHex } from '../../src/render/color';
import {
  BLOCK_PX,
  FOG_RGB,
  MAP_PX,
  MinimapModel,
  TILES_PER_MAP_PX,
} from '../../src/render/minimap';
import { ExploredMap } from '../../src/world/explored';

const GRASS = TERRAIN_INDEX.grass;
const WATER = TERRAIN_INDEX.water;
/** West of x = 0 is water, east is grass. */
const sampler = (tx: number) => (tx < 0 ? WATER : GRASS);

function pixel(out: Uint8ClampedArray, x: number, y: number): number[] {
  const o = (y * MAP_PX + x) * 4;
  return [out[o], out[o + 1], out[o + 2]];
}

/** Composes repeatedly until every block is built (one block per call). */
function composeAll(m: MinimapModel, tx: number, ty: number, out: Uint8ClampedArray): number {
  let calls = 1;
  while (!m.compose(tx, ty, out)) calls++;
  return calls;
}

describe('MinimapModel', () => {
  it('shows only fog before anything is explored', () => {
    const m = new MinimapModel(sampler, new ExploredMap());
    const out = new Uint8ClampedArray(MAP_PX * MAP_PX * 4);
    composeAll(m, 0, 0, out);
    expect(pixel(out, MAP_PX / 2, MAP_PX / 2)).toEqual(FOG_RGB);
    expect(pixel(out, 0, 0)).toEqual(FOG_RGB);
  });

  it('shows terrain colours where explored, fog elsewhere', () => {
    const explored = new ExploredMap();
    explored.reveal(0, 0);
    const m = new MinimapModel(sampler, explored);
    const out = new Uint8ClampedArray(MAP_PX * MAP_PX * 4);
    composeAll(m, 0, 0, out);
    const c = MAP_PX / 2;
    expect(pixel(out, c + 1, c)).toEqual(parseHex(TERRAINS[GRASS].color));
    expect(pixel(out, c - 2, c)).toEqual(parseHex(TERRAINS[WATER].color));
    expect(pixel(out, c + 40, c)).toEqual(FOG_RGB);
  });

  it('builds the block under Gizmo first, so the explored area appears immediately', () => {
    const explored = new ExploredMap();
    explored.reveal(0, 0);
    const m = new MinimapModel(sampler, explored);
    const out = new Uint8ClampedArray(MAP_PX * MAP_PX * 4);
    m.compose(0, 0, out);
    const c = MAP_PX / 2;
    expect(pixel(out, c + 1, c)).toEqual(parseHex(TERRAINS[GRASS].color));
  });

  it('builds at most one block per compose call', () => {
    let samples = 0;
    const counting = (tx: number) => {
      samples++;
      return sampler(tx);
    };
    const m = new MinimapModel(counting, new ExploredMap());
    const out = new Uint8ClampedArray(MAP_PX * MAP_PX * 4);
    expect(m.compose(0, 0, out)).toBe(false);
    expect(samples).toBe(BLOCK_PX * BLOCK_PX);
    const calls = composeAll(m, 0, 0, out);
    const blocksAcross = Math.ceil(MAP_PX / BLOCK_PX) + 1;
    expect(calls).toBeLessThanOrEqual(blocksAcross * blocksAcross);
    samples = 0;
    expect(m.compose(0, 0, out)).toBe(true);
    expect(samples).toBe(0);
  });

  it('covers TILES_PER_MAP_PX tiles per map pixel', () => {
    expect(TILES_PER_MAP_PX).toBe(2);
    expect(MAP_PX * TILES_PER_MAP_PX).toBe(320);
  });
});
