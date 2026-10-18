import { describe, expect, it } from 'vitest';
import { CHUNK_PX, CHUNK_SIZE, TILE_PX } from '../../src/config';
import { BUILDINGS } from '../../src/data/buildings';
import { paintBuilding } from '../../src/render/buildingPainter';
import { ruinsWallMask } from '../../src/world/structures';

const BG = 120;
const T = TILE_PX;
const def = (name: string) => BUILDINGS.find((b) => b.name === name)!;
const place = (name: string, ox = 2, oy = 2, seed = 4242) => ({
  index: BUILDINGS.indexOf(def(name)),
  ox,
  oy,
  seed,
});
const buffer = () => new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4).fill(BG);
const at = (out: Uint8ClampedArray, x: number, y: number) => {
  const o = (Math.round(y) * CHUNK_PX + Math.round(x)) * 4;
  return [out[o], out[o + 1], out[o + 2]];
};
const lum = ([r, g, b]: number[]) => r * 0.3 + g * 0.59 + b * 0.11;
const isBg = (c: number[]) => c[0] === BG && c[1] === BG && c[2] === BG;

describe('paintBuilding: houses', () => {
  it('draws a roof over the footprint and a dark door in the front wall', () => {
    const out = buffer();
    paintBuilding(place('small_house'), out);
    expect(isBg(at(out, 2 * T + 1.5 * T - 10, 2 * T + 12))).toBe(false);
    expect(lum(at(out, 2 * T + 1.5 * T, 5 * T - 6))).toBeLessThan(90);
  });

  it('leaves surroundings alone except for a darker drop shadow to the bottom-right', () => {
    const out = buffer();
    paintBuilding(place('small_house'), out);
    expect(isBg(at(out, 2, 3 * T))).toBe(true);
    at(out, 5 * T + 4, 5 * T + 3).forEach((c) => expect(c).toBeLessThan(BG));
  });

  it('draws windmill sails beyond the mill roof', () => {
    const out = buffer();
    paintBuilding(place('mill', 3, 3), out);
    // A sail tip reaches above-left of the footprint.
    let painted = 0;
    for (let y = 3 * T - 24; y < 3 * T; y++)
      for (let x = 3 * T; x < 4 * T; x++) if (!isBg(at(out, x, y))) painted++;
    expect(painted).toBeGreaterThan(20);
  });
});

describe('paintBuilding: landmarks', () => {
  it('church: dark arched door at the bottom centre and a bluish rose window above it', () => {
    const out = buffer();
    const d = def('church');
    paintBuilding(place('church'), out);
    const cx = 2 * T + (d.w * T) / 2;
    const bottom = (2 + d.h) * T;
    expect(lum(at(out, cx, bottom - 8))).toBeLessThan(80);
    let blue = 0;
    for (let y = bottom - 3 * T; y < bottom - T; y++) {
      const [r, , b] = at(out, cx, y);
      if (b > r + 30) blue++;
    }
    expect(blue).toBeGreaterThan(3);
  });

  it('temple: a row of columns makes luminance alternate across the front', () => {
    const out = buffer();
    const d = def('temple');
    paintBuilding(place('temple'), out);
    const y = (2 + d.h) * T - Math.round(T * 1.1);
    let flips = 0;
    let prev = lum(at(out, 2 * T + 4, y)) > 150;
    for (let x = 2 * T + 4; x < (2 + d.w) * T - 4; x++) {
      const light = lum(at(out, x, y)) > 150;
      if (light !== prev) flips++;
      prev = light;
    }
    expect(flips).toBeGreaterThanOrEqual(2 * (d.w - 1));
  });

  it('ruins: walls drawn where the mask says, floor still shows the terrain', () => {
    const out = buffer();
    const d = def('ruins');
    paintBuilding(place('ruins'), out);
    const walls = ruinsWallMask(4242, d.w, d.h);
    let floorBg = 0;
    let wallsPainted = 0;
    for (let ty = 0; ty < d.h; ty++) {
      for (let tx = 0; tx < d.w; tx++) {
        const c = at(out, (2 + tx) * T + T / 2, (2 + ty) * T + T / 2);
        if (walls[ty * d.w + tx]) wallsPainted += isBg(c) ? 0 : 1;
        else floorBg += isBg(c) ? 1 : 0;
      }
    }
    expect(wallsPainted).toBe(walls.reduce((a, b) => a + b, 0));
    expect(floorBg).toBeGreaterThan(5);
  });

  it('shrine and well are painted; the well has dark water in the middle', () => {
    const shrine = buffer();
    paintBuilding(place('shrine'), shrine);
    expect(isBg(at(shrine, 2 * T + 1.5 * T, 2 * T + 1.5 * T))).toBe(false);
    const well = buffer();
    paintBuilding(place('well'), well);
    const water = at(well, 3 * T, 3 * T + 4);
    expect(lum(water)).toBeLessThan(80);
    expect(water[2]).toBeGreaterThan(water[0]);
  });

  it('never writes outside the buffer, for any building flush against the margin', () => {
    for (const b of BUILDINGS) {
      const out = buffer();
      expect(() =>
        paintBuilding(place(b.name, CHUNK_SIZE - 1 - b.w, CHUNK_SIZE - 1 - b.h), out),
      ).not.toThrow();
      expect(() => paintBuilding(place(b.name, 1, 1), out)).not.toThrow();
      expect(out.length).toBe(CHUNK_PX * CHUNK_PX * 4);
    }
  });
});
