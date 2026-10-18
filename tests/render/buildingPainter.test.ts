import { describe, expect, it } from 'vitest';
import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../../src/config';
import { BUILDINGS } from '../../src/data/buildings';
import { paintBuilding } from '../../src/render/buildingPainter';

const BG = 120;
const T = TILE_PX;
const idx = (name: string) => BUILDINGS.findIndex((b) => b.name === name);
const buffer = () => new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4).fill(BG);
const at = (out: Uint8ClampedArray, x: number, y: number) => {
  const o = (y * CHUNK_PX + x) * 4;
  return [out[o], out[o + 1], out[o + 2]];
};
const lum = ([r, g, b]: number[]) => r * 0.3 + g * 0.59 + b * 0.11;

describe('paintBuilding', () => {
  it('draws a roof over the footprint and a dark door in the front wall', () => {
    const out = buffer();
    paintBuilding({ index: idx('small_house'), ox: 2, oy: 2 }, out);
    const x0 = 2 * T;
    const y0 = 2 * T;
    const W = 3 * T;
    const H = 3 * T;
    expect(at(out, x0 + W / 2 - 10, y0 + 12)).not.toEqual([BG, BG, BG]); // roof
    expect(lum(at(out, x0 + W / 2, y0 + H - 6))).toBeLessThan(90); // door
  });

  it('leaves surroundings alone except for a darker drop shadow to the bottom-right', () => {
    const out = buffer();
    paintBuilding({ index: idx('small_house'), ox: 2, oy: 2 }, out);
    expect(at(out, 2, 3 * T)).toEqual([BG, BG, BG]);
    const shadow = at(out, 5 * T + 4, 5 * T + 3);
    shadow.forEach((c) => expect(c).toBeLessThan(BG));
  });

  it('never writes outside the buffer for a building flush with the chunk edge', () => {
    const out = buffer();
    const w = BUILDINGS[idx('barn')].blueprint[0].length;
    const h = BUILDINGS[idx('barn')].blueprint.length;
    expect(() =>
      paintBuilding({ index: idx('barn'), ox: CHUNK_SIZE - w, oy: CHUNK_SIZE - h }, out),
    ).not.toThrow();
    expect(out.length).toBe(CHUNK_PX * CHUNK_PX * 4);
    expect(() => paintBuilding({ index: idx('small_house'), ox: 0, oy: 0 }, out)).not.toThrow();
  });

  it('paves the open floor tiles of open structures', () => {
    const out = buffer();
    paintBuilding({ index: idx('shrine'), ox: 2, oy: 2 }, out);
    expect(at(out, 2 * T + T / 2, 2 * T + T / 2)).not.toEqual([BG, BG, BG]);
  });
});
