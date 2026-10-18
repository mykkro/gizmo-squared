import { describe, expect, it } from 'vitest';
import { MATERIALS, MATERIAL_PX, materialTexel, type Material } from '../../src/render/materials';

const lum = (m: Material, x: number, y: number) => {
  const [r, g, b] = materialTexel(m, x, y);
  return r * 0.3 + g * 0.59 + b * 0.11;
};

describe('materials', () => {
  it.each(MATERIALS)('%s is deterministic, wraps, is textured and seamless', (m) => {
    expect(materialTexel(m, 5, 9)).toEqual(materialTexel(m, 5 + MATERIAL_PX, 9 - MATERIAL_PX));
    let min = 255;
    let max = 0;
    let inner = 0;
    let wrap = 0;
    for (let y = 0; y < MATERIAL_PX; y++) {
      for (let x = 0; x < MATERIAL_PX; x++) {
        min = Math.min(min, lum(m, x, y));
        max = Math.max(max, lum(m, x, y));
      }
      inner += Math.abs(lum(m, 33, y) - lum(m, 32, y));
      wrap += Math.abs(lum(m, 0, y) - lum(m, MATERIAL_PX - 1, y));
    }
    expect(max - min).toBeGreaterThan(20);
    expect(wrap).toBeLessThan(inner * 2.5 + MATERIAL_PX * 4);
  });

  it.each(['clay', 'slate', 'brick'] as Material[])('%s has visible 8 px row structure', (m) => {
    const rowLum = (y: number) => {
      let s = 0;
      for (let x = 0; x < MATERIAL_PX; x++) s += lum(m, x, y);
      return s / MATERIAL_PX;
    };
    for (let p = 0; p < MATERIAL_PX; p += 8) {
      expect(Math.abs(rowLum(p + 7) - rowLum(p + 2)) / rowLum(p + 2)).toBeGreaterThan(0.08);
    }
  });
});
